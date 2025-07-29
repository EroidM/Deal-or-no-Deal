import os
from flask import Flask, request, jsonify, render_template, Blueprint, send_from_directory, make_response
import psycopg2
from psycopg2 import extras
import logging
from dotenv import load_dotenv
import csv
from io import StringIO
from datetime import datetime, date # Import date specifically

# Configure logging to show DEBUG messages
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()

# Define the path to your project's root directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Initialize Flask app
# Ensure static_folder points to the correct location for all your static assets
# This will serve files from the 'static' directory, including manifest.json and service-worker.js
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
            # Create leads table with new columns
            # IMPORTANT: Changed full_name to NOT NULL in CREATE TABLE, but ALTER TABLE ADD COLUMN
            # does not add a NOT NULL constraint by default, which is safer for existing data.
            # If you have existing leads without full_name, they will remain NULL.
            # New leads will require full_name.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS leads (
                    id SERIAL PRIMARY KEY,
                    full_name VARCHAR(255), -- Removed NOT NULL here for safer migration
                    email VARCHAR(255),
                    phone VARCHAR(255),
                    stage VARCHAR(255) NOT NULL,
                    source VARCHAR(255),
                    notes TEXT,
                    last_follow_up DATE,
                    next_follow_up DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Add new columns to leads table if they don't exist (these will be nullable by default)
            cur.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);")
            cur.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(255);")
            cur.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_follow_up DATE;")
            cur.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up DATE;")

            # Create general_expenses table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS general_expenses (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    amount NUMERIC(10, 2) NOT NULL,
                    description TEXT NOT NULL,
                    type_category VARCHAR(255) DEFAULT 'General Expense',
                    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
                    company VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Add new columns to general_expenses table if they don't exist
            cur.execute("ALTER TABLE general_expenses ADD COLUMN IF NOT EXISTS type_category VARCHAR(255) DEFAULT 'General Expense';")
            cur.execute("ALTER TABLE general_expenses ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL;")
            cur.execute("ALTER TABLE general_expenses ADD COLUMN IF NOT EXISTS company VARCHAR(255);")


            # Create calendar_events table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id SERIAL PRIMARY KEY,
                    date TIMESTAMP NOT NULL,
                    type VARCHAR(255) NOT NULL,
                    description TEXT,
                    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
                    amount NUMERIC(10, 2) DEFAULT 0.00,
                    end_date TIMESTAMP,
                    company VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Add new columns to calendar_events table if they don't exist
            cur.execute("ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;")
            cur.execute("ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS company VARCHAR(255);")


            conn.commit()
            cur.close()
            logging.info("Database tables checked/created/updated successfully.")
    except psycopg2.Error as e:
        logging.error(f"Database initialization error: {e}")
    finally:
        if conn:
            conn.close()

# Ensure database tables are initialized when the app starts
with app.app_context():
    init_db()

