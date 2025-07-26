import os
from flask import Flask, request, jsonify, render_template, Blueprint, send_from_directory, make_response
import psycopg2
from psycopg2 import extras
import logging
from dotenv import load_dotenv
import csv
from io import StringIO

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
DATABASE_URL = os.getenv('DATABASE_URL')

# --- Database Initialization (for Render, this might be handled by a separate build step or migrations) ---
def get_db_connection():
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except psycopg2.Error as e:
        logging.error(f"Database connection error: {e}")
        return None

def init_db():
    conn = None
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            # Create leads table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS leads (
                    id SERIAL PRIMARY KEY,
                    firstName VARCHAR(255) NOT NULL,
                    lastName VARCHAR(255),
                    title VARCHAR(255),
                    company VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    phone VARCHAR(255),
                    product VARCHAR(255),
                    stage VARCHAR(255) NOT NULL,
                    dateOfContact DATE NOT NULL,
                    followUp DATE,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Create general_expenses table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS general_expenses (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    amount NUMERIC(10, 2) NOT NULL,
                    description TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Create calendar_events table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    type VARCHAR(255) NOT NULL,
                    description TEXT,
                    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
                    amount NUMERIC(10, 2) DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            cur.close()
            logging.info("Database tables checked/created successfully.")
    except psycopg2.Error as e:
        logging.error(f"Database initialization error: {e}")
    finally:
        if conn:
            conn.close()

# --- Routes ---

@app.route('/')
def index():
    return render_template('dynamic_dashboard.html')

# API for Leads
@app.route('/api/leads', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_leads():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        if request.method == 'POST':
            data = request.json
            cur.execute(
                """
                INSERT INTO leads (firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
                """,
                (data['firstName'], data.get('lastName'), data.get('title'), data['company'],
                 data.get('email'), data.get('phone'), data.get('product'), data['stage'],
                 data['dateOfContact'], data.get('followUp'), data.get('notes'))
            )
            new_lead_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"message": "Lead added successfully", "id": new_lead_id}), 201

        elif request.method == 'GET':
            lead_id = request.args.get('id')
            if lead_id:
                cur.execute("SELECT * FROM leads WHERE id = %s;", (lead_id,))
                leads = cur.fetchall()
            else:
                cur.execute("SELECT * FROM leads ORDER BY created_at DESC;")
                leads = cur.fetchall()
            return jsonify(leads), 200

        elif request.method == 'PUT':
            data = request.json
            lead_id = data.get('id')
            if not lead_id:
                return jsonify({"message": "Lead ID is required for update"}), 400
            cur.execute(
                """
                UPDATE leads SET
                    firstName = %s, lastName = %s, title = %s, company = %s,
                    email = %s, phone = %s, product = %s, stage = %s,
                    dateOfContact = %s, followUp = %s, notes = %s
                WHERE id = %s;
                """,
                (data['firstName'], data.get('lastName'), data.get('title'), data['company'],
                 data.get('email'), data.get('phone'), data.get('product'), data['stage'],
                 data['dateOfContact'], data.get('followUp'), data.get('notes'), lead_id)
            )
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"message": "Lead not found or no changes made"}), 404
            return jsonify({"message": "Lead updated successfully"}), 200

        elif request.method == 'DELETE':
            lead_id = request.args.get('id')
            if not lead_id:
                return jsonify({"message": "Lead ID is required for deletion"}), 400
            cur.execute("DELETE FROM leads WHERE id = %s;", (lead_id,))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"message": "Lead not found"}), 404
            return jsonify({"message": "Lead deleted successfully"}), 200

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_leads: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

# API for Lead Activities (Visits) - Renamed to be more general
@app.route('/api/lead_activities', methods=['GET', 'POST'])
def handle_lead_activities():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        if request.method == 'POST':
            data = request.json
            # Insert into calendar_events as lead activities are also events
            cur.execute(
                """
                INSERT INTO calendar_events (date, type, description, lead_id, amount)
                VALUES (%s, %s, %s, %s, %s) RETURNING id;
                """,
                (data['activity_date'], data['activity_type'], data.get('description'),
                 data.get('lead_id'), data.get('expenditure', 0.00))
            )
            new_activity_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"message": "Activity added successfully", "id": new_activity_id}), 201

        elif request.method == 'GET':
            lead_id = request.args.get('lead_id')
            if lead_id:
                # Fetch activities specifically linked to a lead
                cur.execute("""
                    SELECT ce.*, l.firstName, l.lastName, l.company
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    WHERE ce.lead_id = %s
                    ORDER BY ce.date DESC;
                """, (lead_id,))
            else:
                # Fetch all activities that are linked to leads (optional, or adjust as needed)
                cur.execute("""
                    SELECT ce.*, l.firstName, l.lastName, l.company
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    WHERE ce.lead_id IS NOT NULL
                    ORDER BY ce.date DESC;
                """)
            activities = cur.fetchall()
            return jsonify(activities), 200

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_lead_activities: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

