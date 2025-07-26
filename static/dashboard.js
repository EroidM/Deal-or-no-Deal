// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {

    // Initialize Flatpickr for date inputs
    flatpickr("#dateOfContact", {});
    flatpickr("#activityDate", {});
    flatpickr("#expenseDate", {});
    flatpickr("#eventDate", {});
    flatpickr("#reportStartDate", {});
    flatpickr("#reportEndDate", {});

    // --- API Interaction Functions (UPDATED: Added /api/ prefix to all endpoints) ---

    // Function to fetch and display leads
    async function fetchLeads() {
        try {
            const response = await fetch('/api/leads'); // Corrected API path
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const leads = await response.json();
            const leadsList = document.getElementById('leadsList');
            leadsList.innerHTML = ''; // Clear existing leads

            leads.forEach(lead => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${lead.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.firstName} ${lead.lastName || ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.company}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.stage}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.dateOfContact}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button class="text-indigo-600 hover:text-indigo-900 view-lead-btn" data-id="${lead.id}">View</button>
                        <button class="text-red-600 hover:text-red-900 delete-lead-btn" data-id="${lead.id}">Delete</button>
                    </td>
                `;
                leadsList.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching leads:', error);
            alert('Failed to load leads.');
        }
    }

    // Function to add a new lead
    document.getElementById('addLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());

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
            alert(result.message);
            this.reset();
            fetchLeads(); // Refresh leads list
        } catch (error) {
            console.error('Error adding lead:', error);
            alert('Failed to add lead.');
        }
    });

    // Function to view lead details (and populate edit form)
    document.getElementById('leadsList').addEventListener('click', async function(event) {
        if (event.target.classList.contains('view-lead-btn')) {
            const leadId = event.target.dataset.id;
            try {
                const response = await fetch(`/api/leads?id=${leadId}`); // Corrected API path
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const leads = await response.json();
                const lead = leads[0]; // Assuming GET by ID returns an array with one lead

                if (lead) {
                    // Populate Lead Details tab
                    document.getElementById('viewLeadId').textContent = lead.id;
                    document.getElementById('viewLeadName').textContent = `${lead.firstName} ${lead.lastName || ''}`;
                    document.getElementById('viewLeadTitle').textContent = lead.title || 'N/A';
                    document.getElementById('viewLeadCompany').textContent = lead.company;
                    document.getElementById('viewLeadEmail').textContent = lead.email || 'N/A';
                    document.getElementById('viewLeadPhone').textContent = lead.phone || 'N/A';
                    document.getElementById('viewLeadProduct').textContent = lead.product || 'N/A';
                    document.getElementById('viewLeadStage').textContent = lead.stage;
                    document.getElementById('viewLeadDateOfContact').textContent = lead.dateOfContact;
                    document.getElementById('viewLeadFollowUp').textContent = lead.followUp || 'N/A';
                    document.getElementById('viewLeadNotes').textContent = lead.notes || 'N/A';
                    document.getElementById('viewLeadCreatedAt').textContent = lead.created_at;

                    // Populate Edit Lead form
                    document.getElementById('editLeadId').value = lead.id;
                    document.getElementById('editFirstName').value = lead.firstName;
                    document.getElementById('editLastName').value = lead.lastName || '';
                    document.getElementById('editTitle').value = lead.title || '';
                    document.getElementById('editCompany').value = lead.company;
                    document.getElementById('editEmail').value = lead.email || '';
                    document.getElementById('editPhone').value = lead.phone || '';
                    document.getElementById('editProduct').value = lead.product || '';
                    document.getElementById('editStage').value = lead.stage;
                    document.getElementById('editDateOfContact').value = lead.dateOfContact;
                    document.getElementById('editFollowUp').value = lead.followUp || '';
                    document.getElementById('editNotes').value = lead.notes || '';

                    // Populate Add Activity form
                    document.getElementById('activityLeadId').value = lead.id;
                    document.getElementById('activityLeadName').textContent = `${lead.firstName} ${lead.lastName || ''} (${lead.company})`;
                    fetchLeadActivities(lead.id); // Fetch activities for this lead

                    showTab('viewLead'); // Switch to view lead tab
                } else {
                    alert('Lead not found.');
                }
            } catch (error) {
                console.error('Error fetching lead details:', error);
                alert('Failed to load lead details.');
            }
        }
    });

    // Function to delete a lead
    document.getElementById('leadsList').addEventListener('click', async function(event) {
        if (event.target.classList.contains('delete-lead-btn')) {
            const leadId = event.target.dataset.id;
            if (confirm('Are you sure you want to delete this lead?')) {
                try {
                    const response = await fetch(`/api/leads?id=${leadId}`, { // Corrected API path
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    alert(result.message);
                    fetchLeads(); // Refresh leads list
                    showTab('leads'); // Go back to leads list
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    alert('Failed to delete lead.');
                }
            }
        }
    });

    // Function to update a lead
    document.getElementById('editLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());
        leadData.id = document.getElementById('editLeadId').value; // Ensure ID is included

        try {
            const response = await fetch('/api/leads', { // Corrected API path
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert(result.message);
            fetchLeads(); // Refresh leads list
            showTab('leads'); // Go back to leads list
        } catch (error) {
            console.error('Error updating lead:', error);
            alert('Failed to update lead.');
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
            const activitiesList = document.getElementById('leadActivitiesList');
            activitiesList.innerHTML = ''; // Clear existing activities

            activities.forEach(activity => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${activity.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.activity_type}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.activity_date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.description || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${activity.expenditure || '0.00'}</td>
                `;
                activitiesList.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching lead activities:', error);
            alert('Failed to load lead activities.');
        }
    }

    // Function to add a new lead activity
    document.getElementById('addActivityForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const activityData = Object.fromEntries(formData.entries());
        activityData.lead_id = document.getElementById('activityLeadId').value; // Ensure lead_id is included

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
            alert(result.message);
            this.reset();
            fetchLeadActivities(activityData.lead_id); // Refresh activities for current lead
            fetchCalendarEvents(); // Refresh calendar events as well
        } catch (error) {
            console.error('Error adding lead activity:', error);
            alert('Failed to add lead activity.');
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
            const expensesList = document.getElementById('generalExpensesList');
            expensesList.innerHTML = ''; // Clear existing expenses

            expenses.forEach(expense => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${expense.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.description}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.amount}</td>
                `;
                expensesList.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching general expenses:', error);
            alert('Failed to load general expenses.');
        }
    }

    // Function to add a new general expense
    document.getElementById('addExpenseForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const expenseData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/general_expenses', { // Corrected API path
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(expenseData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert(result.message);
            this.reset();
            fetchGeneralExpenses(); // Refresh expenses list
            fetchCalendarEvents(); // Refresh calendar events as well
        } catch (error) {
            console.error('Error adding general expense:', error);
            alert('Failed to add general expense.');
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
                title: `${event.type}: ${event.description || ''} ${event.lead_name ? '(' + event.lead_name + ')' : ''} ${event.amount ? ' - $' + event.amount : ''}`,
                start: event.date,
                allDay: true,
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
                    // Add event click listener if needed for details/editing
                    eventClick: function(info) {
                        // Example: alert(`${info.event.title} on ${info.event.startStr}`);
                        // You can open a modal here with event details
                    }
                });
                calendar.render();
            }
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            alert('Failed to load calendar events.');
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
            alert(result.message);
            this.reset();
            fetchCalendarEvents(); // Refresh calendar events
        } catch (error) {
            console.error('Error adding calendar event:', error);
            alert('Failed to add calendar event.');
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
            const reportTableBody = document.getElementById('expenditureReportTableBody');
            reportTableBody.innerHTML = ''; // Clear existing items

            let totalExpenditure = 0;

            reportItems.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.type_category}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.description || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${parseFloat(item.amount || 0).toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.lead_name || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.company || 'N/A'}</td>
                `;
                reportTableBody.appendChild(row);
                totalExpenditure += parseFloat(item.amount || 0);
            });

            document.getElementById('totalExpenditure').textContent = totalExpenditure.toFixed(2);
        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            alert('Failed to load expenditure report.');
        }
    }

    // Event listener for filtering expenditure report
    document.getElementById('filterReportBtn').addEventListener('click', function() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        fetchExpenditureReport(startDate, endDate);
    });

    // Function to export leads to CSV
    document.getElementById('exportLeadsBtn').addEventListener('click', async function() {
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
            alert('Leads exported successfully!');
        } catch (error) {
            console.error('Error exporting leads:', error);
            alert('Failed to export leads.');
        }
    });

    // Function to export expenditure report to CSV
    document.getElementById('exportExpenditureReportBtn').addEventListener('click', async function() {
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
            alert('Expenditure report exported successfully!');
        } catch (error) {
            console.error('Error exporting expenditure report:', error);
            alert('Failed to export expenditure report.');
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

    // Initial load: Show the leads tab by default
    showTab('leads');
});
