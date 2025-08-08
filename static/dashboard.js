// dashboard.js - Rewritten for app-like navigation and improved structure

document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard.js: DOM Content Loaded. Initializing dashboard components.");

    // Global variables to hold fetched data for client-side operations like sorting
    let allLeads = [];
    let currentLeadsData = [];
    let currentExpenditureData = [];
    let calendarInstance; // To store the FullCalendar instance
    let leadsDataFetched = false;
    let expenditureDataFetched = false;
    let calendarDataFetched = false;
    let firebaseAppInitialized = false;

    // --- Utility Functions: Loading Spinner & Messages ---

    /**
     * Shows a global loading overlay to indicate ongoing operations.
     */
    function showLoading() {
        console.log("Dashboard.js: Showing loading spinner.");
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    /**
     * Hides the global loading overlay.
     */
    function hideLoading() {
        console.log("Dashboard.js: Hiding loading spinner.");
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    /**
     * Displays a temporary message to the user.
     * @param {string} message - The message text.
     * @param {'success'|'error'|'warning'} type - The type of message.
     */
    function showMessage(message, type = 'info') {
        const messageBox = document.getElementById('messageBox');
        const messageText = document.getElementById('messageText');
        if (messageBox && messageText) {
            messageText.textContent = message;
            messageBox.className = `message-box ${type} active`;
            setTimeout(() => {
                messageBox.classList.remove('active');
            }, 5000);
        }
    }

    // --- Firebase Initialization ---
    async function initializeFirebase() {
        try {
            console.log("Dashboard.js: Attempting to fetch Firebase config from /api/firebase_config");
            const response = await fetch('/api/firebase_config');
            if (!response.ok) {
                throw new Error(`Failed to fetch Firebase config: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            const { firebaseConfig, initialAuthToken } = data;

            if (Object.keys(firebaseConfig).length > 0) {
                console.log("Dashboard.js: Firebase config fetched successfully. Initializing app.");
                const app = firebase.initializeApp(firebaseConfig);
                const auth = firebase.auth();
                
                // Sign in with custom token
                if (initialAuthToken) {
                    await auth.signInWithCustomToken(initialAuthToken);
                    console.log("Dashboard.js: Signed in with custom token.");
                } else {
                    console.warn("Dashboard.js: No custom auth token found. User will be anonymous.");
                    await auth.signInAnonymously();
                }

                firebaseAppInitialized = true;
                console.log("Dashboard.js: Firebase app and auth initialized successfully.");
            } else {
                console.error("Dashboard.js: Firebase config object is empty.");
            }
        } catch (error) {
            console.error("Dashboard.js: Error initializing Firebase:", error);
            showMessage(`Error initializing app: ${error.message}`, 'error');
        }
    }

    // --- Navigation & View Management ---

    function showView(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        // Show the requested view
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.classList.add('active');
            console.log(`Switched to view: ${viewId}`);

            // Fetch data for the active view if not already fetched
            if (viewId === 'leads-view' && !leadsDataFetched) {
                fetchLeads();
            } else if (viewId === 'expenditure-report-view' && !expenditureDataFetched) {
                fetchExpenditureReport();
            } else if (viewId === 'calendar-view' && !calendarDataFetched) {
                fetchCalendarData();
            }
        } else {
            console.error(`View with id "${viewId}" not found.`);
        }
    }

    // Event listener for navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const viewId = this.getAttribute('data-view');
            showView(viewId);
            // Update active nav link styling
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // --- Data Fetching Functions ---

    /**
     * Fetches leads data from the server and renders the table.
     */
    async function fetchLeads() {
        showLoading();
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch leads: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const leads = await response.json();
            currentLeadsData = leads;
            allLeads = leads;
            renderLeadsTable(currentLeadsData);
            leadsDataFetched = true;
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Error fetching leads.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Fetches the expenditure report, optionally with a date range.
     * @param {string} [startDate] - Start date for filtering.
     * @param {string} [endDate] - End date for filtering.
     */
    async function fetchExpenditureReport(startDate = null, endDate = null) {
        showLoading();
        let url = '/api/expenditure_report';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch expenditure report: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const reportData = await response.json();
            currentExpenditureData = reportData;
            renderExpenditureReportTable(currentExpenditureData);
            expenditureDataFetched = true;
        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            showMessage('Error fetching expenditure report.', 'error');
        } finally {
            hideLoading();
        }
    }

    // --- Render Functions ---

    /**
     * Renders the leads table with provided data.
     * @param {Array} data - The leads data to render.
     */
    function renderLeadsTable(data) {
        const tableBody = document.querySelector('#recentLeadsTable tbody');
        if (tableBody) {
            tableBody.innerHTML = ''; // Clear existing rows
            if (data && data.length > 0) {
                data.forEach(lead => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${lead.full_name}</td>
                        <td>${lead.company}</td>
                        <td>${lead.status}</td>
                        <td>${lead.value}</td>
                        <td>${new Date(lead.created_at).toLocaleDateString()}</td>
                    `;
                    tableBody.appendChild(row);
                });
            } else {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No leads found.</td></tr>';
            }
        }
    }

    /**
     * Renders the expenditure report table.
     * @param {Array} data - The expenditure data to render.
     */
    function renderExpenditureReportTable(data) {
        const tableBody = document.querySelector('#expenditureReportTable tbody');
        if (tableBody) {
            tableBody.innerHTML = ''; // Clear existing rows
            if (data && data.length > 0) {
                let totalAmount = 0;
                data.forEach(item => {
                    totalAmount += parseFloat(item.amount);
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(item.expenditure_date).toLocaleDateString()}</td>
                        <td>${item.expenditure_type}</td>
                        <td>${item.description}</td>
                        <td>${item.amount.toFixed(2)}</td>
                    `;
                    tableBody.appendChild(row);
                });
                // Add a total row
                const totalRow = document.createElement('tr');
                totalRow.className = 'total-row';
                totalRow.innerHTML = `
                    <td colspan="3"><strong>Total Expenditure</strong></td>
                    <td><strong>${totalAmount.toFixed(2)}</strong></td>
                `;
                tableBody.appendChild(totalRow);
            } else {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No expenditure data found.</td></tr>';
            }
        }
    }


    // --- Event Listener Setup ---

    // Initial data load for Firebase and Overview
    initializeFirebase().then(() => {
        // Fetch leads after Firebase is initialized
        fetchLeads();
    });

    // Set up click handlers for the export buttons
    document.getElementById('exportExpenditureReportBtn').addEventListener('click', function() {
        window.location.href = '/api/export_expenditure_report';
    });
});
