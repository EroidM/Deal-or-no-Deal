import os
import csv
from flask import Flask, request, jsonify, render_template, Blueprint, send_from_directory, make_response
import psycopg2
from psycopg2 import extras
import logging
from dotenv import load_dotenv
from io import StringIO
from datetime import datetime, date
import json

# Configure logging to show INFO messages
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()

# Define the path to your project's root directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Initialize Flask app
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, 'static'))

# --- IMPORTANT: Create a Blueprint for node_modules static files ---
node_modules_bp = Blueprint(
    'node_modules_bp',
    __name__,
    static_url_path='/node_modules',
    static_folder=os.path.join(BASE_DIR, 'node_modules')
)
app.register_blueprint(node_modules_bp)

# --- Configuration for Database and Firebase ---
DATABASE_URL = os.getenv('DATABASE_URL')
FIREBASE_CONFIG = os.getenv('FIREBASE_CONFIG')
INITIAL_AUTH_TOKEN = os.getenv('INITIAL_AUTH_TOKEN')

# --- Database Connection Function ---
def get_db_connection():
    """Establishes a new database connection."""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        logging.info("Database connection successful.")
        return conn
    except psycopg2.Error as e:
        logging.error(f"Database connection error: {e}")
        return None

# --- Routes ---

@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('dynamic_dashboard.html')

@app.route('/firebase_config')
def firebase_config():
    """Provides the Firebase configuration and authentication token to the frontend."""
    if not FIREBASE_CONFIG or not INITIAL_AUTH_TOKEN:
        logging.error("Firebase environment variables are not set.")
        return jsonify({"error": "Firebase configuration not available"}), 500

    try:
        firebase_config_dict = json.loads(FIREBASE_CONFIG)
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse FIREBASE_CONFIG JSON: {e}")
        return jsonify({"error": "Invalid Firebase configuration format"}), 500

    config_data = {
        "firebaseConfig": firebase_config_dict,
        "initialAuthToken": INITIAL_AUTH_TOKEN
    }
    return jsonify(config_data)

@app.route('/api/leads', methods=['GET'])
def get_leads():
    """Fetches all leads from the database."""
    conn = get_db_connection()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT
                    l.id, l.full_name, l.email, l.phone, l.status, l.created_at,
                    c.name as company, c.email as company_email, c.phone as company_phone
                FROM leads l
                LEFT JOIN companies c ON l.company_id = c.id
                ORDER BY l.created_at DESC;
            """)
            leads = cur.fetchall()
            leads_list = [dict(row) for row in leads]
        return jsonify(leads_list)
    except psycopg2.Error as e:
        logging.error(f"Database error when fetching leads: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/expenditure_report', methods=['GET'])
def get_expenditure_report():
    """
    Generates and fetches the expenditure report from the database.
    Supports filtering by date range.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Base query
    query = """
        SELECT
            e.date,
            e.type_category,
            e.description,
            e.amount,
            l.full_name as lead_full_name,
            c.name as company
        FROM expenditures e
        LEFT JOIN leads l ON e.lead_id = l.id
        LEFT JOIN companies c ON l.company_id = c.id
    """
    params = []
    
    if start_date and end_date:
        query += " WHERE e.date BETWEEN %s AND %s"
        params.append(start_date)
        params.append(end_date)
    elif start_date:
        query += " WHERE e.date >= %s"
        params.append(start_date)
    elif end_date:
        query += " WHERE e.date <= %s"
        params.append(end_date)
    
    query += " ORDER BY e.date DESC"

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(query, tuple(params))
            report = cur.fetchall()
            report_list = [dict(row) for row in report]
        return jsonify(report_list)
    except psycopg2.Error as e:
        logging.error(f"Database error when fetching expenditure report: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/export_expenditure', methods=['GET'])
def export_expenditure_report():
    """
    Generates a CSV export of the expenditure report.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = """
        SELECT
            e.date, e.type_category, e.description, e.amount,
            l.full_name as lead_full_name, c.name as company
        FROM expenditures e
        LEFT JOIN leads l ON e.lead_id = l.id
        LEFT JOIN companies c ON l.company_id = c.id
    """
    params = []
    if start_date and end_date:
        query += " WHERE e.date BETWEEN %s AND %s"
        params.append(start_date)
        params.append(end_date)
    elif start_date:
        query += " WHERE e.date >= %s"
        params.append(start_date)
    elif end_date:
        query += " WHERE e.date <= %s"
        params.append(end_date)
    
    query += " ORDER BY e.date DESC"

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(query, tuple(params))
            report_data = cur.fetchall()

        si = StringIO()
        cw = csv.writer(si)

        cw.writerow(["Date", "Type/Category", "Description", "Amount (KSh)", "Lead Name", "Company"])
        for item in report_data:
            cw.writerow([
                item['date'],
                item['type_category'],
                item['description'],
                item['amount'],
                item['lead_full_name'] if item['lead_full_name'] else 'N/A',
                item['company'] if item['company'] else 'N/A'
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

# --- Service Worker & Manifest Routes (for PWA) ---
@app.route('/service-worker.js')
def serve_service_worker():
    """Serves the service worker file from the static directory."""
    return send_from_directory(app.static_folder, 'service-worker.js')

@app.route('/manifest.json')
def serve_manifest():
    """Serves the PWA manifest file from the static directory."""
    return send_from_directory(app.static_folder, 'manifest.json')

if __name__ == '__main__':
    # Use 0.0.0.0 to make the app accessible externally on Render
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 5000))