# Helper to convert empty strings to None for nullable fields
def convert_empty_to_none(data, fields):
    for field in fields:
        if field in data and (data[field] == '' or data[field] is None):
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

            # Validate required fields for POST
            if not data.get('full_name') or data.get('full_name').strip() == '':
                return jsonify({"message": "Full Name is required."}), 400
            if not data.get('stage') or data.get('stage').strip() == '':
                return jsonify({"message": "Stage is required."}), 400

            data = convert_empty_to_none(data, ['email', 'phone', 'source', 'notes', 'last_follow_up', 'next_follow_up'])

            cur.execute(
                """
                INSERT INTO leads (full_name, email, phone, stage, source, notes, last_follow_up, next_follow_up)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
                """,
                (data['full_name'], data.get('email'), data.get('phone'), data['stage'],
                 data.get('source'), data.get('notes'), data.get('last_follow_up'), data.get('next_follow_up'))
            )
            new_lead_id = cur.fetchone()['id']
            conn.commit()
            logging.info(f"Lead added successfully with ID: {new_lead_id}")
            return jsonify({"message": "Lead added successfully", "id": new_lead_id}), 201

        elif request.method == 'GET':
            lead_id = request.args.get('id')
            if lead_id:
                logging.debug(f"Fetching lead with ID: {lead_id}")
                cur.execute("SELECT id, full_name, email, phone, stage, source, notes, last_follow_up, next_follow_up, created_at FROM leads WHERE id = %s;", (lead_id,))
                leads = cur.fetchall()
            else:
                logging.debug("Fetching all leads.")
                cur.execute("SELECT id, full_name, email, phone, stage, source, notes, last_follow_up, next_follow_up, created_at FROM leads ORDER BY created_at DESC;")
                leads = cur.fetchall()

            # Format dates for JSON output
            for lead in leads:
                if lead['last_follow_up']:
                    lead['last_follow_up'] = lead['last_follow_up'].isoformat()
                if lead['next_follow_up']:
                    lead['next_follow_up'] = lead['next_follow_up'].isoformat()
            logging.debug(f"Raw leads data fetched from DB in handle_leads GET: {leads}")
            return jsonify(leads), 200

        elif request.method == 'PUT':
            data = request.json
            logging.debug(f"Received lead PUT data: {data}")
            lead_id = data.get('id')
            if not lead_id:
                return jsonify({"message": "Lead ID is required for update"}), 400

            # Validate required fields for PUT
            if not data.get('full_name') or data.get('full_name').strip() == '':
                return jsonify({"message": "Full Name is required."}), 400
            if not data.get('stage') or data.get('stage').strip() == '':
                return jsonify({"message": "Stage is required."}), 400

            data = convert_empty_to_none(data, ['email', 'phone', 'source', 'notes', 'last_follow_up', 'next_follow_up'])

            cur.execute(
                """
                UPDATE leads SET
                    full_name = %s, email = %s, phone = %s, stage = %s,
                    source = %s, notes = %s, last_follow_up = %s, next_follow_up = %s
                WHERE id = %s;
                """,
                (data['full_name'], data.get('email'), data.get('phone'), data['stage'],
                 data.get('source'), data.get('notes'), data.get('last_follow_up'), data.get('next_follow_up'), lead_id)
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

# NEW API for combined Expenditure (General Expenses + Calendar Events with Amount)
@app.route('/api/expenditure', methods=['POST', 'PUT', 'DELETE'])
def handle_expenditure():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        if request.method == 'POST':
            data = request.json
            logging.debug(f"Received expenditure POST data: {data}")
            if not data.get('date'):
                return jsonify({"message": "Date is required."}), 400
            if data.get('amount') is None: # Check for None explicitly as 0 is valid
                return jsonify({"message": "Amount is required."}), 400
            if not data.get('type_category'):
                return jsonify({"message": "Type/Category is required."}), 400

            data = convert_empty_to_none(data, ['description', 'lead_id', 'company'])

            if data['type_category'] == 'General Expense':
                cur.execute(
                    """
                    INSERT INTO general_expenses (date, amount, description, type_category, lead_id, company)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;
                    """,
                    (data['date'], data['amount'], data['description'], data['type_category'], data['lead_id'], data['company'])
                )
            else: # Other types like 'Visit', 'Meeting', 'Call' etc. with amounts
                # These are stored in calendar_events
                cur.execute(
                    """
                    INSERT INTO calendar_events (date, type, description, lead_id, amount, company)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;
                    """,
                    (data['date'], data['type_category'], data['description'], data['lead_id'], data['amount'], data['company'])
                )
            new_id = cur.fetchone()['id']
            conn.commit()
            logging.info(f"Expenditure added successfully with ID: {new_id} (Type: {data['type_category']})")
            return jsonify({"message": "Expenditure added successfully", "id": new_id}), 201

        elif request.method == 'PUT':
            data = request.json
            logging.debug(f"Received expenditure PUT data: {data}")
            item_id = data.get('id')
            if not item_id:
                return jsonify({"message": "Expenditure ID is required for update"}), 400
            if not data.get('date'):
                return jsonify({"message": "Date is required."}), 400
            if data.get('amount') is None: # Check for None explicitly
                return jsonify({"message": "Amount is required."}), 400
            if not data.get('type_category'):
                return jsonify({"message": "Type/Category is required."}), 400

            data = convert_empty_to_none(data, ['description', 'lead_id', 'company'])

            if data['type_category'] == 'General Expense':
                cur.execute(
                    """
                    UPDATE general_expenses SET
                        date = %s, amount = %s, description = %s, type_category = %s, lead_id = %s, company = %s
                    WHERE id = %s;
                    """,
                    (data['date'], data['amount'], data['description'], data['type_category'], data['lead_id'], data['company'], item_id)
                )
            else: # Other types from calendar_events
                cur.execute(
                    """
                    UPDATE calendar_events SET
                        date = %s, type = %s, description = %s, lead_id = %s, amount = %s, company = %s
                    WHERE id = %s;
                    """,
                    (data['date'], data['type_category'], data['description'], data['lead_id'], data['amount'], data['company'], item_id)
                )
            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"Expenditure with ID {item_id} not found for update or no changes made.")
                return jsonify({"message": "Expenditure not found or no changes made"}), 404
            logging.info(f"Expenditure with ID {item_id} updated successfully.")
            return jsonify({"message": "Expenditure updated successfully"}), 200

        elif request.method == 'DELETE':
            item_id = request.args.get('id')
            source_table = request.args.get('source_table') # Frontend must send this
            if not item_id or not source_table:
                return jsonify({"message": "ID and source_table are required for deletion"}), 400

            if source_table == 'general_expenses':
                cur.execute("DELETE FROM general_expenses WHERE id = %s;", (item_id,))
            elif source_table == 'calendar_events':
                cur.execute("DELETE FROM calendar_events WHERE id = %s;", (item_id,))
            else:
                return jsonify({"message": "Invalid source table for deletion"}), 400

            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"Expenditure with ID {item_id} from {source_table} not found for deletion.")
                return jsonify({"message": "Expenditure not found"}), 404
            logging.info(f"Expenditure with ID {item_id} from {source_table} deleted successfully.")
            return jsonify({"message": "Expenditure deleted successfully"}), 200

    except psycopg2.Error as e:
        logging.error(f"Database error in handle_expenditure: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

# API for Calendar Events (updated for FullCalendar's event object structure)
@app.route('/api/calendar_events', methods=['GET', 'POST', 'PUT', 'DELETE'])
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
            if not data.get('title'):
                return jsonify({"message": "Event title is required."}), 400
            if not data.get('start'):
                return jsonify({"message": "Start date/time is required."}), 400

            # Map frontend 'title', 'start', 'end' to backend 'description', 'date', 'end_date'
            event_type = data.get('type') or 'Other' # Fallback if type not explicitly sent from form
            
            # Attempt to derive type from title if not explicitly provided or if it's generic
            if not data.get('type') or data.get('type') == 'Other':
                title_lower = data['title'].lower()
                if 'meeting' in title_lower: event_type = 'Meeting'
                elif 'visit' in title_lower: event_type = 'Visit'
                elif 'call' in title_lower: event_type = 'Call'
                elif 'email' in title_lower: event_type = 'Email'
                elif 'cold visit' in title_lower: event_type = 'Cold Visit'
                elif 'office day' in title_lower: event_type = 'Office Day Note'
                elif 'expense' in title_lower: event_type = 'General Expense'
                else: event_type = 'Other' # Default if no keyword match

            cur.execute(
                """
                INSERT INTO calendar_events (date, type, description, lead_id, amount, end_date, company)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
                """,
                (data['start'], event_type, data['title'], data.get('lead_id'), data.get('amount', 0.00), data.get('end'), data.get('company'))
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
                    SELECT ce.id, ce.date, ce.type, ce.description, ce.amount, ce.end_date, ce.company,
                           l.id AS lead_id, l.full_name AS lead_full_name
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    WHERE ce.id = %s;
                """, (event_id,))
                events = cur.fetchall()
            else:
                logging.debug("Fetching all calendar events with linked lead info.")
                cur.execute("""
                    SELECT ce.id, ce.date, ce.type, ce.description, ce.amount, ce.end_date, ce.company,
                           l.id AS lead_id, l.full_name AS lead_full_name
                    FROM calendar_events ce
                    LEFT JOIN leads l ON ce.lead_id = l.id
                    ORDER BY ce.date;
                """)
                events = cur.fetchall()

            # Format events for FullCalendar (map DB fields to FC event object)
            formatted_events = []
            for event in events:
                # Ensure date/time fields are ISO formatted strings, handle None
                start_date = event['date'].isoformat() if event['date'] else None
                end_date = event['end_date'].isoformat() if event['end_date'] else None

                lead_name = event['lead_full_name'] if event['lead_full_name'] else 'N/A'
                company_name = event['company'] if event['company'] else 'N/A'

                formatted_events.append({
                    'id': event['id'],
                    'title': event['description'], # FullCalendar uses 'title' for display text
                    'start': start_date,
                    'end': end_date,
                    'extendedProps': { # Custom properties for FullCalendar
                        'type': event['type'],
                        'lead_id': event['lead_id'],
                        'lead_name': lead_name,
                        'company': company_name,
                        'amount': float(event['amount']) if event['amount'] is not None else 0.00
                    }
                })
            logging.debug(f"Fetched and formatted calendar events: {formatted_events}")
            return jsonify(formatted_events), 200

        elif request.method == 'PUT':
            data = request.json
            logging.debug(f"Received calendar event PUT data: {data}")
            event_id = data.get('id')
            if not event_id:
                return jsonify({"message": "Event ID is required for update"}), 400
            if not data.get('title'):
                return jsonify({"message": "Event title is required."}), 400
            if not data.get('start'):
                return jsonify({"message": "Start date/time is required."}), 400

            event_type = data.get('type') or 'Other' # Fallback if type not explicitly sent from form
            if not data.get('type') or data.get('type') == 'Other':
                title_lower = data['title'].lower()
                if 'meeting' in title_lower: event_type = 'Meeting'
                elif 'visit' in title_lower: event_type = 'Visit'
                elif 'call' in title_lower: event_type = 'Call'
                elif 'email' in title_lower: event_type = 'Email'
                elif 'cold visit' in title_lower: event_type = 'Cold Visit'
                elif 'office day' in title_lower: event_type = 'Office Day Note'
                elif 'expense' in title_lower: event_type = 'General Expense'
                else: event_type = 'Other'

            cur.execute(
                """
                UPDATE calendar_events SET
                    date = %s, type = %s, description = %s, lead_id = %s, amount = %s, end_date = %s, company = %s
                WHERE id = %s;
                """,
                (data['start'], event_type, data['title'], data.get('lead_id'), data.get('amount', 0.00), data.get('end'), data.get('company'), event_id)
            )
            conn.commit()
            if cur.rowcount == 0:
                logging.warning(f"Calendar event with ID {event_id} not found for update or no changes made.")
                return jsonify({"message": "Calendar event not found or no changes made"}), 404
            logging.info(f"Calendar event with ID {event_id} updated successfully.")
            return jsonify({"message": "Calendar event updated successfully"}), 200

        elif request.method == 'DELETE':
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

# API for Expenditure Report (GET only, combines general_expenses and calendar_events with amount > 0)
@app.route('/api/expenditure_report', methods=['GET'])
def get_expenditure_report():
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        # Base query for general expenses
        query_general = """
            SELECT id, date, type_category, description, amount,
                   lead_id, company, 'general_expenses' AS source_table
            FROM general_expenses
        """
        params_general = []

        # Base query for calendar events with amount > 0
        query_calendar_expenses = """
            SELECT ce.id, ce.date, ce.type AS type_category, ce.description, ce.amount, ce.company,
                   l.id AS lead_id, l.full_name AS lead_full_name,
                   'calendar_events' AS source_table
            FROM calendar_events ce
            LEFT JOIN leads l ON ce.lead_id = l.id
            WHERE ce.amount > 0
        """
        params_calendar_expenses = []

        # Add date filtering
        if start_date_str and end_date_str:
            query_general += " WHERE date BETWEEN %s AND %s"
            params_general.extend([start_date_str, end_date_str])
            query_calendar_expenses += " AND ce.date BETWEEN %s AND %s"
            params_calendar_expenses.extend([start_date_str, end_date_str])
        elif start_date_str:
            query_general += " WHERE date >= %s"
            params_general.append(start_date_str)
            query_calendar_expenses += " AND ce.date >= %s"
            params_calendar_expenses.append(start_date_str)
        elif end_date_str:
            query_general += " WHERE date <= %s"
            params_general.append(end_date_str)
            query_calendar_expenses += " AND ce.date <= %s"
            params_calendar_expenses.append(end_date_str)

        logging.debug(f"Executing query_general: {query_general} with params: {params_general}")
        cur.execute(query_general, params_general)
        general_expenses = cur.fetchall()
        logging.debug(f"Fetched general expenses: {general_expenses}")

        logging.debug(f"Executing query_calendar_expenses: {query_calendar_expenses} with params: {params_calendar_expenses}")
        cur.execute(query_calendar_expenses, params_calendar_expenses)
        calendar_expenses = cur.fetchall()
        logging.debug(f"Fetched raw calendar expenses with lead info: {calendar_expenses}")

        # Combine and format results
        report_data = []
        for item in general_expenses:
            report_data.append({
                "id": item['id'],
                "date": str(item['date']),
                "type_category": item['type_category'],
                "description": item['description'],
                "amount": float(item['amount']),
                "lead_id": item['lead_id'], # Can be None
                "lead_name": None, # General expenses don't directly link to lead_name from leads table
                "company": item['company'] if item['company'] else 'N/A', # Ensure N/A if company is None
                "source_table": item['source_table']
            })
        for item in calendar_expenses:
            report_data.append({
                "id": item['id'],
                "date": str(item['date'].date()) if isinstance(item['date'], datetime) else str(item['date']), # Handle datetime or date objects
                "type_category": item['type_category'],
                "description": item['description'],
                "amount": float(item['amount']),
                "lead_id": item['lead_id'], # Can be None
                "lead_name": item['lead_full_name'] if item['lead_full_name'] else 'N/A',
                "company": item['company'] if item['company'] else 'N/A', # Now correctly fetched from calendar_events
                "source_table": item['source_table']
            })

        # Sort combined data by date
        report_data.sort(key=lambda x: x['date'], reverse=True)
        logging.debug(f"Final combined expenditure report data: {report_data}")
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

        # Select all new columns for export
        cur.execute("SELECT id, full_name, email, phone, stage, source, notes, last_follow_up, next_follow_up, created_at FROM leads ORDER BY created_at DESC;")
        leads = cur.fetchall()

        si = StringIO()
        cw = csv.writer(si)

        # Write header
        cw.writerow([
            "ID", "Full Name", "Email", "Phone", "Stage", "Source",
            "Notes", "Last Follow-up", "Next Follow-up", "Created At"
        ])

        # Write data
        for lead in leads:
            cw.writerow([
                lead['id'],
                lead['full_name'] if lead['full_name'] else 'N/A', # Ensure N/A for CSV export
                lead['email'] if lead['email'] else 'N/A',
                lead['phone'] if lead['phone'] else 'N/A',
                lead['stage'],
                lead['source'] if lead['source'] else 'N/A',
                lead['notes'] if lead['notes'] else 'N/A',
                lead['last_follow_up'].isoformat() if lead['last_follow_up'] else 'N/A',
                lead['next_follow_up'].isoformat() if lead['next_follow_up'] else 'N/A',
                lead['created_at'].isoformat()
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

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        # Fetch general expenses with a source identifier
        query_general = """
            SELECT date, type_category, description, amount,
                   lead_id, company, 'general_expenses' AS source_table
            FROM general_expenses
        """
        params_general = []

        # Fetch calendar_events with amount > 0, using LEFT JOIN for leads
        query_calendar_expenses = """
            SELECT ce.date, ce.type AS type_category, ce.description, ce.amount,
                   l.full_name AS lead_full_name, ce.company,
                   'calendar_events' AS source_table
            FROM calendar_events ce
            LEFT JOIN leads l ON ce.lead_id = l.id
            WHERE ce.amount > 0
        """
        params_calendar_expenses = []

        # Add date filtering
        if start_date_str and end_date_str:
            query_general += " WHERE date BETWEEN %s AND %s"
            params_general.extend([start_date_str, end_date_str])
            query_calendar_expenses += " AND ce.date BETWEEN %s AND %s"
            params_calendar_expenses.extend([start_date_str, end_date_str])
        elif start_date_str:
            query_general += " WHERE date >= %s"
            params_general.append(start_date_str)
            query_calendar_expenses += " AND ce.date >= %s"
            params_calendar_expenses.append(start_date_str)
        elif end_date_str:
            query_general += " WHERE date <= %s"
            params_general.append(end_date_str)
            query_calendar_expenses += " AND ce.date <= %s"
            params_calendar_expenses.append(end_date_str)

        cur.execute(query_general, params_general)
        general_expenses = cur.fetchall()

        cur.execute(query_calendar_expenses, params_calendar_expenses)
        calendar_expenses = cur.fetchall()

        report_data = []
        for item in general_expenses:
            report_data.append({
                'date': str(item['date']),
                'type_category': item['type_category'],
                'description': item['description'],
                'amount': float(item['amount']),
                'lead_name': item['lead_name'] if item['lead_name'] else 'N/A',
                'company': item['company'] if item['company'] else 'N/A'
            })
        for item in calendar_expenses:
            report_data.append({
                'date': str(item['date'].date()) if isinstance(item['date'], datetime) else str(item['date']),
                'type_category': item['type_category'],
                'description': item['description'],
                'amount': float(item['amount']),
                'lead_name': item['lead_full_name'] if item['lead_full_name'] else 'N/A',
                'company': item['company'] if item['company'] else 'N/A'
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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