# API for General Expenses
@app.route('/api/general_expenses', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_general_expenses():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        if request.method == 'POST':
            data = request.json
            cur.execute(
                """
                INSERT INTO general_expenses (date, amount, description)
                VALUES (%s, %s, %s) RETURNING id;
                """,
                (data['date'], data['amount'], data['description'])
            )
            new_expense_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"message": "General expense added successfully", "id": new_expense_id}), 201

        elif request.method == 'GET':
            expense_id = request.args.get('id')
            if expense_id:
                cur.execute("SELECT * FROM general_expenses WHERE id = %s;", (expense_id,))
                expenses = cur.fetchall()
            else:
                cur.execute("SELECT * FROM general_expenses ORDER BY date DESC;")
                expenses = cur.fetchall()
            return jsonify(expenses), 200

        elif request.method == 'PUT':
            data = request.json
            expense_id = data.get('id')
            if not expense_id:
                return jsonify({"message": "Expense ID is required for update"}), 400
            cur.execute(
                """
                UPDATE general_expenses SET
                    date = %s, amount = %s, description = %s
                WHERE id = %s;
                """,
                (data['date'], data['amount'], data['description'], expense_id)
            )
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"message": "Expense not found or no changes made"}), 404
            return jsonify({"message": "General expense updated successfully"}), 200

        elif request.method == 'DELETE':
            expense_id = request.args.get('id')
            if not expense_id:
                return jsonify({"message": "Expense ID is required for deletion"}), 400
            cur.execute("DELETE FROM general_expenses WHERE id = %s;", (expense_id,))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({"message": "Expense not found"}), 404
            return jsonify({"message": "General expense deleted successfully"}), 200

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_general_expenses: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

# API for Calendar Events
@app.route('/api/calendar_events', methods=['GET', 'POST'])
def handle_calendar_events():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        if request.method == 'POST':
            data = request.json
            cur.execute(
                """
                INSERT INTO calendar_events (date, type, description, lead_id, amount)
                VALUES (%s, %s, %s, %s, %s) RETURNING id;
                """,
                (data['date'], data['type'], data.get('description'),
                 data.get('lead_id'), data.get('amount', 0.00))
            )
            new_event_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"message": "Calendar event added successfully", "id": new_event_id}), 201

        elif request.method == 'GET':
            # Fetch all calendar events, joining with leads to get lead name and company if linked
            cur.execute("""
                SELECT ce.id, ce.date, ce.type, ce.description, ce.amount,
                       l.id AS lead_id, l.firstName, l.lastName, l.company
                FROM calendar_events ce
                LEFT JOIN leads l ON ce.lead_id = l.id
                ORDER BY ce.date;
            """)
            events = cur.fetchall()
            # Format lead_name for display
            for event in events:
                if event['lead_id']:
                    event['lead_name'] = f"{event['firstname'] or ''} {event['lastname'] or ''}".strip()
                    event['company'] = event['company']
                else:
                    event['lead_name'] = None
                    event['company'] = None
                # Clean up unused fields from join
                event.pop('firstname', None)
                event.pop('lastname', None)
            return jsonify(events), 200

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_calendar_events: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

