import os
from flask import Flask, request, jsonify, render_template, Blueprint, send_from_directory
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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

# --- Configuration for Firebase ---
# This pulls the Firebase config from environment variables
FIREBASE_CONFIG = os.getenv('FIREBASE_CONFIG')
INITIAL_AUTH_TOKEN = os.getenv('INITIAL_AUTH_TOKEN')

# --- Routes ---

@app.route('/')
def index():
    """
    Renders the main dashboard page.
    """
    logging.info("Serving dynamic_dashboard.html")
    return render_template('dynamic_dashboard.html')

@app.route('/firebase_config')
def firebase_config():
    """
    Provides the Firebase configuration and authentication token to the frontend.
    """
    if not FIREBASE_CONFIG or not INITIAL_AUTH_TOKEN:
        logging.error("Firebase environment variables are not set.")
        return jsonify({"error": "Firebase configuration not available"}), 500

    config_data = {
        "firebaseConfig": FIREBASE_CONFIG,
        "initialAuthToken": INITIAL_AUTH_TOKEN
    }
    return jsonify(config_data)

# --- Service Worker & Manifest Routes (for PWA) ---
@app.route('/service-worker.js')
def serve_service_worker():
    """
    Serves the service worker file from the static directory.
    """
    logging.info("Serving service-worker.js")
    return send_from_directory(app.static_folder, 'service-worker.js')

@app.route('/manifest.json')
def serve_manifest():
    """
    Serves the PWA manifest file from the static directory.
    """
    logging.info("Serving manifest.json")
    return send_from_directory(app.static_folder, 'manifest.json')

if __name__ == '__main__':
    # Use 0.0.0.0 to make the app accessible externally on Render
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 5000))
