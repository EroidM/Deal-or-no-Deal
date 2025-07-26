// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded. Initializing dashboard.");

    // --- Loading Spinner Functions ---
    // These functions control the visibility of a loading overlay and spinner.
    // The 'loadingOverlay' element must exist in your HTML.
    function showLoading() {
        console.log("Showing loading spinner.");
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    function hideLoading() {
        console.log("Hiding loading spinner.");
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    // Initialize Flatpickr for all date input fields
    flatpickr("#dateOfContact", {});
    flatpickr("#activityDate", {});
    flatpickr("#eventDate", {});
    flatpickr("#reportStartDate", {});
    flatpickr("#reportEndDate", {});
    flatpickr("#generalExpenseDate", {}); // Ensure Flatpickr is initialized for the general expense date

    // --- Modal Handling Functions ---
    // Get references to all modal elements
    const leadModal = document.getElementById('leadModal');
    const visitModal = document.getElementById('visitModal');
    const generalExpenseModal = document.getElementById('generalExpenseModal');
    const generalEventModal = document.getElementById('generalEventModal');

    // Function to display a modal with an optional title
    function showModal(modalElement, title = '') {
        console.log(`Showing modal: ${modalElement.id} with title: ${title}`);
        if (title) {
            const modalTitleElement = modalElement.querySelector('h2');
            if (modalTitleElement) {
                modalTitleElement.textContent = title;
            }
        }
        modalElement.classList.add('active'); // Activate CSS class to show modal
    }

    // Function to hide a modal and reset its form
    function closeModal(modalElement) {
        console.log(`Closing modal: ${modalElement.id}`);
        modalElement.classList.remove('active'); // Deactivate CSS class to hide modal
        const form = modalElement.querySelector('form');
        if (form) {
            form.reset(); // Reset form fields
        }
    }

    // Event listeners for opening modals via buttons
    document.getElementById('addLeadModalBtn').addEventListener('click', function() {
        showModal(leadModal, 'Add New Lead');
        document.getElementById('addLeadForm').reset(); // Clear form for new entry
        document.getElementById('leadId').value = ''; // Clear hidden ID for new lead
    });

    document.getElementById('addExpenseModalBtn').addEventListener('click', function() {
        showModal(generalExpenseModal, 'Add General Expense');
        document.getElementById('addExpenseForm').reset();
        document.getElementById('expenseId').value = ''; // Clear hidden ID for new expense
    });

    document.getElementById('addEventModalBtn').addEventListener('click', function() {
        showModal(generalEventModal, 'Add Calendar Event');
        document.getElementById('addEventForm').reset();
        document.getElementById('eventAmount').value = '0.00'; // Reset amount to default for new event
        populateLeadSelect(); // Populate lead dropdown for linking events
    });

    // Event listeners for closing modals via close buttons
    document.getElementById('closeLeadModalBtn').addEventListener('click', function() {
        closeModal(leadModal);
    });
    document.getElementById('closeVisitModalBtn').addEventListener('click', function() {
        closeModal(visitModal);
    });
    document.getElementById('closeGeneralExpenseModalBtn').addEventListener('click', function() {
        closeModal(generalExpenseModal);
    });
    document.getElementById('closeGeneralEventModalBtn').addEventListener('click', function() {
        closeModal(generalEventModal);
    });

    // Close modal when clicking outside the modal content area
    window.addEventListener('click', function(event) {
        if (event.target === leadModal) closeModal(leadModal);
        if (event.target === visitModal) closeModal(visitModal);
        if (event.target === generalExpenseModal) closeModal(generalExpenseModal);
        if (event.target === generalEventModal) closeModal(generalEventModal);
    });

    // --- API Interaction Functions ---

    // Fetches lead data from the backend and updates the UI
    async function fetchLeads() {
        console.log("Executing fetchLeads()...");
        showLoading(); // Show loading spinner
        try {
            const response = await fetch('/api/leads'); // API endpoint for leads
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const leads = await response.json();
            const leadsList = document.getElementById('recentLeadsTable').querySelector('tbody');
            leadsList.innerHTML = ''; // IMPORTANT: Clear existing leads to prevent duplication

            // Populate the leads table
            leads.forEach(lead => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Name">${lead.firstName || 'N/A'} ${lead.lastName || ''}</td>
                    <td data-label="Company">${lead.company || 'N/A'}</td>
                    <td data-label="Stage">${lead.stage || 'N/A'}</td>
                    <td data-label="Contact Date">${lead.dateOfContact || 'N/A'}</td>
                    <td data-label="Follow-up Date">${lead.followUp || 'N/A'}</td>
                    <td data-label="Actions">
                        <button class="text-indigo-600 hover:text-indigo-900 view-lead-btn" data-id="${lead.id}" title="View/Edit Lead"><i class="fas fa-eye"></i></button>
                        <button class="text-red-600 hover:text-red-900 delete-lead-btn" data-id="${lead.id}" title="Delete Lead"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                leadsList.appendChild(row);
            });
            updateLeadStats(leads); // Update lead statistics cards
            populateLeadSelect(leads); // Populate lead dropdowns in modals
            updateUpcomingFollowups(leads); // Update the upcoming follow-ups list
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Failed to load leads.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    }

    // Updates the lead statistics displayed in the dashboard cards
    function updateLeadStats(leads) {
        console.log("Executing updateLeadStats()...");
        const totalLeads = leads.length;
        const newLeads = leads.filter(lead => lead.stage === 'New').length;
        const qualifiedLeads = leads.filter(lead => lead.stage === 'Qualified').length;
        const closedWonLeads = leads.filter(lead => lead.stage === 'Closed Won').length;
        const closedLostLeads = leads.filter(lead => lead.stage === 'Closed Lost').length;

        document.getElementById('totalLeadsCount').textContent = totalLeads;
        document.getElementById('newLeadsCount').textContent = newLeads;
        document.getElementById('qualifiedLeadsCount').textContent = qualifiedLeads;
        document.getElementById('closedWonLeadsCount').textContent = closedWonLeads;
        document.getElementById('closedLostLeadsCount').textContent = closedLostLeads;

        updateLeadsByStageChart(leads); // Update the doughnut chart
    }

    // Populates the lead dropdowns used in activity and event forms
    function populateLeadSelect(leads = []) {
        console.log("Executing populateLeadSelect()...");
        const eventLeadSelect = document.getElementById('eventLeadId');
        eventLeadSelect.innerHTML = '<option value="">-- No Lead --</option>'; // Default option

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            // Display lead name and company, with 'N/A' fallback
            option.textContent = `${lead.firstName || 'N/A'} ${lead.lastName || ''} (${lead.company || 'N/A'})`;
            eventLeadSelect.appendChild(option);
        });
    }

    // Updates the Leads by Stage doughnut chart using Chart.js
    let leadsByStageChart; // Declare chart globally to allow destruction/re-creation
    function updateLeadsByStageChart(leads) {
        console.log("Executing updateLeadsByStageChart()...");
        const stageCounts = leads.reduce((acc, lead) => {
            acc[lead.stage] = (acc[lead.stage] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(stageCounts);
        const data = Object.values(stageCounts);

        const ctx = document.getElementById('leadsByStageChart').getContext('2d');

        if (leadsByStageChart) {
            leadsByStageChart.destroy(); // Destroy existing chart instance to prevent memory leaks
        }

        leadsByStageChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8' // Consistent colors
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right', // Legend on the right side
                    },
                    title: {
                        display: false, // Title hidden as it's in the card header
                        text: 'Leads by Stage'
                    }
                }
            }
        });
    }

    // Updates the list of upcoming follow-ups
    function updateUpcomingFollowups(leads) {
        console.log("Executing updateUpcomingFollowups()...");
        const upcomingList = document.getElementById('upcomingFollowupsList');
        upcomingList.innerHTML = ''; // Clear existing list items

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day for accurate comparison

        // Filter and sort leads by follow-up date (only future dates)
        const sortedFollowups = leads
            .filter(lead => lead.followUp && new Date(lead.followUp) >= today)
            .sort((a, b) => new Date(a.followUp) - new Date(b.followUp));

        if (sortedFollowups.length === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = 'No upcoming follow-ups.';
            upcomingList.appendChild(listItem);
            return;
        }

        // Populate the list
        sortedFollowups.forEach(lead => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="lead-name">${lead.firstName || 'N/A'} ${lead.lastName || ''} (${lead.company || 'N/A'})</span>
                <span class="followup-details">Follow-up on: ${lead.followUp || 'N/A'} (Stage: ${lead.stage || 'N/A'})</span>
            `;
            upcomingList.appendChild(listItem);
        });
    }

    // Handles the submission of the Add/Edit Lead form
    document.getElementById('addLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());
        const leadId = document.getElementById('leadId').value; // Get hidden ID for update operations

        let url = '/api/leads';
        let method = 'POST'; // Default to POST for new lead

        if (leadId) { // If leadId exists, it's an update operation
            method = 'PUT';
            leadData.id = leadId; // Add ID to the data payload
        }

        console.log(`${method} Lead:`, leadData);
        showLoading(); // Show loading spinner
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json' // Specify JSON content
                },
                body: JSON.stringify(leadData) // Send data as JSON string
            });

            if (!response.ok) {
                const errorText = await response.text(); // Get detailed error message from server
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success'); // Show success message
            closeModal(leadModal); // Close the lead modal
            fetchLeads(); // Refresh leads list and all dependent UI components
        } catch (error) {
            console.error('Error saving lead:', error);
            showMessage('Failed to save lead.', 'error'); // Show error message
        } finally {
            hideLoading(); // Hide loading spinner
        }
    });

    // Event listener for "View/Edit" lead button clicks in the Recent Leads table
    document.getElementById('recentLeadsTable').addEventListener('click', async function(event) {
        if (event.target.closest('.view-lead-btn')) { // Use closest to handle clicks on the icon inside the button
            const leadId = event.target.closest('.view-lead-btn').dataset.id;
            console.log("Viewing lead with ID:", leadId);
            showLoading(); // Show loading spinner
            try {
                const response = await fetch(`/api/leads?id=${leadId}`); // Fetch specific lead by ID
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const leads = await response.json();
                const lead = leads[0]; // Assuming the API returns an array with one lead

                if (lead) {
                    // Populate the lead modal form fields for editing
                    document.getElementById('leadId').value = lead.id;
                    document.getElementById('firstName').value = lead.firstName || '';
                    document.getElementById('lastName').value = lead.lastName || '';
                    document.getElementById('title').value = lead.title || '';
                    document.getElementById('company').value = lead.company || '';
                    document.getElementById('email').value = lead.email || '';
                    document.getElementById('phone').value = lead.phone || '';
                    document.getElementById('product').value = lead.product || '';
                    document.getElementById('stage').value = lead.stage || '';
                    document.getElementById('dateOfContact').value = lead.dateOfContact || '';
                    document.getElementById('followUp').value = lead.followUp || '';
                    document.getElementById('notes').value = lead.notes || '';

                    showModal(leadModal, 'Edit Lead'); // Show modal with "Edit" title
                } else {
                    showMessage('Lead not found.', 'error');
                }
            }
            catch (error) {
                console.error('Error fetching lead details:', error);
                showMessage('Failed to load lead details.', 'error');
            } finally {
                hideLoading(); // Hide loading spinner
            }
        }
    });

    // Event listener for "Delete" lead button clicks in the Recent Leads table
    document.getElementById('recentLeadsTable').addEventListener('click', async function(event) {
        if (event.target.closest('.delete-lead-btn')) { // Use closest to handle clicks on the icon inside the button
            const leadId = event.target.closest('.delete-lead-btn').dataset.id;
            // Confirm deletion with the user
            if (confirm('Are you sure you want to delete this lead? This will also remove associated calendar events and activities.')) {
                console.log("Deleting lead with ID:", leadId);
                showLoading(); // Show loading spinner
                try {
                    const response = await fetch(`/api/leads?id=${leadId}`, {
                        method: 'DELETE' // Send DELETE request
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success'); // Show success message
                    fetchLeads(); // Refresh leads list and all dependent UI components
                    fetchCalendarEvents(); // Refresh calendar as lead deletion affects events
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    showMessage('Failed to delete lead.', 'error'); // Show error message
                } finally {
                    hideLoading(); // Hide loading spinner
                }
            }
        }
    });

    // Handles the submission of the Add Lead Activity form
    document.getElementById('addActivityForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const activityData = Object.fromEntries(formData.entries());
        // Ensure lead_id is included (can be null if not linked) and expenditure is parsed to float
        activityData.lead_id = document.getElementById('activityLeadId').value || null;
        activityData.expenditure = parseFloat(activityData.expenditure || 0);

        console.log("Adding Lead Activity:", activityData);
        showLoading(); // Show loading spinner
        try {
            const response = await fetch('/api/lead_activities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(activityData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(visitModal); // Close the activity modal
            fetchCalendarEvents(); // Refresh calendar events (as activities are calendar events)
            fetchExpenditureReport(); // Refresh expenditure report (if activity has an amount)
            fetchLeads(); // Refresh leads to update follow-ups/stats if activity affects them
        } catch (error) {
            console.error('Error adding lead activity:', error);
            showMessage('Failed to add lead activity.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    });

    // Handles the submission of the Add/Edit General Expense form
    document.getElementById('addExpenseForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const expenseData = Object.fromEntries(formData.entries());
        const expenseId = document.getElementById('expenseId').value; // Hidden ID for update

        let url = '/api/general_expenses';
        let method = 'POST'; // Default to POST for new expense

        if (expenseId) { // If ID exists, it's an update
            method = 'PUT';
            expenseData.id = expenseId;
        }
        expenseData.amount = parseFloat(expenseData.amount || 0); // Ensure amount is float

        console.log(`${method} General Expense:`, expenseData);
        showLoading(); // Show loading spinner
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(expenseData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(generalExpenseModal); // Close the expense modal
            fetchExpenditureReport(); // Refresh expenditure report
            fetchCalendarEvents(); // Refresh calendar events (if general expenses are displayed there)
        } catch (error) {
            console.error('Error saving general expense:', error);
            showMessage('Failed to save general expense.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    });

    // Event listener for editing/deleting an expense from the Expenditure Report table
    document.getElementById('expenditureReportTableBody').addEventListener('click', async function(event) {
        // Handle Edit button click
        if (event.target.closest('.edit-expense-btn')) {
            const expenseId = event.target.closest('.edit-expense-btn').dataset.id;
            console.log("Editing expense with ID:", expenseId);
            showLoading(); // Show loading spinner
            try {
                const response = await fetch(`/api/general_expenses?id=${expenseId}`); // Fetch specific expense by ID
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const expenses = await response.json();
                const expense = expenses[0]; // Assuming API returns array with one expense

                if (expense) {
                    // Populate the general expense modal form fields for editing
                    document.getElementById('expenseId').value = expense.id;
                    document.getElementById('generalExpenseDate').value = expense.date || '';
                    document.getElementById('generalExpenseAmount').value = parseFloat(expense.amount || 0).toFixed(2);
                    document.getElementById('generalExpenseDescription').value = expense.description || '';

                    showModal(generalExpenseModal, 'Edit General Expense'); // Show modal with "Edit" title
                } else {
                    showMessage('Expense not found.', 'error');
                }
            } catch (error) {
                console.error('Error fetching expense details:', error);
                showMessage('Failed to load expense details.', 'error');
            } finally {
                hideLoading(); // Hide loading spinner
            }
        }

        // Handle Delete button click
        if (event.target.closest('.delete-expense-btn')) {
            const expenseId = event.target.closest('.delete-expense-btn').dataset.id;
            if (confirm('Are you sure you want to delete this expense?')) {
                console.log("Deleting expense with ID:", expenseId);
                showLoading(); // Show loading spinner
                try {
                    const response = await fetch(`/api/general_expenses?id=${expenseId}`, {
                        method: 'DELETE' // Send DELETE request
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success'); // Show success message
                    fetchExpenditureReport(); // Refresh expenditure report
                    fetchCalendarEvents(); // Refresh calendar events (if general expenses are displayed there)
                } catch (error) {
                    console.error('Error deleting expense:', error);
                    showMessage('Failed to delete expense.', 'error'); // Show error message
                } finally {
                    hideLoading(); // Hide loading spinner
                }
            }
        }
    });

    // Fetches calendar events and renders them using FullCalendar
    let calendar; // Global variable to hold the FullCalendar instance
    async function fetchCalendarEvents() {
        console.log("Executing fetchCalendarEvents()...");
        showLoading(); // Show loading spinner
        try {
            const response = await fetch('/api/calendar_events');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const events = await response.json();

            // Map backend event data to FullCalendar event object format
            const calendarEvents = events.map(event => ({
                // Construct title with type, description, lead name, and amount if present
                title: `${event.type || 'N/A'}: ${event.description || ''} ${event.lead_name ? '(' + event.lead_name + ')' : ''} ${event.amount && event.amount > 0 ? ' - KSh' + parseFloat(event.amount).toFixed(2) : ''}`,
                start: event.date || 'N/A', // Event date
                allDay: true, // Events span the whole day
                // Assign CSS class for color coding based on event type
                className: `fc-event-${(event.type || '').toLowerCase().replace(/\s/g, '-')}`,
                extendedProps: { // Store additional properties for tooltips or future use
                    type: event.type,
                    leadId: event.lead_id,
                    amount: event.amount,
                    description: event.description,
                    id: event.id
                }
            }));

            if (calendar) {
                calendar.setOption('events', calendarEvents); // Update existing calendar events
            } else {
                const calendarEl = document.getElementById('calendar');
                calendar = new FullCalendar.Calendar(calendarEl, {
                    initialView: 'dayGridMonth', // Default view
                    events: calendarEvents, // Events data
                    headerToolbar: { // Customize header buttons
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,dayGridWeek,dayGridDay'
                    },
                    eventDidMount: function(info) {
                        // Add a tooltip functionality on event hover
                        const tooltip = document.getElementById('calendarTooltip');
                        info.el.addEventListener('mouseover', function() {
                            tooltip.innerHTML = `
                                <strong>${info.event.title}</strong>
                                <span>Date: ${info.event.startStr}</span>
                                ${info.event.extendedProps.description ? `<span>Description: ${info.event.extendedProps.description}</span>` : ''}
                            `;
                            // Position tooltip relative to the event element
                            tooltip.style.left = `${info.el.getBoundingClientRect().left + window.scrollX}px`;
                            tooltip.style.top = `${info.el.getBoundingClientRect().top + window.scrollY - tooltip.offsetHeight - 10}px`;
                            tooltip.classList.add('active'); // Show tooltip
                        });
                        info.el.addEventListener('mouseout', function() {
                            tooltip.classList.remove('active'); // Hide tooltip
                        });
                    },
                    eventClick: function(info) {
                        // Basic click handler for calendar events
                        showMessage(`Event: ${info.event.title} on ${info.event.startStr}`, 'info');
                    }
                });
                calendar.render(); // Render the calendar for the first time
            }
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            showMessage('Failed to load calendar events.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    }

    // Handles the submission of the Add Calendar Event form
    document.getElementById('addEventForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const eventData = Object.fromEntries(formData.entries());
        // Convert empty lead_id string to null for database
        eventData.lead_id = eventData.lead_id === '' ? null : eventData.lead_id;
        // Ensure amount is float, defaulting to 0 if empty
        eventData.amount = eventData.amount === '' ? 0 : parseFloat(eventData.amount);

        console.log("Adding Calendar Event:", eventData);
        showLoading(); // Show loading spinner
        try {
            const response = await fetch('/api/calendar_events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            this.reset(); // Reset form fields
            closeModal(generalEventModal); // Close the event modal
            fetchCalendarEvents(); // Refresh calendar events
            fetchExpenditureReport(); // Refresh expenditure report (if event has an amount)
        } catch (error) {
            console.error('Error adding calendar event:', error);
            showMessage('Failed to add calendar event.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    });

    // Fetches expenditure report data and populates the table
    async function fetchExpenditureReport(startDate = '', endDate = '') {
        console.log("Executing fetchExpenditureReport()...");
        showLoading(); // Show loading spinner
        try {
            let url = `/api/expenditure_report`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`; // Append query params if any

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const reportItems = await response.json();
            const reportTableBody = document.getElementById('expenditureReportTableBody');
            reportTableBody.innerHTML = ''; // IMPORTANT: Clear existing items to prevent duplication

            let totalExpenditure = 0;

            // Populate the expenditure report table
            reportItems.forEach(item => {
                const row = document.createElement('tr');
                let actionsHtml = '';
                // Only show edit/delete buttons for 'General Expense' type
                // and if it originated from the 'general_expenses' table (as per app.py)
                if (item.type_category === 'General Expense' && item.source_table === 'general_expenses') {
                    actionsHtml = `
                        <button class="text-indigo-600 hover:text-indigo-900 edit-expense-btn" data-id="${item.id}" title="Edit Expense"><i class="fas fa-edit"></i></button>
                        <button class="text-red-600 hover:text-red-900 delete-expense-btn" data-id="${item.id}" title="Delete Expense"><i class="fas fa-trash-alt"></i></button>
                    `;
                } else {
                    // For lead-related expenses from calendar_events, no direct edit/delete from this table
                    actionsHtml = 'N/A';
                }

                row.innerHTML = `
                    <td data-label="Date">${item.date || 'N/A'}</td>
                    <td data-label="Category">${item.type_category || 'N/A'}</td>
                    <td data-label="Description">${item.description || 'N/A'}</td>
                    <td data-label="Amount (KSh)">${parseFloat(item.amount || 0).toFixed(2)}</td>
                    <td data-label="Lead Name">${item.lead_name || 'N/A'}</td>
                    <td data-label="Company">${item.company || 'N/A'}</td>
                    <td data-label="Actions">${actionsHtml}</td>
                `;
                reportTableBody.appendChild(row);
                totalExpenditure += parseFloat(item.amount || 0); // Accumulate total expenditure
            });

            document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh ${totalExpenditure.toFixed(2)}`;
        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            showMessage('Failed to load expenditure report.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    }

    // Event listener for filtering the expenditure report by date range
    document.getElementById('filterReportBtn').addEventListener('click', function() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        fetchExpenditureReport(startDate, endDate);
    });

    // Event listener for clearing date filters on the expenditure report
    document.getElementById('clearReportDatesBtn').addEventListener('click', function() {
        document.getElementById('reportStartDate').value = '';
        document.getElementById('reportEndDate').value = '';
        fetchExpenditureReport(); // Fetch report without filters
    });

    // Function to export leads data to a CSV file
    document.getElementById('exportLeadsBtn').addEventListener('click', async function() {
        console.log("Exporting leads...");
        showLoading(); // Show loading spinner
        try {
            const response = await fetch('/api/export_leads');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const blob = await response.blob(); // Get response as a Blob
            const url = window.URL.createObjectURL(blob); // Create a URL for the Blob
            const a = document.createElement('a'); // Create a temporary anchor element
            a.style.display = 'none';
            a.href = url;
            a.download = 'leads_export.csv'; // Set download filename
            document.body.appendChild(a);
            a.click(); // Programmatically click the link to trigger download
            window.URL.revokeObjectURL(url); // Clean up the Blob URL
            showMessage('Leads exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting leads:', error);
            showMessage('Failed to export leads.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    });

    // Function to export expenditure report data to a CSV file
    document.getElementById('exportExpenditureReportBtn').addEventListener('click', async function() {
        console.log("Exporting expenditure report...");
        showLoading(); // Show loading spinner
        try {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            let url = `/api/export_expenditure_report`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const blob = await response.blob();
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = urlBlob;
            a.download = 'expenditure_report_export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(urlBlob);
            showMessage('Expenditure report exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting expenditure report:', error);
            showMessage('Failed to export expenditure report.', 'error');
        } finally {
            hideLoading(); // Hide loading spinner
        }
    });

    // Initial data load when the page loads
    // These functions are called once to populate the dashboard sections
    fetchLeads(); // Fetches leads, updates stats, populates dropdowns, and updates upcoming follow-ups
    fetchCalendarEvents(); // Fetches and renders calendar events
    fetchExpenditureReport(); // Fetches and renders expenditure report
});
