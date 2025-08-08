# app.py - Updated to use a dedicated Firebase config endpoint and improved error handling

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

# Configure logging to show DEBUG messages
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

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

# --- Configuration ---
DATABASE_URL = os.getenv('DATABASE_URL')
# Firebase config variables from .env
FIREBASE_CONFIG = {
    "apiKey": os.getenv('apiKey', '').strip().strip("'\""),
    "appId": os.getenv('appId', '').strip().strip("'\""),
    "authDomain": os.getenv('authDomain', '').strip().strip("'\""),
    "measurementId": os.getenv('measurementId', '').strip().strip("'\""),
    "messagingSenderId": os.getenv('messagingSenderId', '').strip().strip("'\""),
    "projectId": os.getenv('projectId', '').strip().strip("'\""),
    "storageBucket": os.getenv('storageBucket', '').strip().strip("'\""),
}
INITIAL_AUTH_TOKEN = os.getenv('initial_auth_token', '').strip().strip("'\"")

def get_db_connection():
    """Establishes a new database connection."""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except psycopg2.OperationalError as e:
        logging.error(f"Failed to connect to database: {e}")
        raise e

@app.route('/')
def home():
    return "Welcome to the Sales & Marketing Dashboard Backend."

@app.route('/dashboard')
def render_dashboard():
    """Renders the main dashboard page."""
    logging.debug("Rendering dynamic_dashboard.html")
    return render_template('dynamic_dashboard.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files from the 'static' directory."""
    return send_from_directory(app.static_folder, filename)

@app.route('/api/firebase_config')
def get_firebase_config():
    """API endpoint to serve the Firebase configuration."""
    logging.debug("Serving Firebase configuration via API.")
    return jsonify({
        "firebaseConfig": FIREBASE_CONFIG,
        "initialAuthToken": INITIAL_AUTH_TOKEN
    })

@app.route('/api/leads', methods=['GET'])
def get_leads():
    """Fetch and return all leads data."""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT * FROM leads ORDER BY created_at DESC;")
        leads = cur.fetchall()
        logging.debug(f"Fetched {len(leads)} leads.")
        return jsonify([dict(lead) for lead in leads])
    except psycopg2.OperationalError as e:
        logging.error(f"Database connection error: {e}")
        return jsonify({"message": "Database connection error."}), 500
    except psycopg2.Error as e:
        logging.error(f"Database error when fetching leads: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return jsonify({"message": f"An unexpected error occurred: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/expenditure_report', methods=['GET'])
def get_expenditure_report():
    """
    Fetches and returns expenditure report data, optionally filtered by date range.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        query = "SELECT * FROM expenditures"
        params = []
        if start_date_str and end_date_str:
            query += " WHERE expenditure_date BETWEEN %s AND %s"
            params.extend([start_date_str, end_date_str])
        
        query += " ORDER BY expenditure_date DESC;"
        
        cur.execute(query, tuple(params))
        report_data = cur.fetchall()
        logging.debug(f"Fetched {len(report_data)} expenditure items.")

        # Convert DictRow to standard dict for jsonify
        report_list = [dict(item) for item in report_data]
        return jsonify(report_list)

    except psycopg2.OperationalError as e:
        logging.error(f"Database connection error: {e}")
        return jsonify({"message": "Database connection error."}), 500
    except psycopg2.Error as e:
        logging.error(f"Database error when fetching expenditure report: {e}")
        return jsonify({"message": f"Database error: {e}"}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return jsonify({"message": f"An unexpected error occurred: {e}"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/export_expenditure_report')
def export_expenditure_report():
    """
    Export expenditure report as a CSV file.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT e.*, l.full_name as lead_full_name, l.company FROM expenditures e LEFT JOIN leads l ON e.lead_id = l.lead_id;")
        expenditure_items = cur.fetchall()

        report_data = []
        for item in expenditure_items:
            report_data.append({
                'date': item['expenditure_date'].isoformat(),
                'type_category': item['expenditure_type'] if item['expenditure_type'] else 'N/A',
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


@app.route('/api/add_expenditure', methods=['POST'])
def add_expenditure():
    """API endpoint to add a new expenditure."""
    conn = None
    try:
        data = request.json
        if not all(k in data for k in ['expenditure_date', 'expenditure_type', 'description', 'amount']):
            return jsonify({'message': 'Missing required fields'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        sql = "INSERT INTO expenditures (expenditure_date, expenditure_type, description, amount, lead_id) VALUES (%s, %s, %s, %s, %s);"
        cur.execute(sql, (
            data['expenditure_date'],
            data['expenditure_type'],
            data['description'],
            data['amount'],
            data.get('lead_id')
        ))
        conn.commit()
        
        return jsonify({"message": "Expenditure added successfully"}), 201
    
    except psycopg2.OperationalError as e:
        logging.error(f"Database connection error: {e}")
        return jsonify({"message": "Database connection error."}), 500
    except psycopg2.Error as e:
        logging.error(f"Database error when adding expenditure: {e}")
        return jsonify({'message': f'Database error: {e}'}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return jsonify({'message': f'An unexpected error occurred: {e}'}), 500
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=8000)

