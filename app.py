import os
import json
from flask import Flask, request, jsonify, render_template, Blueprint, make_response
import logging
from dotenv import load_dotenv

# Configure logging to show DEBUG messages
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()

# Define the path to your project's root directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Initialize Flask app
# Ensure static_folder points to the correct location for all your static assets
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
# Your Firebase config and auth token will be provided by the Canvas environment.
# We'll expose these through a simple endpoint for the frontend to consume.
# The `get_firebase_config_and_token` function retrieves these from the global scope.
def get_firebase_config_and_token():
    config = os.getenv('__firebase_config')
    token = os.getenv('__initial_auth_token')
    return config, token

# --- Routes ---

@app.route('/')
def home():
    """
    Renders the main dashboard HTML page.
    """
    return render_template('dynamic_dashboard.html')

@app.route('/firebase_config')
def firebase_config_endpoint():
    """
    A simple endpoint to provide the Firebase configuration and auth token
    to the frontend. This is crucial for initializing Firebase on the client-side.
    """
    try:
        config_str, token_str = get_firebase_config_and_token()
        
        if not config_str or not token_str:
            logging.error("Firebase config or auth token not found in environment.")
            # Return an error response if the configuration is missing
            return jsonify({"error": "Firebase configuration not available"}), 500

        config = json.loads(config_str)
        token = token_str

        return jsonify({
            'firebaseConfig': config,
            'initialAuthToken': token
        })

    except json.JSONDecodeError as e:
        logging.error(f"Failed to decode Firebase config JSON: {e}")
        return jsonify({"error": "Failed to decode Firebase configuration"}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": "Internal server error"}), 500

# Placeholder for future routes (e.g., for serving a PWA service worker or manifest)
# The existing PWA routes from your original code will still work here,
# as they don't depend on the database logic.
@app.route('/manifest.json')
def manifest():
    return send_from_directory(app.static_folder, 'manifest.json')

@app.route('/service-worker.js')
def service_worker():
    response = make_response(send_from_directory(app.static_folder, 'service-worker.js'))
    response.headers['Content-Type'] = 'application/javascript'
    return response

if __name__ == '__main.name__':
    app.run(debug=True)
