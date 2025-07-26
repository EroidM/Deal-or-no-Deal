// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded. Initializing dashboard.");

    // Initialize Flatpickr for all date inputs
    flatpickr("#dateOfContact", {});
    flatpickr("#activityDate", {});
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
        console.log(`Showing modal: ${modalElement.id} with title: ${title}`);
        if (title) {
            const modalTitleElement = modalElement.querySelector('h2');
            if (modalTitleElement) {
                modalTitleElement.textContent = title;
            }
        }
        modalElement.classList.add('active');
    }

    function closeModal(modalElement) {
        console.log(`Closing modal: ${modalElement.id}`);
        modalElement.classList.remove('active');
        // Clear forms on close
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
        document.getElementById('eventAmount').value = '0.00'; // Reset amount to default
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
        console.log("Fetching leads...");
        showLoading();
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const leads = await response.json();
            const leadsList = document.getElementById('recentLeadsTable').querySelector('tbody');
            leadsList.innerHTML = ''; // Clear existing leads to prevent duplication

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
            updateLeadStats(leads); // Update dashboard stats
            populateLeadSelect(leads); // Populate lead dropdowns
            updateUpcomingFollowups(leads); // Ensure upcoming follow-ups are updated
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Failed to load leads.', 'error');
        } finally {
            hideLoading();
        }
    }

    // Function to update lead statistics
    function updateLeadStats(leads) {
        console.log("Updating lead statistics...");
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
    }

    // Function to populate lead select dropdowns (for activities/events)
    function populateLeadSelect(leads = []) {
        console.log("Populating lead select dropdowns...");
        const eventLeadSelect = document.getElementById('eventLeadId');
        // Clear existing options, add default "No Lead" option for calendar events
        eventLeadSelect.innerHTML = '<option value="">-- No Lead --</option>';

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            option.textContent = `${lead.firstName || 'N/A'} ${lead.lastName || ''} (${lead.company || 'N/A'})`;
            eventLeadSelect.appendChild(option);
        });
    }

    // Function to update Leads by Stage Chart
    let leadsByStageChart; // Declare chart globally
    function updateLeadsByStageChart(leads) {
        console.log("Updating leads by stage chart...");
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
            type: 'doughnut',
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
        console.log("Updating upcoming follow-ups...");
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

    // Function to add/update a lead
    document.getElementById('addLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());
        const leadId = document.getElementById('leadId').value;

        let url = '/api/leads';
        let method = 'POST';

        if (leadId) {
            method = 'PUT';
            leadData.id = leadId;
        }

        console.log(`${method} Lead:`, leadData);
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
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(leadModal);
            fetchLeads(); // Refresh leads list and related sections
        } catch (error) {
            console.error('Error saving lead:', error);
            showMessage('Failed to save lead.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to view lead details (and populate edit form)
    document.getElementById('recentLeadsTable').addEventListener('click', async function(event) {
        if (event.target.closest('.view-lead-btn')) {
            const leadId = event.target.closest('.view-lead-btn').dataset.id;
            console.log("Viewing lead with ID:", leadId);
            showLoading();
            try {
                const response = await fetch(`/api/leads?id=${leadId}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const leads = await response.json();
                const lead = leads[0];

                if (lead) {
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

                    showModal(leadModal, 'Edit Lead');
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
        if (event.target.closest('.delete-lead-btn')) {
            const leadId = event.target.closest('.delete-lead-btn').dataset.id;
            if (confirm('Are you sure you want to delete this lead? This will also remove associated calendar events and activities.')) {
                console.log("Deleting lead with ID:", leadId);
                showLoading();
                try {
                    const response = await fetch(`/api/leads?id=${leadId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success');
                    fetchLeads(); // Refresh leads list and related sections
                    fetchCalendarEvents(); // Refresh calendar as lead deletion affects events
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    showMessage('Failed to delete lead.', 'error');
                } finally {
                    hideLoading();
                }
            }
        }
    });

    // Function to add a new lead activity (visit/call/email etc.)
    document.getElementById('addActivityForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const activityData = Object.fromEntries(formData.entries());
        // Ensure lead_id is included and expenditure is parsed as float
        activityData.lead_id = document.getElementById('activityLeadId').value || null;
        activityData.expenditure = parseFloat(activityData.expenditure || 0);

        console.log("Adding Lead Activity:", activityData);
        showLoading();
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
            closeModal(visitModal);
            fetchCalendarEvents(); // Refresh calendar events
            fetchExpenditureReport(); // Refresh expenditure report (if activity has amount)
            fetchLeads(); // Refresh leads to update follow-ups/stats if needed
        } catch (error) {
            console.error('Error adding lead activity:', error);
            showMessage('Failed to add lead activity.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to add or update a general expense
    document.getElementById('addExpenseForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const expenseData = Object.fromEntries(formData.entries());
        const expenseId = document.getElementById('expenseId').value;

        let url = '/api/general_expenses';
        let method = 'POST';

        if (expenseId) {
            method = 'PUT';
            expenseData.id = expenseId;
        }
        expenseData.amount = parseFloat(expenseData.amount || 0); // Ensure amount is float

        console.log(`${method} General Expense:`, expenseData);
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
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(generalExpenseModal);
            fetchExpenditureReport(); // Refresh expenditure report
            fetchCalendarEvents(); // Refresh calendar events (if general expenses are shown there)
        } catch (error) {
            console.error('Error saving general expense:', error);
            showMessage('Failed to save general expense.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Event listener for editing/deleting an expense from the expenditure report table
    document.getElementById('expenditureReportTableBody').addEventListener('click', async function(event) {
        // Handle Edit button click
        if (event.target.closest('.edit-expense-btn')) {
            const expenseId = event.target.closest('.edit-expense-btn').dataset.id;
            console.log("Editing expense with ID:", expenseId);
            showLoading();
            try {
                const response = await fetch(`/api/general_expenses?id=${expenseId}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const expenses = await response.json();
                const expense = expenses[0];

                if (expense) {
                    document.getElementById('expenseId').value = expense.id;
                    document.getElementById('generalExpenseDate').value = expense.date || '';
                    document.getElementById('generalExpenseAmount').value = parseFloat(expense.amount || 0).toFixed(2);
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

        // Handle Delete button click
        if (event.target.closest('.delete-expense-btn')) {
            const expenseId = event.target.closest('.delete-expense-btn').dataset.id;
            if (confirm('Are you sure you want to delete this expense?')) {
                console.log("Deleting expense with ID:", expenseId);
                showLoading();
                try {
                    const response = await fetch(`/api/general_expenses?id=${expenseId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success');
                    fetchExpenditureReport(); // Refresh expenditure report
                    fetchCalendarEvents(); // Refresh calendar events (if general expenses are shown there)
                } catch (error) {
                    console.error('Error deleting expense:', error);
                    showMessage('Failed to delete expense.', 'error');
                } finally {
                    hideLoading();
                }
            }
        }
    });

    // Function to fetch and display calendar events
    let calendar;
    async function fetchCalendarEvents() {
        console.log("Fetching calendar events...");
        showLoading();
        try {
            const response = await fetch('/api/calendar_events');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
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
                    description: event.description,
                    id: event.id
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
                        showMessage(`Event: ${info.event.title} on ${info.event.startStr}`, 'info');
                    }
                });
                calendar.render();
            }
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            showMessage('Failed to load calendar events.', 'error');
        } finally {
            hideLoading();
        }
    }

    // Function to add a new calendar event
    document.getElementById('addEventForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const eventData = Object.fromEntries(formData.entries());
        eventData.lead_id = eventData.lead_id === '' ? null : eventData.lead_id;
        eventData.amount = eventData.amount === '' ? 0 : parseFloat(eventData.amount);

        console.log("Adding Calendar Event:", eventData);
        showLoading();
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
            this.reset();
            closeModal(generalEventModal);
            fetchCalendarEvents(); // Refresh calendar events
            fetchExpenditureReport(); // Refresh expenditure report (if event has amount)
        } catch (error) {
            console.error('Error adding calendar event:', error);
            showMessage('Failed to add calendar event.', 'error');
        } finally {
            hideLoading();
        }
    });

    // Function to fetch and display expenditure report
    async function fetchExpenditureReport(startDate = '', endDate = '') {
        console.log("Fetching expenditure report...");
        showLoading();
        try {
            let url = `/api/expenditure_report`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const reportItems = await response.json();
            const reportTableBody = document.getElementById('expenditureReportTableBody');
            reportTableBody.innerHTML = ''; // Clear existing items to prevent duplication

            let totalExpenditure = 0;

            reportItems.forEach(item => {
                const row = document.createElement('tr');
                let actionsHtml = '';
                // Only show edit/delete buttons for 'General Expense' type AND if it originated from general_expenses table
                // This prevents editing/deleting calendar events from this table
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
                totalExpenditure += parseFloat(item.amount || 0);
            });

            document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh ${totalExpenditure.toFixed(2)}`;
        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            showMessage('Failed to load expenditure report.', 'error');
        } finally {
            hideLoading();
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
        console.log("Exporting leads...");
        showLoading();
        try {
            const response = await fetch('/api/export_leads');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
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
        console.log("Exporting expenditure report...");
        showLoading();
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
            hideLoading();
        }
    });

    // Initial load: Fetch all necessary data
    fetchLeads(); // Fetches leads, updates stats, populates dropdowns, and updates upcoming follow-ups
    fetchCalendarEvents(); // Fetches and renders calendar events
    fetchExpenditureReport(); // Fetches and renders expenditure report
});