# API for Expenditure Report
@app.route('/api/expenditure_report', methods=['GET'])
def get_expenditure_report():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = """
            SELECT date, 'General Expense' AS type_category, description, amount, NULL AS lead_name, NULL AS company
            FROM general_expenses
        """
        params = []

        if start_date and end_date:
            query += " WHERE date BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        elif start_date:
            query += " WHERE date >= %s"
            params.append(start_date)
        elif end_date:
            query += " WHERE date <= %s"
            params.append(end_date)

        query += " ORDER BY date DESC;"

        cur.execute(query, params)
        general_expenses = cur.fetchall()

        # For lead-related expenses (from calendar_events with amount > 0)
        # Note: This assumes 'visit' and 'general expense' types in calendar_events
        # might also contribute to expenditure. Adjust types as needed.
        query_lead_expenses = """
            SELECT ce.date, ce.type AS type_category, ce.description, ce.amount,
                   l.firstName, l.lastName, l.company
            FROM calendar_events ce
            JOIN leads l ON ce.lead_id = l.id
            WHERE ce.amount > 0
        """
        lead_expense_params = []

        if start_date and end_date:
            query_lead_expenses += " AND ce.date BETWEEN %s AND %s"
            lead_expense_params.extend([start_date, end_date])
        elif start_date:
            query_lead_expenses += " AND ce.date >= %s"
            lead_expense_params.append(start_date)
        elif end_date:
            query_lead_expenses += " AND ce.date <= %s"
            lead_expense_params.append(end_date)

        query_lead_expenses += " ORDER BY ce.date DESC;"

        cur.execute(query_lead_expenses, lead_expense_params)
        lead_expenses = cur.fetchall()

        # Combine and format results
        report_data = []
        for expense in general_expenses:
            report_data.append({
                "date": str(expense['date']),
                "type_category": expense['type_category'],
                "description": expense['description'],
                "amount": float(expense['amount']),
                "lead_name": expense['lead_name'],
                "company": expense['company']
            })
        for expense in lead_expenses:
            lead_full_name = f"{expense['firstname'] or ''} {expense['lastname'] or ''}".strip()
            report_data.append({
                "date": str(expense['date']),
                "type_category": expense['type_category'],
                "description": expense['description'],
                "amount": float(expense['amount']),
                "lead_name": lead_full_name if lead_full_name else None,
                "company": expense['company']
            })

        # Sort combined data by date
        report_data.sort(key=lambda x: x['date'], reverse=True)

        return jsonify(report_data), 200

    except psycopg2.Error as e:
        logging.error(f"Database error when fetching expenditure report: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/export_leads', methods=['GET'])
def export_leads():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        cur.execute("SELECT * FROM leads ORDER BY created_at DESC;")
        leads = cur.fetchall()

        si = StringIO()
        cw = csv.writer(si)

        # Write header
        cw.writerow([
            "ID", "First Name", "Last Name", "Title", "Company", "Email",
            "Phone", "Product", "Stage", "Date of Contact", "Follow-up Date", "Notes", "Created At"
        ])

        # Write data
        for lead in leads:
            cw.writerow([
                lead['id'], lead['firstname'], lead['lastname'], lead['title'],
                lead['company'], lead['email'], lead['phone'], lead['product'],
                lead['stage'], lead['dateofcontact'], lead['followup'], lead['notes'], lead['created_at']
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

@app.route('/api/export_expenditure_report', methods=['GET'])
def export_expenditure_report():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query_general = """
            SELECT date, 'General Expense' AS type_category, description, amount, NULL AS lead_name, NULL AS company
            FROM general_expenses
        """
        params_general = []

        if start_date and end_date:
            query_general += " WHERE date BETWEEN %s AND %s"
            params_general.extend([start_date, end_date])
        elif start_date:
            query_general += " WHERE date >= %s"
            params_general.append(start_date)
        elif end_date:
            query_general += " WHERE date <= %s"
            params_general.append(end_date)

        cur.execute(query_general, params_general)
        general_expenses = cur.fetchall()

        query_lead_expenses = """
            SELECT ce.date, ce.type AS type_category, ce.description, ce.amount,
                   l.firstName, l.lastName, l.company
            FROM calendar_events ce
            JOIN leads l ON ce.lead_id = l.id
            WHERE ce.amount > 0
        """
        params_lead_expenses = []

        if start_date and end_date:
            query_lead_expenses += " AND ce.date BETWEEN %s AND %s"
            params_lead_expenses.extend([start_date, end_date])
        elif start_date:
            query_lead_expenses += " AND ce.date >= %s"
            params_lead_expenses.append(start_date)
        elif end_date:
            query_lead_expenses += " AND ce.date <= %s"
            params_lead_expenses.append(end_date)

        cur.execute(query_lead_expenses, params_lead_expenses)
        lead_expenses = cur.fetchall()

        report_data = []
        for item in general_expenses:
            report_data.append({
                'date': str(item['date']),
                'type_category': item['type_category'],
                'description': item['description'],
                'amount': float(item['amount']),
                'lead_name': item['lead_name'],
                'company': item['company']
            })
        for item in lead_expenses:
            lead_full_name = f"{item['firstname'] or ''} {item['lastname'] or ''}".strip()
            report_data.append({
                'date': str(item['date']),
                'type_category': item['type_category'],
                'description': item['description'],
                'amount': float(item['amount']),
                'lead_name': lead_full_name if lead_full_name else None,
                'company': item['company']
            })

        report_data.sort(key=lambda x: x['date']) # Sort for CSV output

        si = StringIO()
        cw = csv.writer(si)

        # Write header
        cw.writerow([
            "Date", "Type/Category", "Description", "Amount (KSh)", "Lead Name", "Company"
        ])

        # Write data
        for item in report_data:
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
    app.run(host='0.0.0.0', port=port)
