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
     * @param {'success'|'error'|'warning'} type - The type of message for styling.
     */
    function showMessage(message, type) {
        const messageBox = document.getElementById('messageBox');
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = `message-box show ${type}`; // Reset classes and add new ones
            setTimeout(() => {
                messageBox.classList.remove('show');
            }, 3000); // Message disappears after 3 seconds
        }
    }

    // --- Modal Management ---
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // Clear form fields when closing, if it's a form modal
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                // Reset hidden IDs for edit forms
                const hiddenIdInput = form.querySelector('input[type="hidden"][name$="_id"]');
                if (hiddenIdInput) {
                    hiddenIdInput.value = '';
                }
                // Also reset the 'id' field for the addEventForm if it's being used for editing
                const eventIdInput = form.querySelector('#eventId');
                if (eventIdInput) {
                    eventIdInput.value = '';
                }
            }
        }
    }

    // Attach close button listeners to all modals
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', function() {
            closeModal(this.closest('.modal').id);
        });
    });

    // Close modal when clicking outside the content
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // --- Navigation Logic ---
    function showView(viewId) {
        console.log(`Dashboard.js: Switching to view: ${viewId}`);
        document.querySelectorAll('.dashboard-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(viewId).classList.add('active');

        // Update active state of bottom navigation buttons
        document.querySelectorAll('.nav-button').forEach(button => {
            if (button.dataset.view === viewId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Fetch data for the activated view if not already fetched
        if (viewId === 'leads-view' && !leadsDataFetched) {
            fetchLeads();
        } else if (viewId === 'expenditure-view' && !expenditureDataFetched) {
            fetchExpenditureReport();
        } else if (viewId === 'calendar-view' && !calendarDataFetched) {
            fetchCalendarEvents();
        }
    }

    // Attach event listeners to bottom navigation buttons
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default link behavior
            const viewId = this.dataset.view;
            showView(viewId);
        });
    });

    // Attach event listeners to header buttons to open modals
    document.getElementById('addLeadButton')?.addEventListener('click', () => {
        document.getElementById('addLeadForm').reset(); // Clear form for new entry
        openModal('addLeadModal');
    });
    document.getElementById('addExpenditureButton')?.addEventListener('click', () => {
        document.getElementById('addExpenditureForm').reset(); // Clear form
        populateLeadDropdowns('expenditureLeadId'); // Populate lead dropdown for new expense
        openModal('addExpenditureModal');
    });
    document.getElementById('addEventButton')?.addEventListener('click', () => {
        document.getElementById('addEventForm').reset(); // Clear form
        // Clear the hidden eventId field when opening for a new event
        const eventIdInput = document.getElementById('eventId');
        if (eventIdInput) eventIdInput.value = '';
        populateLeadDropdowns('eventLeadId'); // Populate lead dropdown for new event
        openModal('addEventModal');
    });


    // --- Data Fetching Functions ---

    /**
     * Fetches leads data from the API and updates the dashboard.
     */
    async function fetchLeads() {
        showLoading();
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Dashboard.js: Leads data received:", data);
            
            // Map the new lead structure to what the frontend expects
            allLeads = data.map(lead => ({
                id: lead.id,
                fullName: lead.full_name || '', // Use full_name
                email: lead.email,
                phone: lead.phone,
                stage: lead.stage,
                source: lead.source,
                notes: lead.notes,
                lastFollowUp: lead.last_follow_up, // New field
                nextFollowUp: lead.next_follow_up, // New field
            }));
            currentLeadsData = [...allLeads]; // Initialize current data for sorting/filtering
            
            renderLeadsTable(currentLeadsData);
            updateLeadStatistics(allLeads);
            updateLeadsByStageChart(allLeads);
            updateUpcomingFollowUps(allLeads);
            populateLeadDropdowns('expenditureLeadId'); // Populate for expenditure modal
            populateLeadDropdowns('eventLeadId'); // Populate for event modal
            populateLeadDropdowns('editExpenditureLeadId'); // Populate for edit expense modal

            leadsDataFetched = true; // Mark as fetched
        } catch (error) {
            console.error("Dashboard.js: Error fetching leads:", error);
            showMessage(`Error fetching leads: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Fetches calendar events from the API.
     */
    async function fetchCalendarEvents() {
        showLoading();
        try {
            const response = await fetch('/api/calendar_events');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const events = await response.json();
            console.log("Dashboard.js: Calendar events data received:", events);
            // Log the raw events data to inspect its structure
            console.log("Dashboard.js: Raw calendar events for inspection:", JSON.stringify(events, null, 2));

            renderCalendar(events);
            calendarDataFetched = true; // Mark as fetched
        } catch (error) {
            console.error("Dashboard.js: Error fetching calendar events:", error);
            showMessage(`Error fetching calendar events: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Fetches expenditure report data from the API.
     * @param {string} startDate - Optional start date for filtering (YYYY-MM-DD).
     * @param {string} endDate - Optional end date for filtering (YYYY-MM-DD).
     */
    async function fetchExpenditureReport(startDate = null, endDate = null) {
        showLoading();
        let url = '/api/expenditure_report';
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        console.log(`Dashboard.js: Fetching expenditure report (Start: ${startDate || 'N/A'}, End: ${endDate || 'N/A'})...`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Dashboard.js: Expenditure report data received:", data);
            currentExpenditureData = data; // Store for client-side operations
            renderExpenditureReportTable(data);
            calculateTotalExpenditure(data);
            expenditureDataFetched = true; // Mark as fetched
        } catch (error) {
            console.error("Dashboard.js: Error fetching expenditure report:", error);
            showMessage(`Error fetching expenditure report: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    // --- Rendering Functions ---

    /**
     * Renders the recent leads table.
     * @param {Array} leads - Array of lead objects.
     */
    function renderLeadsTable(leads) {
        const tableBody = document.querySelector('#recentLeadsTable tbody');
        if (!tableBody) {
            console.error("Dashboard.js: Leads table body not found.");
            return;
        }
        tableBody.innerHTML = ''; // Clear existing rows

        if (leads.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-muted" style="text-align: center;">No leads found.</td></tr>';
            console.log("Dashboard.js: No leads to render.");
            return;
        }

        leads.forEach(lead => {
            const row = tableBody.insertRow();
            row.dataset.leadId = lead.id; // Store ID for actions

            row.innerHTML = `
                <td data-label="Full Name">${lead.fullName || 'N/A'}</td>
                <td data-label="Email">${lead.email || 'N/A'}</td>
                <td data-label="Phone">${lead.phone || 'N/A'}</td>
                <td data-label="Stage">${lead.stage || 'N/A'}</td>
                <td data-label="Source">${lead.source || 'N/A'}</td>
                <td data-label="Notes">${lead.notes || 'N/A'}</td>
                <td data-label="Last Follow-up">${lead.lastFollowUp || 'N/A'}</td>
                <td data-label="Next Follow-up">${lead.nextFollowUp || 'N/A'}</td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-info edit-lead-btn" data-id="${lead.id}" title="Edit Lead"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger delete-lead-btn" data-id="${lead.id}" title="Delete Lead"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
        console.log("Dashboard.js: Leads table rendered.");
        attachLeadActionListeners();
    }

    /**
     * Renders the expenditure report table.
     * @param {Array} reportData - Array of expenditure report items.
     */
    function renderExpenditureReportTable(reportData) {
        const tableBody = document.querySelector('#expenditureReportTable tbody');
        if (!tableBody) {
            console.error("Dashboard.js: Expenditure report table body not found.");
            return;
        }
        tableBody.innerHTML = ''; // Clear existing rows

        if (reportData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align: center;">No expenditure records found for the selected period.</td></tr>';
            console.log("Dashboard.js: No expenditure records to render.");
            return;
        }

        reportData.forEach(item => {
            const row = tableBody.insertRow();
            row.dataset.id = item.id; // Store ID for actions
            row.dataset.sourceTable = item.source_table; // Store source table for correct deletion

            row.innerHTML = `
                <td data-label="Date">${item.date || 'N/A'}</td>
                <td data-label="Type/Category">${item.type_category || 'N/A'}</td>
                <td data-label="Description">${item.description || 'N/A'}</td>
                <td data-label="Amount (KSh)">KSh ${item.amount ? item.amount.toFixed(2) : '0.00'}</td>
                <td data-label="Lead Name">${item.lead_name || 'N/A'}</td>
                <td data-label="Company">${item.company || 'N/A'}</td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-info edit-expense-btn" data-id="${item.id}" data-source="${item.source_table}" title="Edit Expense"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger delete-expense-btn" data-id="${item.id}" data-source="${item.source_table}" title="Delete Expense"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
        console.log("Dashboard.js: Expenditure report table rendered.");
        attachExpenditureActionListeners();
    }

    /**
     * Renders the FullCalendar instance with events.
     * @param {Array} events - Array of calendar event objects.
     */
    function renderCalendar(events) {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) {
            console.error("Dashboard.js: Calendar element not found.");
            return;
        }

        if (calendarInstance) {
            calendarInstance.destroy(); // Destroy existing instance before re-rendering
        }

        // --- DEBUGGING: Log FullCalendar components ---
        console.log("DEBUG: FullCalendar core object:", typeof FullCalendar, FullCalendar);
        console.log("DEBUG: FullCalendar.dayGrid plugin object:", typeof FullCalendar.dayGrid, FullCalendar.dayGrid);
        console.log("DEBUG: FullCalendar.interaction plugin object:", typeof FullCalendar.interaction, FullCalendar.interaction);
        // --- END DEBUGGING ---

        // Filter and map events to ensure they are well-formed for FullCalendar
        const formattedEvents = events.filter(event => {
            // Basic check: ensure event object itself exists and has core properties
            if (!event || typeof event.id === 'undefined' || typeof event.title === 'undefined' || typeof event.start === 'undefined') {
                console.warn('Skipping malformed event (missing id, title, or start):', event);
                return false;
            }
            // Ensure extendedProps exists
            if (!event.extendedProps) {
                event.extendedProps = {}; // Initialize if missing
            }
            // Ensure type is a string
            if (typeof event.extendedProps.type === 'undefined' || event.extendedProps.type === null) {
                event.extendedProps.type = 'Other';
            }
            // Ensure amount is a number
            if (typeof event.extendedProps.amount === 'undefined' || event.extendedProps.amount === null) {
                event.extendedProps.amount = 0.00;
            } else {
                event.extendedProps.amount = parseFloat(event.extendedProps.amount);
            }
            return true; // Keep the event if it passes checks
        }).map(event => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            extendedProps: {
                type: event.extendedProps.type,
                lead_id: event.extendedProps.lead_id,
                lead_name: event.extendedProps.lead_name,
                company: event.extendedProps.company,
                amount: event.extendedProps.amount
            },
            // Ensure classNames is robust against null/undefined type
            classNames: [`fc-event-${event.extendedProps.type ? event.extendedProps.type.toLowerCase().replace(/\s/g, '-') : 'other'}`]
        }));

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            plugins: [FullCalendar.dayGrid, FullCalendar.interaction],
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'addEventButton' // Custom button for adding events
            },
            customButtons: {
                addEventButton: {
                    text: 'Add Event',
                    click: function() {
                        document.getElementById('addEventForm').reset(); // Clear form
                        // Clear the hidden eventId field when opening for a new event
                        const eventIdInput = document.getElementById('eventId');
                        if (eventIdInput) eventIdInput.value = '';
                        populateLeadDropdowns('eventLeadId'); // Populate lead dropdown
                        openModal('addEventModal');
                    }
                }
            },
            events: formattedEvents, // Use the now filtered and formatted events
            eventDidMount: function(info) {
                // Add tooltip on hover
                const tooltip = document.getElementById('calendarTooltip');
                info.el.addEventListener('mouseover', function() {
                    let tooltipContent = `<strong>${info.event.title}</strong>`;
                    if (info.event.extendedProps.type) {
                        tooltipContent += `<span>Type: ${info.event.extendedProps.type}</span>`;
                    }
                    if (info.event.extendedProps.lead_name && info.event.extendedProps.lead_name !== 'N/A') {
                        tooltipContent += `<span>Lead: ${info.event.extendedProps.lead_name}</span>`;
                    }
                    if (info.event.extendedProps.company && info.event.extendedProps.company !== 'N/A') {
                        tooltipContent += `<span>Company: ${info.event.extendedProps.company}</span>`;
                    }
                    if (info.event.extendedProps.amount && info.event.extendedProps.amount > 0) {
                        tooltipContent += `<span>Amount: KSh ${info.event.extendedProps.amount.toFixed(2)}</span>`;
                    }
                    tooltip.innerHTML = tooltipContent;
                    tooltip.style.opacity = 1;
                    tooltip.style.transform = 'translateY(0)';
                });

                info.el.addEventListener('mousemove', function(e) {
                    tooltip.style.left = (e.pageX + 10) + 'px';
                    tooltip.style.top = (e.pageY + 10) + 'px';
                });

                info.el.addEventListener('mouseout', function() {
                    tooltip.style.opacity = 0;
                    tooltip.style.transform = 'translateY(10px)';
                });
            },
            eventClick: function(info) {
                // Open event modal for editing
                const eventId = info.event.id;
                const eventData = info.event.extendedProps;
                const eventTitle = info.event.title;
                const eventStart = info.event.start;
                const eventEnd = info.event.end;

                // Populate edit modal fields
                document.getElementById('eventId').value = eventId; // Hidden ID for update
                document.getElementById('eventTitle').value = eventTitle;
                // Flatpickr instances need to be updated
                if (flatpickrInstances['eventStart']) {
                    flatpickrInstances['eventStart'].setDate(eventStart);
                } else {
                    document.getElementById('eventStart').value = eventStart ? new Date(eventStart).toISOString().slice(0, 16) : '';
                }
                if (flatpickrInstances['eventEnd']) {
                    flatpickrInstances['eventEnd'].setDate(eventEnd);
                } else {
                    document.getElementById('eventEnd').value = eventEnd ? new Date(eventEnd).toISOString().slice(0, 16) : '';
                }
                
                document.getElementById('eventAmount').value = eventData.amount || '0.00';
                document.getElementById('eventCompany').value = eventData.company || ''; // Populate company field
                
                populateLeadDropdowns('eventLeadId', eventData.lead_id); // Populate and select lead

                openModal('addEventModal'); // Use the addEventModal for editing
            }
        });
        calendarInstance.render();
        console.log("Dashboard.js: FullCalendar initialized and rendered.");
    }

    /**
     * Updates the lead statistics cards.
     * @param {Array} leads - Array of lead objects.
     */
    function updateLeadStatistics(leads) {
        document.getElementById('totalLeadsCount').textContent = leads.length;
        document.getElementById('prospectingLeadsCount').textContent = leads.filter(l => l.stage === 'Prospecting').length;
        document.getElementById('negotiationLeadsCount').textContent = leads.filter(l => l.stage === 'Negotiation').length;
        document.getElementById('closedWonLeadsCount').textContent = leads.filter(l => l.stage === 'Closed Won').length;
        document.getElementById('closedLostLeadsCount').textContent = leads.filter(l => l.stage === 'Closed Lost').length;
        document.getElementById('totalFollowupsCount').textContent = leads.filter(l => l.nextFollowUp && new Date(l.nextFollowUp) >= new Date()).length;
        console.log("Dashboard.js: Lead statistics updated.");
    }

    /**
     * Updates the Leads by Stage Chart.
     * @param {Array} leads - Array of lead objects.
     */
    let leadsByStageChartInstance = null;
    function updateLeadsByStageChart(leads) {
        const ctx = document.getElementById('leadsByStageChart').getContext('2d');
        const stageCounts = leads.reduce((acc, lead) => {
            acc[lead.stage] = (acc[lead.stage] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(stageCounts);
        const data = Object.values(stageCounts);

        if (leadsByStageChartInstance) {
            leadsByStageChartInstance.destroy(); // Destroy existing chart instance
        }

        leadsByStageChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#4CAF50', '#2196F3', '#FFCA28', '#EF5350', '#9E9E9E', '#795548' // Custom colors
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 12,
                                family: 'Segoe UI'
                            }
                        }
                    },
                    title: {
                        display: false,
                        text: 'Leads by Stage'
                    }
                }
            }
        });
        console.log("Dashboard.js: Leads by Stage Chart updated.");
    }

    /**
     * Updates the upcoming follow-ups list.
     * @param {Array} leads - Array of lead objects.
     */
    function updateUpcomingFollowUps(leads) {
        const listContainer = document.getElementById('upcomingFollowUpsList');
        if (!listContainer) {
            console.error("Dashboard.js: Upcoming follow-ups list container not found.");
            return;
        }
        listContainer.innerHTML = ''; // Clear existing items

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const upcoming = leads.filter(lead => {
            if (!lead.nextFollowUp) return false;
            const followUpDate = new Date(lead.nextFollowUp);
            followUpDate.setHours(0, 0, 0, 0);
            return followUpDate >= today;
        }).sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp)); // Sort by date

        if (upcoming.length === 0) {
            listContainer.innerHTML = '<p class="text-muted" style="text-align: center;">No upcoming follow-ups.</p>';
            console.log("Dashboard.js: No upcoming follow-ups.");
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'upcoming-followups-list';
        upcoming.forEach(lead => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="lead-name">${lead.fullName}</span>
                <span class="followup-details">Follow-up: ${lead.nextFollowUp}</span>
                <span class="followup-details">Stage: ${lead.stage}</span>
            `;
            ul.appendChild(li);
        });
        listContainer.appendChild(ul);
        console.log("Dashboard.js: Upcoming follow-ups list updated.");
    }

    /**
     * Calculates and displays total expenditure.
     * @param {Array} reportData - Array of expenditure report items.
     */
    function calculateTotalExpenditure(reportData) {
        const totalElement = document.getElementById('totalExpenditureSummary');
        if (!totalElement) {
            console.error("Dashboard.js: Total expenditure summary element not found.");
            return;
        }
        const total = reportData.reduce((sum, item) => sum + item.amount, 0);
        totalElement.textContent = `Total Expenditure: KSh ${total.toFixed(2)}`;
    }

    /**
     * Populates lead dropdowns in modals.
     * @param {string} dropdownId - The ID of the select element.
     * @param {number} [selectedLeadId=null] - Optional ID of the lead to pre-select.
     */
    function populateLeadDropdowns(dropdownId, selectedLeadId = null) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) {
            console.warn(`Dashboard.js: Lead dropdown with ID ${dropdownId} not found.`);
            return;
        }
        dropdown.innerHTML = '<option value="">-- Select Lead (Optional) --</option>'; // Default option

        allLeads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            option.textContent = `${lead.fullName}`; // Removed company here as it's not directly on lead anymore
            if (selectedLeadId && lead.id === selectedLeadId) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        });
        console.log(`Dashboard.js: Lead dropdown ${dropdownId} populated.`);
    }

    // --- Form Submission Handlers ---

    // Add Lead Form
    document.getElementById('addLeadForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        showLoading();

        const formData = new FormData(this);
        const leadData = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            stage: formData.get('stage'),
            source: formData.get('source'),
            notes: formData.get('notes'),
            last_follow_up: formData.get('last_follow_up') || null,
            next_follow_up: formData.get('next_follow_up') || null
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadData)
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(result.message, 'success');
                closeModal('addLeadModal');
                fetchLeads(); // Refresh leads data
            } else {
                showMessage(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error("Dashboard.js: Error adding lead:", error);
            showMessage(`Network error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });

    // Edit Lead Form
    document.getElementById('editLeadForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        showLoading();

        const leadId = document.getElementById('editLeadId').value;
        const formData = new FormData(this);
        const leadData = {
            id: leadId,
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            stage: formData.get('stage'),
            source: formData.get('source'),
            notes: formData.get('notes'),
            last_follow_up: formData.get('last_follow_up') || null,
            next_follow_up: formData.get('next_follow_up') || null
        };

        try {
            const response = await fetch('/api/leads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadData)
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(result.message, 'success');
                closeModal('editLeadModal');
                fetchLeads(); // Refresh leads data
            } else {
                showMessage(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error("Dashboard.js: Error updating lead:", error);
            showMessage(`Network error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });

    // Add Expenditure Form
    document.getElementById('addExpenditureForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        showLoading();

        const formData = new FormData(this);
        const expenditureData = {
            date: formData.get('date'),
            type_category: formData.get('type_category'),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            lead_id: formData.get('lead_id') || null,
            company: formData.get('company') || null // Ensure company is sent
        };

        try {
            const response = await fetch('/api/expenditure', { // Using a new endpoint for combined expenditure
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenditureData)
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(result.message, 'success');
                closeModal('addExpenditureModal');
                fetchExpenditureReport(); // Refresh report
                fetchCalendarEvents(); // Refresh calendar if it was a calendar-based expense
            } else {
                showMessage(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error("Dashboard.js: Error adding expenditure:", error);
            showMessage(`Network error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });

    // Edit Expenditure Form
    document.getElementById('editExpenditureForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        showLoading();

        const expenditureId = document.getElementById('editExpenditureId').value;
        const formData = new FormData(this);
        const expenditureData = {
            id: expenditureId,
            date: formData.get('date'),
            type_category: formData.get('type_category'),
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            lead_id: formData.get('lead_id') || null,
            company: formData.get('company') || null // Ensure company is sent
        };

        try {
            const response = await fetch('/api/expenditure', { // Using a new endpoint for combined expenditure
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenditureData)
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(result.message, 'success');
                closeModal('editExpenditureModal');
                fetchExpenditureReport(); // Refresh report
                fetchCalendarEvents(); // Refresh calendar if it was a calendar-based expense
            } else {
                showMessage(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error("Dashboard.js: Error updating expenditure:", error);
            showMessage(`Network error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });

    // Add Event Form (for Calendar)
    document.getElementById('addEventForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        showLoading();

        const formData = new FormData(this);
        const eventData = {
            id: formData.get('id') || null, // For updating existing event
            title: formData.get('title'),
            start: formData.get('start_time'),
            end: formData.get('end_time') || null,
            lead_id: formData.get('lead_id') || null,
            amount: parseFloat(formData.get('amount')) || 0.00,
            company: formData.get('company') || null // Now correctly gets company from form
        };

        const method = eventData.id ? 'PUT' : 'POST';
        const url = '/api/calendar_events'; // ID passed in body for PUT

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(result.message, 'success');
                closeModal('addEventModal'); // Use the correct modal ID
                fetchCalendarEvents(); // Refresh calendar events
                fetchExpenditureReport(); // Refresh expenditure if event had amount
            } else {
                showMessage(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error("Dashboard.js: Error adding/updating event:", error);
            showMessage(`Network error: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });


    // --- Action Listeners for Tables ---

    /**
     * Attaches event listeners for edit and delete buttons on the leads table.
     */
    function attachLeadActionListeners() {
        document.querySelectorAll('.edit-lead-btn').forEach(button => {
            button.onclick = async function() {
                const leadId = this.dataset.id;
                showLoading();
                try {
                    const response = await fetch(`/api/leads?id=${leadId}`);
                    if (!response.ok) throw new Error('Failed to fetch lead for editing');
                    const lead = (await response.json())[0]; // API returns array, get first item
                    
                    // Populate edit modal fields
                    document.getElementById('editLeadId').value = lead.id;
                    document.getElementById('editLeadFullName').value = lead.full_name || '';
                    document.getElementById('editLeadEmail').value = lead.email || '';
                    document.getElementById('editLeadPhone').value = lead.phone || '';
                    document.getElementById('editLeadStage').value = lead.stage || '';
                    document.getElementById('editLeadSource').value = lead.source || '';
                    document.getElementById('editLeadNotes').value = lead.notes || '';
                    
                    // Flatpickr instances need to be updated
                    if (flatpickrInstances['editLeadLastFollowUp']) {
                        flatpickrInstances['editLeadLastFollowUp'].setDate(lead.last_follow_up);
                    } else {
                        document.getElementById('editLeadLastFollowUp').value = lead.last_follow_up || '';
                    }
                    if (flatpickrInstances['editLeadNextFollowUp']) {
                        flatpickrInstances['editLeadNextFollowUp'].setDate(lead.next_follow_up);
                    } else {
                        document.getElementById('editLeadNextFollowUp').value = lead.next_follow_up || '';
                    }

                    openModal('editLeadModal');
                } catch (error) {
                    console.error("Dashboard.js: Error fetching lead for edit:", error);
                    showMessage(`Error fetching lead: ${error.message}`, 'error');
                } finally {
                    hideLoading();
                }
            };
        });

        document.querySelectorAll('.delete-lead-btn').forEach(button => {
            button.onclick = async function() {
                const leadId = this.dataset.id;
                if (confirm('Are you sure you want to delete this lead?')) { // Using confirm for simplicity
                    showLoading();
                    try {
                        const response = await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' });
                        const result = await response.json();
                        if (response.ok) {
                            showMessage(result.message, 'success');
                            fetchLeads(); // Refresh leads
                            fetchCalendarEvents(); // Refresh calendar as events might be linked
                            fetchExpenditureReport(); // Refresh expenditure as expenses might be linked
                        } else {
                            showMessage(`Error: ${result.message}`, 'error');
                        }
                    } catch (error) {
                        console.error("Dashboard.js: Error deleting lead:", error);
                        showMessage(`Network error: ${error.message}`, 'error');
                    } finally {
                        hideLoading();
                    }
                }
            };
        });
    }

    /**
     * Attaches event listeners for edit and delete buttons on the expenditure table.
     */
    function attachExpenditureActionListeners() {
        document.querySelectorAll('.edit-expense-btn').forEach(button => {
            button.onclick = async function() {
                const itemId = this.dataset.id;
                const sourceTable = this.dataset.source; // 'general_expenses' or 'calendar_events'
                showLoading();
                try {
                    let item;
                    if (sourceTable === 'general_expenses') {
                        // For general expenses, fetch from the specific endpoint
                        const response = await fetch(`/api/general_expenses?id=${itemId}`); 
                        if (!response.ok) throw new Error('Failed to fetch general expense for editing');
                        item = (await response.json())[0];
                        // Populate edit expenditure modal with general expense data
                        document.getElementById('editExpenditureId').value = item.id;
                        document.getElementById('editExpenditureDate').value = item.date || '';
                        document.getElementById('editExpenditureType').value = item.type_category || 'General Expense';
                        document.getElementById('editExpenditureDescription').value = item.description || '';
                        document.getElementById('editExpenditureAmount').value = item.amount || '0.00';
                        populateLeadDropdowns('editExpenditureLeadId', item.lead_id); // Populate and select lead
                        document.getElementById('editExpenditureCompany').value = item.company || '';
                        openModal('editExpenditureModal');
                    } else if (sourceTable === 'calendar_events') {
                        // For calendar events (which can also be expenditures), fetch from calendar events endpoint
                        const response = await fetch(`/api/calendar_events?id=${itemId}`); 
                        if (!response.ok) throw new Error('Failed to fetch calendar event for editing');
                        item = (await response.json())[0];
                        // Populate edit expenditure modal with calendar event data
                        document.getElementById('editExpenditureId').value = item.id;
                        document.getElementById('editExpenditureDate').value = item.start ? item.start.split('T')[0] : ''; // Get date part only
                        document.getElementById('editExpenditureType').value = item.extendedProps.type || '';
                        document.getElementById('editExpenditureDescription').value = item.title || ''; // FullCalendar title is description
                        document.getElementById('editExpenditureAmount').value = item.extendedProps.amount || '0.00';
                        populateLeadDropdowns('editExpenditureLeadId', item.extendedProps.lead_id);
                        document.getElementById('editExpenditureCompany').value = item.extendedProps.company || '';
                        openModal('editExpenditureModal');
                    }
                } catch (error) {
                    console.error("Dashboard.js: Error fetching item for edit:", error);
                    showMessage(`Error fetching item: ${error.message}`, 'error');
                } finally {
                    hideLoading();
                }
            };
        });

        document.querySelectorAll('.delete-expense-btn').forEach(button => {
            button.onclick = async function() {
                const itemId = this.dataset.id;
                const sourceTable = this.dataset.source;
                if (confirm('Are you sure you want to delete this expenditure record?')) {
                    showLoading();
                    try {
                        let response;
                        // Use the new /api/expenditure endpoint for deletion
                        response = await fetch(`/api/expenditure?id=${itemId}&source_table=${sourceTable}`, { method: 'DELETE' });

                        const result = await response.json();
                        if (response.ok) {
                            showMessage(result.message, 'success');
                            fetchExpenditureReport(); // Refresh report
                            if (sourceTable === 'calendar_events') {
                                fetchCalendarEvents(); // Also refresh calendar if an event was deleted
                            }
                        } else {
                            showMessage(`Error: ${result.message}`, 'error');
                        }
                    } catch (error) {
                        console.error("Dashboard.js: Error deleting expenditure:", error);
                        showMessage(`Network error: ${error.message}`, 'error');
                    } finally {
                        hideLoading();
                    }
                }
            };
        });
    }


    // --- Sorting Functionality for Tables ---
    let sortDirections = {}; // Stores current sort direction for each table

    function enableTableSorting(tableId, dataArray, renderFunction) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.warn(`Table with ID ${tableId} not found for sorting setup.`);
            return;
        }
        const headers = table.querySelectorAll('th[data-sort-by]');

        headers.forEach(header => {
            header.addEventListener('click', function() {
                const sortBy = this.dataset.sortBy;
                let direction = sortDirections[tableId] && sortDirections[tableId].column === sortBy ?
                                (sortDirections[tableId].direction === 'asc' ? 'desc' : 'asc') : 'asc';

                // Remove existing sort classes and icons
                headers.forEach(h => {
                    h.classList.remove('asc', 'desc');
                    const icon = h.querySelector('i.fas.fa-sort, i.fas.fa-sort-up, i.fas.fa-sort-down');
                    if (icon) {
                        icon.classList.remove('fa-sort-up', 'fa-sort-down');
                        icon.classList.add('fa-sort');
                    }
                });

                // Add current sort class and icon
                this.classList.add(direction);
                const currentIcon = this.querySelector('i.fas.fa-sort');
                if (currentIcon) {
                    currentIcon.classList.remove('fa-sort');
                    currentIcon.classList.add(direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
                }


                // Sort the data array
                const sortedData = [...dataArray].sort((a, b) => {
                    const valA = a[sortBy];
                    const valB = b[sortBy];

                    // Handle null/undefined values
                    if (valA === null || valA === undefined) return direction === 'asc' ? 1 : -1;
                    if (valB === null || valB === undefined) return direction === 'asc' ? -1 : 1;

                    // Numeric comparison
                    if (typeof valA === 'number' && typeof valB === 'number') {
                        return direction === 'asc' ? valA - valB : valB - valA;
                    }
                    // Date comparison
                    if (sortBy.toLowerCase().includes('date') || sortBy.toLowerCase().includes('followup')) {
                        const dateA = new Date(valA);
                        const dateB = new Date(valB);
                        return direction === 'asc' ? dateA - dateB : dateB - dateA;
                    }
                    // String comparison (case-insensitive)
                    return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
                });

                sortDirections[tableId] = { column: sortBy, direction: direction };
                renderFunction(sortedData);
            });
        });
    }

    // --- Flatpickr Initialization ---
    const flatpickrInstances = {};

    function initializeFlatpickr(selector, options = {}) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const instance = flatpickr(el, {
                dateFormat: "Y-m-d",
                allowInput: true,
                ...options
            });
            flatpickrInstances[el.id] = instance; // Store instance by ID
        });
    }

    // Initialize Flatpickr for date inputs in modals
    initializeFlatpickr('#addLeadForm .flatpickr-input');
    initializeFlatpickr('#editLeadForm .flatpickr-input');
    initializeFlatpickr('#addExpenditureForm .flatpickr-input');
    initializeFlatpickr('#editExpenditureForm .flatpickr-input');
    // For calendar events, enable time selection
    initializeFlatpickr('#addEventForm #eventStart', { enableTime: true, dateFormat: "Y-m-d H:i" });
    initializeFlatpickr('#addEventForm #eventEnd', { enableTime: true, dateFormat: "Y-m-d H:i" });


    // Initialize Flatpickr for expenditure date range filter
    initializeFlatpickr('#expenditureDateRange', {
        mode: "range",
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0].toISOString().split('T')[0];
                const endDate = selectedDates[1].toISOString().split('T')[0];
                fetchExpenditureReport(startDate, endDate);
            } else if (selectedDates.length === 0) {
                // If the range is cleared, fetch all
                fetchExpenditureReport();
            }
        }
    });

    // --- Initial Data Load & Event Listener Setup ---

    // Initial data load for the default view (Overview)
    // Other views will fetch data when they become active.
    fetchLeads(); // Leads data is needed for overview stats and dropdowns

    // Set up sorting listeners on table headers
    // Using event delegation on the table itself, then checking if the click was on a sortable header.
    document.getElementById('recentLeadsTable')?.addEventListener('click', function(event) {
        const targetTh = event.target.closest('th[data-sort-by]');
        if (targetTh) {
            enableTableSorting('recentLeadsTable', currentLeadsData, renderLeadsTable);
            // Manually trigger click on the header to apply sorting if it wasn't already handled by enableTableSorting
            targetTh.click();
        }
    });

    document.getElementById('expenditureReportTable')?.addEventListener('click', function(event) {
        const targetTh = event.target.closest('th[data-sort-by]');
        if (targetTh) {
            enableTableSorting('expenditureReportTable', currentExpenditureData, renderExpenditureReportTable);
            // Manually trigger click on the header to apply sorting
            targetTh.click();
        }
    });

    // Initial view display
    showView('overview-view');
});
