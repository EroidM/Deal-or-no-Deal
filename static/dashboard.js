// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {

    // Initialize Flatpickr for date inputs
    flatpickr("#dateOfContact", {});
    flatpickr("#activityDate", {});
    flatpickr("#expenseDate", {});
    flatpickr("#eventDate", {});
    flatpickr("#reportStartDate", {});
    flatpickr("#reportEndDate", {});
    flatpickr("#generalExpenseDate", {}); // Ensure Flatpickr is initialized for the general expense date

    // --- Modal Handling Functions ---
    const leadModal = document.getElementById('leadModal');
    const visitModal = document.getElementById('visitModal');
    const generalExpenseModal = document.getElementById('generalExpenseModal');
    const generalEventModal = document.getElementById('generalEventModal');

    function showModal(modalElement, title = '') {
        if (title) {
            const modalTitleElement = modalElement.querySelector('h2');
            if (modalTitleElement) {
                modalTitleElement.textContent = title;
            }
        }
        modalElement.classList.add('active');
    }

    function closeModal(modalElement) {
        modalElement.classList.remove('active');
        // Clear forms on close (optional, but good for "Add" modals)
        const form = modalElement.querySelector('form');
        if (form) {
            form.reset();
        }
    }

    // Event listeners for opening modals
    document.getElementById('addLeadModalBtn').addEventListener('click', function() {
        showModal(leadModal, 'Add New Lead');
        document.getElementById('addLeadForm').reset(); // Ensure form is clear for new lead
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
        populateLeadSelect(); // Populate lead dropdown for calendar event
    });

    // Event listeners for closing modals (using their IDs)
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

    // Close modal when clicking outside content
    window.addEventListener('click', function(event) {
        if (event.target === leadModal) closeModal(leadModal);
        if (event.target === visitModal) closeModal(visitModal);
        if (event.target === generalExpenseModal) closeModal(generalExpenseModal);
        if (event.target === generalEventModal) closeModal(generalEventModal);
    });

    // --- API Interaction Functions ---

    // Function to fetch and display leads
    async function fetchLeads() {
        try {
            const response = await fetch('/api/leads'); // Corrected API path
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const leads = await response.json();
            const leadsList = document.getElementById('recentLeadsTable').querySelector('tbody');
            leadsList.innerHTML = ''; // Clear existing leads

            leads.forEach(lead => {
                const row = document.createElement('tr');
                // Added data-label attributes for responsive tables
                row.innerHTML = `
                    <td data-label="Name" class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${lead.firstName || 'N/A'} ${lead.lastName || ''}</td>
                    <td data-label="Company" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.company || 'N/A'}</td>
                    <td data-label="Stage" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.stage || 'N/A'}</td>
                    <td data-label="Contact Date" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.dateOfContact || 'N/A'}</td>
                    <td data-label="Follow-up Date" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.followUp || 'N/A'}</td>
                    <td data-label="Actions" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button class="text-indigo-600 hover:text-indigo-900 view-lead-btn" data-id="${lead.id}" title="View/Edit Lead"><i class="fas fa-eye"></i></button>
                        <button class="text-red-600 hover:text-red-900 delete-lead-btn" data-id="${lead.id}" title="Delete Lead"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                leadsList.appendChild(row);
            });
            updateLeadStats(leads); // Update dashboard stats
            populateLeadSelect(leads); // Populate lead dropdowns
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Failed to load leads.', 'error');
        }
    }

    // Function to update lead statistics
    function updateLeadStats(leads) {
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

        updateLeadsByStageChart(leads);
        updateUpcomingFollowups(leads);
    }

    // Function to populate lead select dropdowns (for activities/events)
    function populateLeadSelect(leads = []) {
        const eventLeadSelect = document.getElementById('eventLeadId');
        const activityLeadIdInput = document.getElementById('activityLeadId'); // Hidden input for activity form

        // Clear existing options, add default "No Lead" option for calendar events
        eventLeadSelect.innerHTML = '<option value="">-- No Lead --</option>';

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            option.textContent = `${lead.firstName || 'N/A'} ${lead.lastName || ''} (${lead.company || 'N/A'})`;
            eventLeadSelect.appendChild(option);
        });

        // If activityLeadIdInput exists (for visitModal), set its value if a lead is selected
        if (activityLeadIdInput && activityLeadIdInput.value) {
             // Find the lead in the fetched leads and display its name
             const selectedLead = leads.find(lead => lead.id == activityLeadIdInput.value);
             if (selectedLead) {
                 document.getElementById('activityLeadName').textContent = `${selectedLead.firstName || 'N/A'} ${selectedLead.lastName || ''} (${selectedLead.company || 'N/A'})`;
             }
        }
    }


    // Function to update Leads by Stage Chart
    let leadsByStageChart; // Declare chart globally
    function updateLeadsByStageChart(leads) {
        const stageCounts = leads.reduce((acc, lead) => {
            acc[lead.stage] = (acc[lead.stage] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(stageCounts);
        const data = Object.values(stageCounts);

        const ctx = document.getElementById('leadsByStageChart').getContext('2d');

        if (leadsByStageChart) {
            leadsByStageChart.destroy(); // Destroy existing chart before creating a new one
        }

        leadsByStageChart = new Chart(ctx, {
            type: 'doughnut', // Changed from 'pie' to 'doughnut'
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8'
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
                    },
                    title: {
                        display: false,
                        text: 'Leads by Stage'
                    }
                }
            }
        });
    }

    // Function to update upcoming follow-ups
    function updateUpcomingFollowups(leads) {
        const upcomingList = document.getElementById('upcomingFollowupsList');
        upcomingList.innerHTML = ''; // Clear existing list

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const sortedFollowups = leads
            .filter(lead => lead.followUp && new Date(lead.followUp) >= today)
            .sort((a, b) => new Date(a.followUp) - new Date(b.followUp));

        if (sortedFollowups.length === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = 'No upcoming follow-ups.';
            upcomingList.appendChild(listItem);
            return;
        }

        sortedFollowups.forEach(lead => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="lead-name">${lead.firstName || 'N/A'} ${lead.lastName || ''} (${lead.company || 'N/A'})</span>
                <span class="followup-details">Follow-up on: ${lead.followUp || 'N/A'} (Stage: ${lead.stage || 'N/A'})</span>
            `;
            upcomingList.appendChild(listItem);
        });
    }


    // Function to add a new lead
    document.getElementById('addLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());

        showLoading();
        try {
            const response = await fetch('/api/leads', { // Corrected API path
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(leadModal); // Close the modal
            fetchLeads(); // Refresh leads list
        } catch (error) {
            console.error('Error adding lead:', error);
            showMessage('Failed to add lead.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to view lead details (and populate edit form)
    document.getElementById('recentLeadsTable').addEventListener('click', async function(event) {
        if (event.target.closest('.view-lead-btn')) { // Use closest to handle clicks on icon inside button
            const leadId = event.target.closest('.view-lead-btn').dataset.id;
            showLoading();
            try {
                const response = await fetch(`/api/leads?id=${leadId}`); // Corrected API path
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const leads = await response.json();
                const lead = leads[0]; // Assuming GET by ID returns an array with one lead

                if (lead) {
                    // Populate Edit Lead form fields directly
                    document.getElementById('leadId').value = lead.id; // Set hidden ID for update
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

                    // Set modal title to "Edit Lead"
                    showModal(leadModal, 'Edit Lead');

                    // Populate Add Activity form (if applicable, for visitModal)
                    document.getElementById('activityLeadId').value = lead.id;
                    // Ensure activityLeadName element exists in HTML if you want to display it
                    // document.getElementById('activityLeadName').textContent = `${lead.firstName || 'N/A'} ${lead.lastName || ''} (${lead.company || 'N/A'})`;
                    fetchLeadActivities(lead.id); // Fetch activities for this lead

                } else {
                    showMessage('Lead not found.', 'error');
                }
            } catch (error) {
                console.error('Error fetching lead details:', error);
                showMessage('Failed to load lead details.', 'error');
            } finally {
                hideLoading();
            }
        }
    });

    // Function to delete a lead
    document.getElementById('recentLeadsTable').addEventListener('click', async function(event) {
        if (event.target.closest('.delete-lead-btn')) { // Use closest to handle clicks on icon inside button
            const leadId = event.target.closest('.delete-lead-btn').dataset.id;
            if (confirm('Are you sure you want to delete this lead?')) {
                showLoading();
                try {
                    const response = await fetch(`/api/leads?id=${leadId}`, { // Corrected API path
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success');
                    fetchLeads(); // Refresh leads list
                    // No need to showTab('leads') if already on leads tab
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    showMessage('Failed to delete lead.', 'error');
                } finally {
                    hideLoading();
                }
            }
        }
    });

    // Function to update a lead (reusing addLeadForm)
    document.getElementById('addLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());
        const leadId = document.getElementById('leadId').value; // Get the hidden ID

        let url = '/api/leads';
        let method = 'POST';

        if (leadId) { // If ID exists, it's an update
            url = `/api/leads`; // PUT requests don't typically use ID in URL path in Flask, but in body
            method = 'PUT';
            leadData.id = leadId; // Add ID to the data payload for PUT
        }

        showLoading();
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(leadModal); // Close the modal
            fetchLeads(); // Refresh leads list
        } catch (error) {
            console.error('Error saving lead:', error);
            showMessage('Failed to save lead.', 'error');
        } finally {
            hideLoading();
        }
    });


    // Function to fetch and display lead activities
    async function fetchLeadActivities(leadId = null) {
        try {
            let url = '/api/lead_activities'; // Corrected API path
            if (leadId) {
                url += `?lead_id=${leadId}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const activities = await response.json();
            const activitiesList = document.getElementById('leadActivitiesList'); // Assuming this element exists in your viewLead tab
            if (activitiesList) {
                activitiesList.innerHTML = ''; // Clear existing activities

                activities.forEach(activity => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td data-label="ID" class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${activity.id}</td>
                        <td data-label="Type" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.activity_type || 'N/A'}</td>
                        <td data-label="Date" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.activity_date || 'N/A'}</td>
                        <td data-label="Description" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.description || 'N/A'}</td>
                        <td data-label="Expenditure" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.expenditure || '0.00'}</td>
                    `;
                    activitiesList.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error fetching lead activities:', error);
            showMessage('Failed to load lead activities.', 'error');
        }
    }

    // Function to add a new lead activity
    document.getElementById('addActivityForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const activityData = Object.fromEntries(formData.entries());
        activityData.lead_id = document.getElementById('activityLeadId').value; // Ensure lead_id is included

        showLoading();
        try {
            const response = await fetch('/api/lead_activities', { // Corrected API path
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(activityData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(visitModal); // Close the visit modal
            fetchLeadActivities(activityData.lead_id); // Refresh activities for current lead
            fetchCalendarEvents(); // Refresh calendar events as well
        } catch (error) {
            console.error('Error adding lead activity:', error);
            showMessage('Failed to add lead activity.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to fetch and display general expenses
    async function fetchGeneralExpenses() {
        try {
            const response = await fetch('/api/general_expenses'); // Corrected API path
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const expenses = await response.json();
            const expensesList = document.getElementById('generalExpensesList'); // Assuming this ID exists
            if (expensesList) {
                expensesList.innerHTML = ''; // Clear existing expenses

                expenses.forEach(expense => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td data-label="ID" class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${expense.id}</td>
                        <td data-label="Date" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.date || 'N/A'}</td>
                        <td data-label="Description" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.description || 'N/A'}</td>
                        <td data-label="Amount" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.amount || '0.00'}</td>
                        <td data-label="Actions" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button class="text-indigo-600 hover:text-indigo-900 edit-expense-btn" data-id="${expense.id}" title="Edit Expense"><i class="fas fa-edit"></i></button>
                            <button class="text-red-600 hover:text-red-900 delete-expense-btn" data-id="${expense.id}" title="Delete Expense"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    `;
                    expensesList.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error fetching general expenses:', error);
            showMessage('Failed to load general expenses.', 'error');
        }
    }

    // Event listener for editing a general expense
    document.getElementById('generalExpensesList').addEventListener('click', async function(event) {
        if (event.target.closest('.edit-expense-btn')) {
            const expenseId = event.target.closest('.edit-expense-btn').dataset.id;
            showLoading();
            try {
                const response = await fetch(`/api/general_expenses?id=${expenseId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const expenses = await response.json();
                const expense = expenses[0]; // Assuming GET by ID returns an array with one expense

                if (expense) {
                    document.getElementById('expenseId').value = expense.id; // Hidden input for expense ID
                    document.getElementById('generalExpenseDate').value = expense.date || '';
                    document.getElementById('generalExpenseAmount').value = expense.amount || '0.00';
                    document.getElementById('generalExpenseDescription').value = expense.description || '';

                    showModal(generalExpenseModal, 'Edit General Expense');
                } else {
                    showMessage('Expense not found.', 'error');
                }
            } catch (error) {
                console.error('Error fetching expense details:', error);
                showMessage('Failed to load expense details.', 'error');
            } finally {
                hideLoading();
            }
        }
    });

    // Event listener for deleting a general expense
    document.getElementById('generalExpensesList').addEventListener('click', async function(event) {
        if (event.target.closest('.delete-expense-btn')) {
            const expenseId = event.target.closest('.delete-expense-btn').dataset.id;
            if (confirm('Are you sure you want to delete this expense?')) {
                showLoading();
                try {
                    const response = await fetch(`/api/general_expenses?id=${expenseId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success');
                    fetchGeneralExpenses(); // Refresh expenses list
                    fetchCalendarEvents(); // Refresh calendar events as well
                } catch (error) {
                    console.error('Error deleting expense:', error);
                    showMessage('Failed to delete expense.', 'error');
                } finally {
                    hideLoading();
                }
            }
        }
    });

    // Function to add or update a general expense
    document.getElementById('addExpenseForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const expenseData = Object.fromEntries(formData.entries());
        const expenseId = document.getElementById('expenseId').value; // Get the hidden ID

        let url = '/api/general_expenses';
        let method = 'POST';

        if (expenseId) { // If ID exists, it's an update
            method = 'PUT';
            expenseData.id = expenseId; // Add ID to the data payload for PUT
        }

        showLoading();
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(expenseData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(generalExpenseModal); // Close the modal
            fetchGeneralExpenses(); // Refresh expenses list
            fetchCalendarEvents(); // Refresh calendar events as well
        } catch (error) {
            console.error('Error saving general expense:', error);
            showMessage('Failed to save general expense.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to fetch and display calendar events
    let calendar; // Declare calendar globally to access it for re-rendering
    async function fetchCalendarEvents() {
        try {
            const response = await fetch('/api/calendar_events'); // Corrected API path
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const events = await response.json();

            const calendarEvents = events.map(event => ({
                title: `${event.type || 'N/A'}: ${event.description || ''} ${event.lead_name ? '(' + event.lead_name + ')' : ''} ${event.amount && event.amount > 0 ? ' - KSh' + parseFloat(event.amount).toFixed(2) : ''}`,
                start: event.date || 'N/A',
                allDay: true,
                className: `fc-event-${(event.type || '').toLowerCase().replace(/\s/g, '-')}`, // For custom styling
                extendedProps: {
                    type: event.type,
                    leadId: event.lead_id,
                    amount: event.amount,
                    description: event.description
                }
            }));

            if (calendar) {
                calendar.setOption('events', calendarEvents);
            } else {
                const calendarEl = document.getElementById('calendar');
                calendar = new FullCalendar.Calendar(calendarEl, {
                    initialView: 'dayGridMonth',
                    events: calendarEvents,
                    headerToolbar: {
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,dayGridWeek,dayGridDay'
                    },
                    eventDidMount: function(info) {
                        // Add a tooltip for events
                        const tooltip = document.getElementById('calendarTooltip');
                        info.el.addEventListener('mouseover', function() {
                            tooltip.innerHTML = `
                                <strong>${info.event.title}</strong>
                                <span>Date: ${info.event.startStr}</span>
                                ${info.event.extendedProps.description ? `<span>Description: ${info.event.extendedProps.description}</span>` : ''}
                            `;
                            tooltip.style.left = `${info.el.getBoundingClientRect().left + window.scrollX}px`;
                            tooltip.style.top = `${info.el.getBoundingClientRect().top + window.scrollY - tooltip.offsetHeight - 10}px`;
                            tooltip.classList.add('active');
                        });
                        info.el.addEventListener('mouseout', function() {
                            tooltip.classList.remove('active');
                        });
                    },
                    eventClick: function(info) {
                        // Optional: Open a modal to view/edit event details
                        // For now, just show a message
                        showMessage(`Event: ${info.event.title} on ${info.event.startStr}`, 'info');
                    }
                });
                calendar.render();
            }
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            showMessage('Failed to load calendar events.', 'error');
        }
    }

    // Function to add a new calendar event
    document.getElementById('addEventForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const eventData = Object.fromEntries(formData.entries());
        // Handle empty lead_id (convert empty string to null)
        eventData.lead_id = eventData.lead_id === '' ? null : eventData.lead_id;
        eventData.amount = eventData.amount === '' ? 0 : parseFloat(eventData.amount);

        showLoading();
        try {
            const response = await fetch('/api/calendar_events', { // Corrected API path
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            this.reset();
            closeModal(generalEventModal); // Close the modal
            fetchCalendarEvents(); // Refresh calendar events
        } catch (error) {
            console.error('Error adding calendar event:', error);
            showMessage('Failed to add calendar event.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to fetch and display expenditure report
    async function fetchExpenditureReport(startDate = '', endDate = '') {
        try {
            let url = `/api/expenditure_report`; // Corrected API path
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const reportItems = await response.json();
            const reportTableBody = document.getElementById('expenditureReportTable').querySelector('tbody');
            reportTableBody.innerHTML = ''; // Clear existing items

            let totalExpenditure = 0;

            reportItems.forEach(item => {
                const row = document.createElement('tr');
                // Added data-label attributes for responsive tables
                row.innerHTML = `
                    <td data-label="Date" class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.date || 'N/A'}</td>
                    <td data-label="Category" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.type_category || 'N/A'}</td>
                    <td data-label="Description" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.description || 'N/A'}</td>
                    <td data-label="Amount (KSh)" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${parseFloat(item.amount || 0).toFixed(2)}</td>
                    <td data-label="Lead Name" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.lead_name || 'N/A'}</td>
                    <td data-label="Company" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.company || 'N/A'}</td>
                `;
                reportTableBody.appendChild(row);
                totalExpenditure += parseFloat(item.amount || 0);
            });

            // Corrected the ID here:
            document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh ${totalExpenditure.toFixed(2)}`;
        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            showMessage('Failed to load expenditure report.', 'error');
        }
    }

    // Event listener for filtering expenditure report
    document.getElementById('filterReportBtn').addEventListener('click', function() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        fetchExpenditureReport(startDate, endDate);
    });

    // New Event listener for clearing expenditure report date filters
    document.getElementById('clearReportDatesBtn').addEventListener('click', function() {
        document.getElementById('reportStartDate').value = '';
        document.getElementById('reportEndDate').value = '';
        fetchExpenditureReport(); // Fetch without filters
    });

    // Function to export leads to CSV
    document.getElementById('exportLeadsBtn').addEventListener('click', async function() {
        showLoading();
        try {
            const response = await fetch('/api/export_leads'); // Corrected API path
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'leads_export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage('Leads exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting leads:', error);
            showMessage('Failed to export leads.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to export expenditure report to CSV
    document.getElementById('exportExpenditureReportBtn').addEventListener('click', async function() {
        showLoading();
        try {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            let url = `/api/export_expenditure_report`; // Corrected API path
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
            hideLoading();
        }
    });

    // --- Tab Switching Logic ---
    function showTab(tabId) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        // Deactivate all tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('bg-indigo-700', 'text-white');
            button.classList.add('bg-indigo-500', 'text-gray-200');
        });

        // Show the selected tab content
        const selectedTabContent = document.getElementById(tabId);
        if (selectedTabContent) {
            selectedTabContent.classList.remove('hidden');
        }

        // Activate the selected tab button
        const selectedTabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (selectedTabButton) {
            selectedTabButton.classList.remove('bg-indigo-500', 'text-gray-200');
            selectedTabButton.classList.add('bg-indigo-700', 'text-white');
        }

        // Fetch data for the tab if necessary
        if (tabId === 'leads') {
            fetchLeads();
        } else if (tabId === 'generalExpenses') {
            fetchGeneralExpenses();
        } else if (tabId === 'calendar') {
            fetchCalendarEvents();
        } else if (tabId === 'expenditureReport') {
            fetchExpenditureReport();
        }
    }

    // Event listeners for tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            showTab(this.dataset.tab);
        });
    });

    // --- Message and Loading Indicators ---
    const messageContainer = document.getElementById('messageContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');

    function showMessage(message, type = 'info') {
        messageContainer.textContent = message;
        messageContainer.className = `message-container active ${type}`;
        setTimeout(() => {
            messageContainer.classList.remove('active');
        }, 3000); // Hide after 3 seconds
    }

    function showLoading() {
        loadingIndicator.style.display = 'flex';
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }

    // Initial load: Show the leads tab by default
    fetchLeads(); // Fetch leads on initial load
    fetchCalendarEvents(); // Fetch calendar events on initial load
    fetchGeneralExpenses(); // Fetch general expenses on initial load
    fetchExpenditureReport(); // Fetch expenditure report on initial load
});
