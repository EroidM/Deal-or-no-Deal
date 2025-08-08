// dashboard.js - Rewritten to use Firebase Firestore for a real-time,
// serverless-like architecture. All data operations now happen directly
// from the client to the database.

document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard.js: DOM Content Loaded. Initializing dashboard components with Firebase.");

    // --- Global Variables ---
    // These will hold our data, which will be populated in real-time by Firestore listeners.
    let allLeads = [];
    let currentLeadsData = [];
    let currentExpenditureData = [];
    let calendarEventsData = [];
    let calendarInstance;
    let auth;
    let db;
    let userId = null;

    // --- Firebase Initialization & Authentication ---
    // The firebaseConfig and initialAuthToken variables are fetched from the backend
    // and exposed to the global scope in dynamic_dashboard.html.
    const firebaseApp = firebase.initializeApp(window.firebaseConfig);
    db = firebaseApp.firestore();
    auth = firebaseApp.auth();

    auth.signInWithCustomToken(window.initialAuthToken).then((userCredential) => {
        // User is signed in. This is the main entry point after authentication.
        userId = userCredential.user.uid;
        console.log("Firebase: User signed in successfully with UID:", userId);
        
        // IMPORTANT: All real-time listeners should be set up here, after auth is successful.
        // This ensures we're only fetching data when we know who the user is.
        setupFirestoreListeners();

        // Display user ID for debugging and collaboration purposes
        document.getElementById('userIdDisplay').textContent = `User ID: ${userId}`;
    }).catch((error) => {
        console.error("Firebase: Error during sign-in:", error);
        showMessage(`Authentication failed. Please refresh the page.`, 'error');
        // Fallback or error handling for authentication failure
    });


    // --- Utility Functions: Loading Spinner & Messages ---

    /**
     * Shows a global loading overlay.
     */
    function showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    /**
     * Hides the global loading overlay.
     */
    function hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    /**
     * Displays a temporary message to the user.
     * @param {string} message - The message text.
     * @param {'success'|'error'|'warning'} type - The type of message for styling.
     */
    function showMessage(message, type = 'info') {
        const messageBox = document.getElementById('messageBox');
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = `message-box active ${type}`;
            setTimeout(() => {
                messageBox.classList.remove('active');
            }, 5000);
        }
    }


    // --- Firestore Real-time Listeners ---
    // This is the core of the new data fetching logic. We use onSnapshot to get
    // real-time updates without having to manually refresh the page or make new API calls.
    function setupFirestoreListeners() {
        // Leads Listener
        db.collection(`artifacts/${__app_id}/users/${userId}/leads`).orderBy('created_at', 'desc').onSnapshot(snapshot => {
            currentLeadsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            allLeads = [...currentLeadsData]; // Keep a copy for filtering
            renderLeadsTable(currentLeadsData);
            updateOverviewStats();
            populateLeadDropdowns(currentLeadsData);
            console.log("Firestore: Leads data updated in real-time.");
            hideLoading();
        }, error => {
            console.error("Firestore: Error fetching leads:", error);
            showMessage('Error fetching leads.', 'error');
            hideLoading();
        });

        // Expenditure Listener
        db.collection(`artifacts/${__app_id}/users/${userId}/expenditure`).orderBy('date', 'desc').onSnapshot(snapshot => {
            currentExpenditureData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            renderExpenditureReportTable(currentExpenditureData);
            updateOverviewStats();
            renderLeadsAndExpenditureChart();
            console.log("Firestore: Expenditure data updated in real-time.");
            hideLoading();
        }, error => {
            console.error("Firestore: Error fetching expenditure report:", error);
            showMessage('Error fetching expenditure report.', 'error');
            hideLoading();
        });

        // Calendar Events Listener
        db.collection(`artifacts/${__app_id}/users/${userId}/calendar_events`).orderBy('start', 'asc').onSnapshot(snapshot => {
            calendarEventsData = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                start: doc.data().start.toDate(), // Convert Firestore Timestamp to JS Date
                end: doc.data().end ? doc.data().end.toDate() : null
            }));
            updateCalendarEvents(calendarEventsData);
            updateOverviewStats();
            console.log("Firestore: Calendar events updated in real-time.");
            hideLoading();
        }, error => {
            console.error("Firestore: Error fetching calendar events:", error);
            showMessage('Error fetching calendar events.', 'error');
            hideLoading();
        });
    }

    // --- Firestore CRUD Functions ---

    /**
     * Adds a new lead to Firestore.
     * @param {object} leadData - The data for the new lead.
     */
    async function addLead(leadData) {
        showLoading();
        try {
            await db.collection(`artifacts/${__app_id}/users/${userId}/leads`).add(leadData);
            showMessage('Lead added successfully!', 'success');
        } catch (error) {
            console.error("Error adding lead: ", error);
            showMessage('Failed to add lead.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Adds a new expenditure record to Firestore.
     * @param {object} expenditureData - The data for the new expenditure.
     */
    async function addExpenditure(expenditureData) {
        showLoading();
        try {
            await db.collection(`artifacts/${__app_id}/users/${userId}/expenditure`).add(expenditureData);
            showMessage('Expenditure added successfully!', 'success');
        } catch (error) {
            console.error("Error adding expenditure: ", error);
            showMessage('Failed to add expenditure.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Adds a new calendar event to Firestore.
     * @param {object} eventData - The data for the new event.
     */
    async function addCalendarEvent(eventData) {
        showLoading();
        try {
            await db.collection(`artifacts/${__app_id}/users/${userId}/calendar_events`).add(eventData);
            showMessage('Event added successfully!', 'success');
        } catch (error) {
            console.error("Error adding event: ", error);
            showMessage('Failed to add event.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Deletes a document from a specified collection.
     * @param {string} collectionPath - The path to the collection.
     * @param {string} docId - The ID of the document to delete.
     */
    async function deleteDocument(collectionPath, docId) {
        showLoading();
        try {
            await db.collection(collectionPath).doc(docId).delete();
            showMessage('Item deleted successfully!', 'success');
        } catch (error) {
            console.error("Error deleting document: ", error);
            showMessage('Failed to delete item.', 'error');
        } finally {
            hideLoading();
        }
    }


    // --- Rendering & UI Functions ---

    /**
     * Renders the leads data into the table.
     * @param {Array<object>} data - The leads data to render.
     */
    function renderLeadsTable(data) {
        const tableBody = document.querySelector('#recentLeadsTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No leads found.</td></tr>';
            return;
        }
        data.forEach(lead => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${lead.full_name}</td>
                <td>${lead.email}</td>
                <td>${lead.phone}</td>
                <td>${lead.company}</td>
                <td>${lead.status}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${lead.id}" data-type="lead">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        });
    }
    
    /**
     * Renders the expenditure report data into the table.
     * @param {Array<object>} data - The expenditure data to render.
     */
    function renderExpenditureReportTable(data) {
        const tableBody = document.querySelector('#expenditureReportTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No expenditure records found.</td></tr>';
            return;
        }
        data.forEach(item => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.type_category}</td>
                <td>${item.description}</td>
                <td>${item.amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}" data-type="expenditure">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        });
    }

    /**
     * Populates the lead dropdowns for events and other forms.
     * @param {Array<object>} leads - The leads data.
     */
    function populateLeadDropdowns(leads) {
        const eventLeadSelect = document.getElementById('eventLeadId');
        if (!eventLeadSelect) return;
        eventLeadSelect.innerHTML = '<option value="">-- No Lead --</option>'; // Default option
        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            option.textContent = `${lead.full_name} (${lead.company || 'N/A'})`;
            eventLeadSelect.appendChild(option);
        });
    }
    
    /**
     * Updates the stat cards on the overview page.
     */
    function updateOverviewStats() {
        const totalLeadsCount = document.getElementById('totalLeadsCount');
        if (totalLeadsCount) totalLeadsCount.textContent = allLeads.length;

        const totalExpensesAmount = document.getElementById('totalExpensesAmount');
        if (totalExpensesAmount) {
            const total = currentExpenditureData.reduce((sum, item) => sum + parseFloat(item.amount), 0);
            totalExpensesAmount.textContent = total.toLocaleString('en-KE', { style: 'currency', currency: 'KES' });
        }
        
        const upcomingEventsCount = document.getElementById('upcomingEventsCount');
        if (upcomingEventsCount) {
            const now = new Date();
            const upcoming = calendarEventsData.filter(event => new Date(event.start) > now);
            upcomingEventsCount.textContent = upcoming.length;
        }
    }

    // Chart.js instance for the overview chart
    let leadsAndExpenditureChart;

    /**
     * Renders the leads and expenditure chart.
     */
    function renderLeadsAndExpenditureChart() {
        const ctx = document.getElementById('leadsAndExpenditureChart')?.getContext('2d');
        if (!ctx) return;
        
        // Destroy old chart instance if it exists
        if (leadsAndExpenditureChart) {
            leadsAndExpenditureChart.destroy();
        }

        const dates = [...new Set([
            ...currentLeadsData.map(l => new Date(l.created_at).toISOString().split('T')[0]),
            ...currentExpenditureData.map(e => new Date(e.date).toISOString().split('T')[0])
        ])].sort();

        const leadsByDay = dates.map(date => currentLeadsData.filter(l => new Date(l.created_at).toISOString().split('T')[0] === date).length);
        const expensesByDay = dates.map(date => currentExpenditureData.filter(e => new Date(e.date).toISOString().split('T')[0] === date).reduce((sum, e) => sum + parseFloat(e.amount), 0));
        
        leadsAndExpenditureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'New Leads',
                    data: leadsByDay,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    yAxisID: 'y'
                }, {
                    label: 'Daily Expenditure (KSh)',
                    data: expensesByDay,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                stacked: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Leads & Expenditure Over Time'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Number of Leads'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false, // only want the grid lines for the first y-axis
                        },
                        title: {
                            display: true,
                            text: 'Amount (KSh)'
                        }
                    },
                }
            }
        });
    }

    /**
     * Initializes the FullCalendar instance.
     */
    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        
        // Check if a calendar instance already exists and destroy it to prevent duplicates
        if (calendarInstance) {
            calendarInstance.destroy();
        }

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: calendarEventsData,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek,dayGridDay'
            },
            dateClick: (info) => {
                // You can add logic here to open a modal for adding events
                console.log('Date clicked:', info.dateStr);
                // For now, let's just pre-fill the form with the date
                document.getElementById('eventStartDate').value = info.dateStr + ' 09:00';
            },
            eventClick: (info) => {
                // Logic to show event details or edit it
                console.log('Event clicked:', info.event.title);
            },
            eventDidMount: (info) => {
                // Add tooltip on hover
                const eventTooltip = document.createElement('div');
                eventTooltip.classList.add('calendar-tooltip');
                eventTooltip.innerHTML = `
                    <strong>${info.event.title}</strong>
                    <p>Start: ${new Date(info.event.start).toLocaleString()}</p>
                    ${info.event.end ? `<p>End: ${new Date(info.event.end).toLocaleString()}</p>` : ''}
                `;
                document.body.appendChild(eventTooltip);

                info.el.addEventListener('mouseenter', () => {
                    const rect = info.el.getBoundingClientRect();
                    eventTooltip.style.display = 'block';
                    eventTooltip.style.left = `${rect.left + window.scrollX}px`;
                    eventTooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
                });
                info.el.addEventListener('mouseleave', () => {
                    eventTooltip.style.display = 'none';
                });
            }
        });
        calendarInstance.render();
    }

    /**
     * Updates the FullCalendar instance with new events data.
     * @param {Array<object>} events - The new events data.
     */
    function updateCalendarEvents(events) {
        if (calendarInstance) {
            calendarInstance.removeAllEvents();
            calendarInstance.addEventSource(events.map(event => ({
                ...event,
                id: event.id,
                title: event.title,
                start: event.start,
                end: event.end,
                backgroundColor: 'var(--secondary-color)', // Example styling
                borderColor: 'var(--secondary-color)',
            })));
        }
    }


    // --- Event Listeners and Form Submission Handlers ---

    // Navigation and View switching
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector('.nav-link.active')?.classList.remove('active');
            this.classList.add('active');
            
            const viewId = this.getAttribute('data-view');
            document.querySelectorAll('.view-content').forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById(viewId)?.classList.add('active');

            // Trigger specific functions when a view is activated
            if (viewId === 'calendar-view') {
                initCalendar();
            }
        });
    });

    // Mobile Navigation
    document.getElementById('hamburger')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('active');
        document.getElementById('mainContent')?.classList.toggle('expanded');
    });

    // Lead Form Submission
    document.getElementById('addLeadForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const leadData = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            company: formData.get('company'),
            status: formData.get('status'),
            created_at: new Date()
        };
        addLead(leadData);
        this.reset();
    });
    
    // Expenditure Form Submission
    document.getElementById('addExpenditureForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const expenditureData = {
            date: new Date(formData.get('date')),
            type_category: formData.get('type_category'),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount'))
        };
        addExpenditure(expenditureData);
        this.reset();
    });
    
    // Event Form Submission
    document.getElementById('addEventForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const eventData = {
            title: formData.get('title'),
            start: new Date(formData.get('start_date')),
            end: formData.get('end_date') ? new Date(formData.get('end_date')) : null,
            lead_id: formData.get('lead_id') || null,
            amount: parseFloat(formData.get('amount')) || 0
        };
        addCalendarEvent(eventData);
        this.reset();
    });

    // Dynamic Deletion for tables
    document.addEventListener('click', function(event) {
        const target = event.target.closest('.delete-btn');
        if (target) {
            const itemId = target.dataset.id;
            const itemType = target.dataset.type;
            let collectionPath;

            if (itemType === 'lead') {
                collectionPath = `artifacts/${__app_id}/users/${userId}/leads`;
            } else if (itemType === 'expenditure') {
                collectionPath = `artifacts/${__app_id}/users/${userId}/expenditure`;
            } else {
                return;
            }
            // Use a custom modal for confirmation instead of alert()
            const isConfirmed = confirm(`Are you sure you want to delete this ${itemType}?`);
            if (isConfirmed) {
                deleteDocument(collectionPath, itemId);
            }
        }
    });

    // Flatpickr for date inputs
    flatpickr(".datetime-picker", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
    });

    flatpickr("#expenditureDate", {
        dateFormat: "Y-m-d",
    });

    // Date range filter for expenditure
    const expenditureFilter = flatpickr("#expenditureFilterDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const filteredData = currentExpenditureData.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= startDate && itemDate <= endDate;
                });
                renderExpenditureReportTable(filteredData);
            } else if (selectedDates.length === 0) {
                // If the range is cleared, show all data
                renderExpenditureReportTable(currentExpenditureData);
            }
        }
    });
    
    // Download CSV
    document.getElementById('downloadExpenditureReport')?.addEventListener('click', function() {
        if (!currentExpenditureData.length) {
            showMessage('No data to export.', 'warning');
            return;
        }

        const headers = ["Date", "Type/Category", "Description", "Amount (KSh)"];
        const dataRows = currentExpenditureData.map(item => [
            new Date(item.date).toLocaleDateString(),
            item.type_category,
            item.description,
            item.amount
        ]);

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\n";
        dataRows.forEach(row => {
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "expenditure_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

