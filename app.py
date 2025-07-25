import os
from flask import Flask, request, jsonify, render_template, Blueprint, send_from_directory
import psycopg2 # Changed from sqlite3
from psycopg2 import extras # To fetch results as dictionaries
import logging
from dotenv import load_dotenv

load_dotenv()

# Define the path to your project's root directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Initialize Flask app
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, 'static'))

# --- IMPORTANT: Create a Blueprint for node_modules static files ---
# This Blueprint will serve files from the 'node_modules' directory
node_modules_bp = Blueprint(
    'node_modules_bp',
    __name__,
    static_url_path='/node_modules',
    static_folder=os.path.join(BASE_DIR, 'node_modules')
)
app.register_blueprint(node_modules_bp)

# --- Configuration ---
# Use DATABASE_URL for PostgreSQL, or a default for local testing
DATABASE_URL = os.getenv('DATABASE_URL') # This will be set on Render
# For local testing without Render DB, you might still use SQLite or a local PG.
# For simplicity, we'll assume local testing might use a local PG, or you'll mostly test on Render now.
# If DATABASE_URL is not set, we'll default to an invalid value that will cause an error locally,
# ensuring you set it up correctly for Render.

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Database Helper Functions (UPDATED FOR POSTGRESQL) ---
def get_db_connection():
    conn = None
    try:
        # Connect using the DATABASE_URL environment variable
        conn = psycopg2.connect(DATABASE_URL)
        # Return a cursor that fetches results as dictionaries (like sqlite3.Row)
        return conn
    except psycopg2.Error as e:
        logging.error(f"Database connection error: {e}")
        raise # Re-raise the exception to be caught by the calling function

def get_db_cursor(conn):
    # Use RealDictCursor to get results as dictionaries
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# --- Database Initialization (PostgreSQL version) ---
# This function is now specifically for PostgreSQL and assumes schema.sql
# and seed.sql are designed for PG.
def init_db():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Execute schema.sql
        with open(os.path.join(BASE_DIR, 'schema.sql')) as f:
            cur.execute(f.read())
        logging.info("Schema loaded from schema.sql")

        # Execute seed.sql
        with open(os.path.join(BASE_DIR, 'seed.sql')) as f:
            cur.execute(f.read())
        logging.info("Data seeded from seed.sql")

        conn.commit()
        logging.info("Database initialized with schema and seed data.")
    except psycopg2.Error as e:
        logging.error(f"Error initializing database: {e}")
        if conn:
            conn.rollback() # Rollback on error
        raise # Re-raise to show the error
    finally:
        if conn:
            conn.close()

# --- API Endpoints ---
@app.route('/')
def index():
    return render_template('dynamic_dashboard.html')

