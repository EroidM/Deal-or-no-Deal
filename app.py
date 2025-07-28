import os
from flask import Flask, request, jsonify, render_template, Blueprint, send_from_directory, make_response
import psycopg2
from psycopg2 import extras
import logging
from dotenv import load_dotenv
import csv
from io import StringIO

# Configure logging to show DEBUG messages
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

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
        logging.info("Attempting to connect to database.")
        conn = psycopg2.connect(DATABASE_URL)
        logging.info("Database connection successful.")
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

# Helper to convert empty strings to None for nullable fields
def convert_empty_to_none(data, fields):
    for field in fields:
        if field in data and data[field] == '':
            data[field] = None
    return data

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
            logging.debug(f"Received lead POST data: {data}")
            # Ensure dateOfContact is not empty as it's NOT NULL
            if not data.get('dateOfContact'):
                return jsonify({"message": "Date of Contact is required."}), 400
            data = convert_empty_to_none(data, ['lastName', 'title', 'email', 'phone', 'product', 'followUp', 'notes'])

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
            logging.info(f"Lead added successfully with ID: {new_lead_id}")
            return jsonify({"message": "Lead added successfully", "id": new_lead_id}), 201

        elif request.method == 'GET':
            lead_id = request.args.get('id')
            if lead_id:
                logging.debug(f"Fetching lead with ID: {lead_id}")
                # Explicitly select all columns to ensure they are returned
                cur.execute("SELECT id, firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes, created_at FROM leads WHERE id = %s;", (lead_id,))
                leads = cur.fetchall()
            else:
                logging.debug("Fetching all leads.")
                # Explicitly select all columns for consistency
                cur.execute("SELECT id, firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes, created_at FROM leads ORDER BY created_at DESC;")
                leads = cur.fetchall()
            logging.debug(f"Fetched leads: {leads}")
            return jsonify(leads), 200

        elif request.method == 'PUT':
            data = request.json
            logging.debug(f"Received lead PUT data: {data}")
            lead_id = data.get('id')
            if not lead_id:
                return jsonify({"message": "Lead ID is required for update"}), 400
            # Ensure dateOfContact is not empty as it's NOT NULL
            if not data.get('dateOfContact'):
                return jsonify({"message": "Date of Contact is required."}), 400
            data = convert_empty_to_none(data, ['lastName', 'title', 'email', 'phone', 'product', 'followUp', 'notes'])

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
                logging.warning(f"Lead with ID {lead_id} not found for update or no changes made.")
                return jsonify({"message": "Lead not found or no changes made"}), 404
            logging.info(f"Lead with ID {lead_id} updated successfully.")
            return jsonify({"message": "Lead updated successfully"}), 200

        elif request.method == 'DELETE':
            lead_id = request.args.get('id')
            if not lead_id:
                return jsonify({"message": "Lead ID is required for deletion"}), 400
            logging.debug(f"Deleting lead with ID: {lead_id}")
            cur.execute("DELETE FROM leads WHERE id = %s;", (lead_id,))
            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"Lead with ID {lead_id} not found for deletion.")
                return jsonify({"message": "Lead not found"}), 404
            logging.info(f"Lead with ID {lead_id} deleted successfully.")
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
            logging.debug(f"Received lead activity POST data: {data}")
            if not data.get('activity_date'):
                return jsonify({"message": "Activity Date is required."}), 400
            if not data.get('activity_type'): # Ensure activity type is present
                return jsonify({"message": "Activity Type is required."}), 400

            data = convert_empty_to_none(data, ['description', 'lead_id', 'expenditure'])

            # Insert into calendar_events as lead activities are also events
            cur.execute(
                """
                INSERT INTO calendar_events (date, type, description, lead_id, amount)
                VALUES (%s, %s, %s, %s, %s) RETURNING id;
                """,
                (data['activity_date'], data['activity_type'], data.get('description'),
                 data.get('lead_id'), data.get('expenditure', 0.00)) # Use .get with default for expenditure
            )
            new_activity_id = cur.fetchone()['id']
            conn.commit()
            logging.info(f"Activity added successfully with ID: {new_activity_id}")
            return jsonify({"message": "Activity added successfully", "id": new_activity_id}), 201

        elif request.method == 'GET':
            lead_id = request.args.get('lead_id')
            if lead_id:
                logging.debug(f"Fetching activities for lead ID: {lead_id}")
                cur.execute("""
                    SELECT ce.id, ce.date, ce.type, ce.description, ce.amount,
                           l.id AS lead_id, l.firstName, l.lastName, l.company
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    WHERE ce.lead_id = %s
                    ORDER BY ce.date DESC;
                """, (lead_id,))
            else:
                logging.debug("Fetching all lead-linked activities.")
                cur.execute("""
                    SELECT ce.id, ce.date, ce.type, ce.description, ce.amount,
                           l.id AS lead_id, l.firstName, l.lastName, l.company
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    WHERE ce.lead_id IS NOT NULL
                    ORDER BY ce.date DESC;
                """)
            activities = cur.fetchall()
            logging.debug(f"Fetched activities: {activities}")
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
            logging.debug(f"Received general expense POST data: {data}")
            if not data.get('date'):
                return jsonify({"message": "Date is required."}), 400
            if not data.get('amount'):
                return jsonify({"message": "Amount is required."}), 400
            data = convert_empty_to_none(data, ['description'])

            cur.execute(
                """
                INSERT INTO general_expenses (date, amount, description)
                VALUES (%s, %s, %s) RETURNING id;
                """,
                (data['date'], data['amount'], data['description'])
            )
            new_expense_id = cur.fetchone()['id']
            conn.commit()
            logging.info(f"General expense added successfully with ID: {new_expense_id}")
            return jsonify({"message": "General expense added successfully", "id": new_expense_id}), 201

        elif request.method == 'GET':
            expense_id = request.args.get('id')
            if expense_id:
                logging.debug(f"Fetching general expense with ID: {expense_id}")
                # Explicitly select all columns for consistency
                cur.execute("SELECT id, date, amount, description, created_at FROM general_expenses WHERE id = %s;", (expense_id,))
                expenses = cur.fetchall()
            else:
                logging.debug("Fetching all general expenses.")
                # Explicitly select all columns for consistency
                cur.execute("SELECT id, date, amount, description, created_at FROM general_expenses ORDER BY date DESC;")
                expenses = cur.fetchall()
            logging.debug(f"Fetched general expenses: {expenses}")
            return jsonify(expenses), 200

        elif request.method == 'PUT':
            data = request.json
            logging.debug(f"Received general expense PUT data: {data}")
            expense_id = data.get('id')
            if not expense_id:
                return jsonify({"message": "Expense ID is required for update"}), 400
            if not data.get('date'):
                return jsonify({"message": "Date is required."}), 400
            if not data.get('amount'):
                return jsonify({"message": "Amount is required."}), 400
            data = convert_empty_to_none(data, ['description'])

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
                logging.warning(f"General expense with ID {expense_id} not found for update or no changes made.")
                return jsonify({"message": "Expense not found or no changes made"}), 404
            logging.info(f"General expense with ID {expense_id} updated successfully.")
            return jsonify({"message": "General expense updated successfully"}), 200

        elif request.method == 'DELETE':
            expense_id = request.args.get('id')
            if not expense_id:
                return jsonify({"message": "Expense ID is required for deletion"}), 400
            logging.debug(f"Deleting general expense with ID: {expense_id}")
            cur.execute("DELETE FROM general_expenses WHERE id = %s;", (expense_id,))
            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"General expense with ID {expense_id} not found for deletion.")
                return jsonify({"message": "Expense not found"}), 404
            logging.info(f"General expense with ID {expense_id} deleted successfully.")
            return jsonify({"message": "General expense deleted successfully"}), 200

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_general_expenses: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

# API for Calendar Events
@app.route('/api/calendar_events', methods=['GET', 'POST', 'PUT', 'DELETE']) # Added PUT and DELETE
def handle_calendar_events():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        if request.method == 'POST':
            data = request.json
            logging.debug(f"Received calendar event POST data: {data}")
            if not data.get('date'):
                return jsonify({"message": "Date is required."}), 400
            if not data.get('type'):
                return jsonify({"message": "Event type is required."}), 400
            data = convert_empty_to_none(data, ['description', 'lead_id', 'amount'])

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
            logging.info(f"Calendar event added successfully with ID: {new_event_id}")
            return jsonify({"message": "Calendar event added successfully", "id": new_event_id}), 201

        elif request.method == 'GET':
            event_id = request.args.get('id') # Allow fetching single event
            if event_id:
                logging.debug(f"Fetching calendar event with ID: {event_id}")
                cur.execute("""
                    SELECT ce.id, ce.date, ce.type, ce.description, ce.amount,
                           l.id AS lead_id, l.firstName, l.lastName, l.company
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    WHERE ce.id = %s;
                """, (event_id,))
                events = cur.fetchall()
            else:
                logging.debug("Fetching all calendar events with linked lead info.")
                # Explicitly select all columns from calendar_events and lead join
                cur.execute("""
                    SELECT ce.id, ce.date, ce.type, ce.description, ce.amount,
                           l.id AS lead_id, l.firstName, l.lastName, l.company
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    ORDER BY ce.date;
                """)
                events = cur.fetchall()

            # Format lead_name for display for all fetched events
            for event in events:
                # Robustly get first and last name, handling potential None from LEFT JOIN
                first_name = event.get('firstName') or ''
                last_name = event.get('lastName') or ''
                event['lead_name'] = f"{first_name} {last_name}".strip()
                event['company'] = event.get('company', None) # Ensure company is None if not present
                # Clean up unused fields from join if they are not needed on frontend
                event.pop('firstName', None)
                event.pop('lastName', None)
            logging.debug(f"Fetched calendar events: {events}")
            return jsonify(events), 200

        elif request.method == 'PUT': # NEW: Handle PUT requests for calendar events
            data = request.json
            logging.debug(f"Received calendar event PUT data: {data}")
            event_id = data.get('id')
            if not event_id:
                return jsonify({"message": "Event ID is required for update"}), 400
            if not data.get('date'):
                return jsonify({"message": "Date is required."}), 400
            if not data.get('type'):
                return jsonify({"message": "Event type is required."}), 400
            data = convert_empty_to_none(data, ['description', 'lead_id', 'amount'])

            cur.execute(
                """
                UPDATE calendar_events SET
                    date = %s, type = %s, description = %s, lead_id = %s, amount = %s
                WHERE id = %s;
                """,
                (data['date'], data['type'], data.get('description'),
                 data.get('lead_id'), data.get('amount', 0.00), event_id)
            )
            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"Calendar event with ID {event_id} not found for update or no changes made.")
                return jsonify({"message": "Calendar event not found or no changes made"}), 404
            logging.info(f"Calendar event with ID {event_id} updated successfully.")
            return jsonify({"message": "Calendar event updated successfully"}), 200

        elif request.method == 'DELETE': # NEW: Handle DELETE requests for calendar events
            event_id = request.args.get('id')
            if not event_id:
                return jsonify({"message": "Event ID is required for deletion"}), 400
            logging.debug(f"Deleting calendar event with ID: {event_id}")
            cur.execute("DELETE FROM calendar_events WHERE id = %s;", (event_id,))
            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"Calendar event with ID {event_id} not found for deletion.")
                return jsonify({"message": "Calendar event not found"}), 404
            logging.info(f"Calendar event with ID {event_id} deleted successfully.")
            return jsonify({"message": "Calendar event deleted successfully"}), 200

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

        # Fetch general expenses with a source identifier
        query_general = """
            SELECT id, date, 'General Expense' AS type_category, description, amount,
                   NULL AS lead_id, NULL AS firstName, NULL AS lastName, NULL AS company, 'general_expenses' AS source_table
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

        logging.debug(f"Executing query_general: {query_general} with params: {params_general}")
        cur.execute(query_general, params_general)
        general_expenses = cur.fetchall()
        logging.debug(f"Fetched general expenses: {general_expenses}")

        # Fetch ALL calendar_events with amount > 0, using LEFT JOIN for leads
        # This ensures visits with POSITIVE amounts are included
        query_calendar_expenses = """
            SELECT ce.id, ce.date, ce.type AS type_category, ce.description, ce.amount,
                   l.id AS lead_id, l.firstName, l.lastName, l.company, 'calendar_events' AS source_table
            FROM calendar_events ce
            LEFT JOIN leads l ON ce.lead_id = l.id
            WHERE ce.amount > 0
        """
        calendar_expense_params = []

        if start_date and end_date:
            query_calendar_expenses += " AND ce.date BETWEEN %s AND %s"
            calendar_expense_params.extend([start_date, end_date])
        elif start_date:
            query_calendar_expenses += " AND ce.date >= %s"
            calendar_expense_params.append(start_date)
        elif end_date:
            query_calendar_expenses += " AND ce.date <= %s"
            calendar_expense_params.append(end_date)

        logging.debug(f"Executing query_calendar_expenses: {query_calendar_expenses} with params: {calendar_expense_params}")
        cur.execute(query_calendar_expenses, calendar_expense_params)
        calendar_expenses = cur.fetchall()
        logging.debug(f"Fetched calendar expenses: {calendar_expenses}")

        # Combine and format results
        report_data = []
        for expense in general_expenses:
            report_data.append({
                "id": expense['id'],
                "date": str(expense['date']),
                "type_category": expense['type_category'],
                "description": expense['description'],
                "amount": float(expense['amount']),
                "lead_id": None, # Explicitly None for general expenses as they don't have a lead
                "lead_name": None, # Explicitly None for general expenses
                "company": None,     # Explicitly None for general expenses
                "source_table": expense['source_table']
            })
        for expense in calendar_expenses:
            # Handle lead_name and company for calendar events that might not have a linked lead
            # Use .get() with default to safely access keys from RealDictRow
            first_name = expense.get('firstName') or ''
            last_name = expense.get('lastName') or ''
            lead_full_name = f"{first_name} {last_name}".strip()
            report_data.append({
                "id": expense['id'],
                "date": str(expense['date']),
                "type_category": expense['type_category'],
                "description": expense['description'],
                "amount": float(expense['amount']),
                "lead_id": expense.get('lead_id'), # Include lead_id
                "lead_name": lead_full_name if lead_full_name else None,
                "company": expense.get('company', None) if expense.get('company', None) else None,
                "source_table": expense['source_table']
            })

        # Sort combined data by date
        report_data.sort(key=lambda x: x['date'], reverse=True)
        logging.debug(f"Combined expenditure report data: {report_data}")
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

        # Explicitly select all columns for consistency
        cur.execute("SELECT id, firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes, created_at FROM leads ORDER BY created_at DESC;")
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
                lead['id'], lead['firstName'], lead['lastName'], lead['title'], # Use correct casing for export
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

        # Modified query to use LEFT JOIN for calendar events with amounts
        query_calendar_expenses = """
            SELECT ce.date, ce.type AS type_category, ce.description, ce.amount,
                   l.firstName, l.lastName, l.company
            FROM calendar_events ce
            LEFT JOIN leads l ON ce.lead_id = l.id
            WHERE ce.amount > 0
        """
        params_calendar_expenses = []

        if start_date and end_date:
            query_calendar_expenses += " AND ce.date BETWEEN %s AND %s"
            params_calendar_expenses.extend([start_date, end_date])
        elif start_date:
            query_calendar_expenses += " AND ce.date >= %s"
            params_calendar_expenses.append(start_date)
        elif end_date:
            query_calendar_expenses += " AND ce.date <= %s"
            params_calendar_expenses.append(end_date)

        cur.execute(query_calendar_expenses, params_calendar_expenses)
        calendar_expenses = cur.fetchall()

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
        for item in calendar_expenses:
            # Handle cases where lead is not linked (firstName/lastName/company would be None)
            first_name = item.get('firstName') or ''
            last_name = item.get('lastName') or ''
            lead_full_name = f"{first_name} {last_name}".strip()
            report_data.append({
                'date': str(item['date']),
                'type_category': item['type_category'],
                'description': item['description'],
                'amount': float(item['amount']),
                'lead_name': lead_full_name if lead_full_name else None,
                'company': item.get('company', None) if item.get('company', None) else None
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
                item['lead_name'] if item['lead_name'] is not None else 'N/A', # Ensure N/A for CSV export
                item['company'] if item['company'] is not None else 'N/A'     # Ensure N/A for CSV export
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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