@app.route('/api/leads', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_leads():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)

        if request.method == 'POST':
            data = request.json
            sql = """
                INSERT INTO leads (firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
            """
            cur.execute(sql, (data['firstName'], data.get('lastName'), data.get('title'),
                              data['company'], data.get('email'), data.get('phone'),
                              data.get('product'), data['stage'], data['dateOfContact'],
                              data.get('followUp'), data.get('notes')))
            new_lead_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"message": "Lead added successfully", "id": new_lead_id}), 201

        elif request.method == 'GET':
            leads = cur.execute("SELECT id, firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes, created_at FROM leads ORDER BY created_at DESC").fetchall()
            return jsonify(leads)

        elif request.method == 'PUT':
            data = request.json
            sql = """
                UPDATE leads SET
                    firstName = %s, lastName = %s, title = %s, company = %s, email = %s,
                    phone = %s, product = %s, stage = %s, dateOfContact = %s, followUp = %s, notes = %s
                WHERE id = %s RETURNING id;
            """
            cur.execute(sql, (data['firstName'], data.get('lastName'), data.get('title'),
                              data['company'], data.get('email'), data.get('phone'),
                              data.get('product'), data['stage'], data['dateOfContact'],
                              data.get('followUp'), data.get('notes'), data['id']))
            conn.commit()
            return jsonify({"message": "Lead updated successfully", "id": data['id']})

        elif request.method == 'DELETE':
            lead_id = request.args.get('id')
            if not lead_id:
                return jsonify({"message": "Lead ID is required"}), 400

            cur.execute("DELETE FROM leads WHERE id = %s RETURNING id;", (lead_id,))
            if cur.rowcount == 0:
                conn.rollback() # No row was deleted
                return jsonify({"message": "Lead not found"}), 404
            conn.commit()
            return jsonify({"message": "Lead deleted successfully", "id": lead_id})

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_leads: {e}")
        if conn:
            conn.rollback()
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/lead_activities', methods=['GET', 'POST'])
def handle_lead_activities():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)

        if request.method == 'POST':
            data = request.json
            sql = """
                INSERT INTO lead_activities (lead_id, activity_type, activity_date, description, latitude, longitude, location_name, expenditure)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
            """
            cur.execute(sql, (data['lead_id'], data['activity_type'], data['activity_date'],
                              data.get('description'), data.get('latitude'), data.get('longitude'),
                              data.get('location_name'), data.get('expenditure', 0.0)))
            new_activity_id = cur.fetchone()['id']

            # If it's a 'visit' or 'general_expense' activity, also add to calendar_events
            if data['activity_type'] in ['visit', 'general_expense']:
                # Re-using the logic from the previous calendar event creation
                calendar_event_sql = """
                    INSERT INTO calendar_events (date, description, type, lead_id, amount)
                    VALUES (%s, %s, %s, %s, %s);
                """
                event_description = data.get('description', '')
                event_type = data['activity_type']
                event_amount = data.get('expenditure', 0.0) if data['activity_type'] == 'general_expense' else data.get('expenditure', 0.0) # Expenditure for visits too
                event_lead_id = data['lead_id'] if data['activity_type'] == 'visit' else None # Link to lead only for visits for now

                cur.execute(calendar_event_sql, (data['activity_date'], event_description, event_type, event_lead_id, event_amount))

            conn.commit()
            return jsonify({"message": "Lead activity added successfully", "id": new_activity_id}), 201

        elif request.method == 'GET':
            lead_id = request.args.get('lead_id')
            if lead_id:
                activities = cur.execute("""
                    SELECT id, lead_id, activity_type, activity_date, description, latitude, longitude, location_name, expenditure, created_at
                    FROM lead_activities WHERE lead_id = %s ORDER BY created_at DESC;
                """, (lead_id,)).fetchall()
            else:
                activities = cur.execute("""
                    SELECT id, lead_id, activity_type, activity_date, description, latitude, longitude, location_name, expenditure, created_at
                    FROM lead_activities ORDER BY created_at DESC;
                """).fetchall()
            return jsonify(activities)

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_lead_activities: {e}")
        if conn:
            conn.rollback()
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/general_expenses', methods=['GET', 'POST'])
def handle_general_expenses():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)

        if request.method == 'POST':
            data = request.json
            sql = """
                INSERT INTO general_expenses (date, description, amount)
                VALUES (%s, %s, %s) RETURNING id;
            """
            cur.execute(sql, (data['date'], data['description'], data['amount']))
            new_expense_id = cur.fetchone()['id']

            # Also add to calendar_events
            calendar_event_sql = """
                INSERT INTO calendar_events (date, description, type, lead_id, amount)
                VALUES (%s, %s, %s, %s, %s);
            """
            cur.execute(calendar_event_sql, (data['date'], data['description'], 'General Expense', None, data['amount']))

            conn.commit()
            return jsonify({"message": "General expense added successfully", "id": new_expense_id}), 201

        elif request.method == 'GET':
            expenses = cur.execute("SELECT id, date, description, amount, created_at FROM general_expenses ORDER BY date DESC").fetchall()
            return jsonify(expenses)

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_general_expenses: {e}")
        if conn:
            conn.rollback()
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/calendar_events', methods=['GET', 'POST'])
def handle_calendar_events():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)

        if request.method == 'POST':
            data = request.json
            sql = """
                INSERT INTO calendar_events (date, description, type, lead_id, amount)
                VALUES (%s, %s, %s, %s, %s) RETURNING id;
            """
            # Handle empty lead_id
            lead_id_val = data.get('lead_id') if data.get('lead_id') else None
            cur.execute(sql, (data['date'], data.get('description'), data['type'], lead_id_val, data.get('amount')))
            new_event_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"message": "Calendar event added successfully", "id": new_event_id}), 201

        elif request.method == 'GET':
            events = cur.execute("""
                SELECT ce.id, ce.date, ce.description, ce.type, ce.amount,
                       l.firstName || ' ' || COALESCE(l.lastName, '') AS lead_name,
                       ce.lead_id
                FROM calendar_events ce
                LEFT JOIN leads l ON ce.lead_id = l.id
                ORDER BY ce.date DESC;
            """).fetchall()
            return jsonify(events)

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_calendar_events: {e}")
        if conn:
            conn.rollback()
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/expenditure_report', methods=['GET'])
def get_expenditure_report():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # Query for lead_activities that have expenditure (e.g., 'visit' type)
        # Use || for string concatenation and %s for placeholders
        activities_sql = """
            SELECT
                la.activity_date AS date,
                la.description,
                la.expenditure AS amount,
                l.firstName || ' ' || COALESCE(l.lastName, '') AS lead_name,
                l.company,
                la.activity_type AS type_category -- Use activity_type as category
            FROM lead_activities la
            JOIN leads l ON la.lead_id = l.id
            WHERE la.expenditure > 0
        """
        # Base query for general expenses (not linked to a specific lead)
        general_expenses_sql = """
            SELECT
                ge.date,
                ge.description,
                ge.amount,
                NULL AS lead_name,
                NULL AS company,
                'General Expense' AS type_category
            FROM general_expenses ge
            WHERE 1=1
        """

        activities_params = []
        general_expenses_params = []

        if start_date:
            activities_sql += " AND la.activity_date >= %s"
            general_expenses_sql += " AND ge.date >= %s"
            activities_params.append(start_date)
            general_expenses_params.append(start_date)
        if end_date:
            activities_sql += " AND la.activity_date <= %s"
            general_expenses_sql += " AND ge.date <= %s"
            activities_params.append(end_date)
            general_expenses_params.append(end_date)

        cur.execute(activities_sql, activities_params)
	activities_with_expenditure = cur.fetchall()
        general_expenses = cur.execute(general_expenses_sql, general_expenses_params).fetchall()

        # Combine and sort results by date
        report_items = [dict(row) for row in activities_with_expenditure] + [dict(row) for row in general_expenses]
        report_items.sort(key=lambda x: x['date'])

        return jsonify(report_items)

    except psycopg2.Error as e:
        logging.error(f"Database error when fetching expenditure report: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/export_leads', methods=['GET'])
def export_leads():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        leads = cur.execute("SELECT id, firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes, created_at FROM leads ORDER BY created_at DESC").fetchall()

        from io import StringIO
        import csv

        si = StringIO()
        cw = csv.writer(si)

        # Write header
        cw.writerow([
            'ID', 'First Name', 'Last Name', 'Title', 'Company', 'Email', 'Phone',
            'Product', 'Stage', 'Date of Contact', 'Follow Up', 'Notes', 'Created At'
        ])

        # Write data rows
        for lead in leads:
            cw.writerow([
                lead['id'], lead['firstName'], lead['lastName'], lead['title'],
                lead['company'], lead['email'], lead['phone'], lead['product'],
                lead['stage'], lead['dateOfContact'], lead['followUp'],
                lead['notes'], lead['created_at'].isoformat() if lead['created_at'] else '' # Format datetime for CSV
            ])

        output = si.getvalue()
        response = make_response(output)
        response.headers["Content-Disposition"] = "attachment; filename=leads_export.csv"
        response.headers["Content-type"] = "text/csv"
        return response

    except psycopg2.Error as e:
        logging.error(f"Database error when exporting leads: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route('/export_expenditure_report', methods=['GET'])
def export_expenditure_report():
    conn = None
    try:
        conn = get_db_connection()
        cur = get_db_cursor(conn)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        activities_sql = """
            SELECT
                la.activity_date AS date,
                la.description,
                la.expenditure AS amount,
                l.firstName || ' ' || COALESCE(l.lastName, '') AS lead_name,
                l.company,
                la.activity_type AS type_category
            FROM lead_activities la
            JOIN leads l ON la.lead_id = l.id
            WHERE la.expenditure > 0
        """
        general_expenses_sql = """
            SELECT
                ge.date,
                ge.description,
                ge.amount,
                NULL AS lead_name,
                NULL AS company,
                'General Expense' AS type_category
            FROM general_expenses ge
            WHERE 1=1
        """

        activities_params = []
        general_expenses_params = []

        if start_date:
            activities_sql += " AND la.activity_date >= %s"
            general_expenses_sql += " AND ge.date >= %s"
            activities_params.append(start_date)
            general_expenses_params.append(start_date)
        if end_date:
            activities_sql += " AND la.activity_date <= %s"
            general_expenses_sql += " AND ge.date <= %s"
            activities_params.append(end_date)
            general_expenses_params.append(end_date)

        activities_with_expenditure = cur.execute(activities_sql, activities_params).fetchall()
        general_expenses = cur.execute(general_expenses_sql, general_expenses_params).fetchall()

        report_items = [dict(row) for row in activities_with_expenditure] + \
                       [dict(row) for row in general_expenses]
        report_items.sort(key=lambda x: x['date'])

        from io import StringIO
        import csv
        from flask import make_response # Ensure make_response is imported for exports

        si = StringIO()
        cw = csv.writer(si)

        # Write header
        cw.writerow([
            'Date', 'Category', 'Description', 'Amount', 'Lead Name', 'Company'
        ])

        # Write data rows
        for item in report_items:
            cw.writerow([
                item['date'],
                item['type_category'],
                item['description'],
                item['amount'],
                item['lead_name'],
                item['company']
            ])

        output = si.getvalue()
        response = make_response(output)
        response.headers["Content-Disposition"] = "attachment; filename=expenditure_report_export.csv"
        response.headers["Content-type"] = "text/csv"
        return response

    except psycopg2.Error as e:
        logging.error(f"Database error when exporting expenditure report: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # IMPORTANT: When running locally, you might want to run init_db() ONLY once
    # to set up a *local* PostgreSQL database or ensure the schema is applied.
    # For Render, it's better to manage schema/seed through Render's build process
    # or dedicated migration tools.
    # Ensure DATABASE_URL is set in your local .env if you want to test locally with PG.
    # If not set, it will try to connect to an undefined DATABASE_URL, which will fail.
    # To run locally with SQLite again temporarily, you'd have to revert this file.
    # init_db() # Keep this commented out for automatic deployments

    # === YOU NEED TO MAKE THE CHANGE HERE ===
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)