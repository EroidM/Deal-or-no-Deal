// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded. Initializing dashboard.");

    // Global variable to store fetched leads
    let allLeads = [];

    // --- Loading Spinner Functions ---
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

    // --- Message Box Function ---
    function showMessage(message, type) {
        const messageContainer = document.getElementById('messageContainer');
        if (messageContainer) {
            messageContainer.textContent = message;
            messageContainer.className = `message-container ${type} active`;
            setTimeout(() => {
                messageContainer.classList.remove('active');
            }, 3000);
        } else {
            console.warn('Message container not found. Message:', message);
        }
    }

    // Initialize Flatpickr for all date input fields
    flatpickr("#dateOfContact", {});
    flatpickr("#activityDate", {});
    flatpickr("#eventDate", {});
    flatpickr("#reportStartDate", {});
    flatpickr("#reportEndDate", {});
    flatpickr("#generalExpenseDate", {});

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
        const form = modalElement.querySelector('form');
        if (form) {
            form.reset();
        }
    }

    // Event listeners for opening modals via buttons
    document.getElementById('addLeadModalBtn').addEventListener('click', function() {
        showModal(leadModal, 'Add New Lead');
        document.getElementById('addLeadForm').reset();
        document.getElementById('leadId').value = '';
    });

    document.getElementById('addExpenseModalBtn').addEventListener('click', function() {
        showModal(generalExpenseModal, 'Add General Expense');
        document.getElementById('addExpenseForm').reset();
        document.getElementById('expenseId').value = '';
    });

    document.getElementById('addEventModalBtn').addEventListener('click', function() {
        showModal(generalEventModal, 'Add Calendar Event');
        document.getElementById('addEventForm').reset();
        document.getElementById('eventAmount').value = '0.00';
        populateLeadSelect(allLeads); // Pass allLeads to populate dropdown
    });

    // Event listeners for closing modals
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

    async function fetchLeads() {
        console.log("Executing fetchLeads()...");
        showLoading();
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const leads = await response.json();
            console.log("Leads data received from API:", leads);

            allLeads = leads; // Store fetched leads globally

            const leadsList = document.getElementById('recentLeadsTable').querySelector('tbody');
            leadsList.innerHTML = '';

            leads.forEach(lead => {
                const row = document.createElement('tr'); // FIX: Changed ':' to '.' here
                const firstName = lead.firstname || 'N/A';
                const lastName = lead.lastname || '';
                const dateOfContact = lead.dateofcontact ? new Date(lead.dateofcontact).toISOString().split('T')[0] : 'N/A';
                const followUp = lead.followup ? new Date(lead.followup).toISOString().split('T')[0] : 'N/A';

                row.innerHTML = `
                    <td data-label="Name">${firstName} ${lastName}</td>
                    <td data-label="Company">${lead.company || 'N/A'}</td>
                    <td data-label="Stage">${lead.stage || 'N/A'}</td>
                    <td data-label="Contact Date">${dateOfContact}</td>
                    <td data-label="Follow-up Date">${followUp}</td>
                    <td data-label="Actions">
                        <button class="text-indigo-600 hover:text-indigo-900 view-lead-btn" data-id="${lead.id}" title="View/Edit Lead"><i class="fas fa-eye"></i></button>
                        <button class="text-red-600 hover:text-red-900 delete-lead-btn" data-id="${lead.id}" title="Delete Lead"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                leadsList.appendChild(row);
            });
            updateLeadStats(leads);
            populateLeadSelect(leads); // This call is fine, uses the just-fetched leads
            updateUpcomingFollowups(leads);
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Failed to load leads.', 'error');
        } finally {
            hideLoading();
        }
    }

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

        updateLeadsByStageChart(leads);
    }

    function populateLeadSelect(leads) {
        console.log("Executing populateLeadSelect()...");
        console.log("Leads received by populateLeadSelect:", leads);
        const eventLeadSelect = document.getElementById('eventLeadId');
        eventLeadSelect.innerHTML = '<option value="">-- No Lead --</option>';

        if (!leads || leads.length === 0) {
            console.log("No leads available to populate dropdown.");
            return;
        }

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            option.textContent = `${lead.firstname || 'N/A'} ${lead.lastname || ''} (${lead.company || 'N/A'})`;
            eventLeadSelect.appendChild(option);
        });
        console.log("Lead select dropdown populated.");
    }

    let leadsByStageChart;
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
            leadsByStageChart.destroy();
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

    function updateUpcomingFollowups(leads) {
        console.log("Executing updateUpcomingFollowups()...");
        const upcomingList = document.getElementById('upcomingFollowupsList');
        upcomingList.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sortedFollowups = leads
            .filter(lead => lead.followup && new Date(lead.followup) >= today)
            .sort((a, b) => new Date(a.followup) - new Date(b.followup));

        if (sortedFollowups.length === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = 'No upcoming follow-ups.';
            upcomingList.appendChild(listItem);
            return;
        }

        sortedFollowups.forEach(lead => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="lead-name">${lead.firstname || 'N/A'} ${lead.lastname || ''} (${lead.company || 'N/A'})</span>
                <span class="followup-details">Follow-up on: ${lead.followup || 'N/A'} (Stage: ${lead.stage || 'N/A'})</span>
            `;
            upcomingList.appendChild(listItem);
        });
    }

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

        console.log(`Attempting to ${method} Lead:`, leadData);
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
                console.error(`API Error during ${method} Lead:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`Lead ${method} successful. Result:`, result);
            showMessage(result.message, 'success');
            console.log("Attempting to close lead modal and fetch leads...");
            closeModal(leadModal);
            fetchLeads();
        } catch (error) {
            console.error('Error saving lead:', error);
            showMessage('Failed to save lead.', 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('recentLeadsTable').addEventListener('click', async function(event) {
        if (event.target.closest('.view-lead-btn')) {
            const leadId = event.target.closest('.view-lead-btn').dataset.id;
            console.log("Viewing lead with ID:", leadId);
            showLoading();
            try {
                const response = await fetch(`/api/leads?id=${leadId}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error fetching lead details:`, errorText);
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const leads = await response.json();
                const lead = leads[0];
                console.log("Fetched lead details for editing:", lead);

                if (lead) {
                    document.getElementById('leadId').value = lead.id;
                    document.getElementById('firstName').value = lead.firstname || '';
                    document.getElementById('lastName').value = lead.lastname || '';
                    document.getElementById('title').value = lead.title || '';
                    document.getElementById('company').value = lead.company || '';
                    document.getElementById('email').value = lead.email || '';
                    document.getElementById('phone').value = lead.phone || '';
                    document.getElementById('product').value = lead.product || '';
                    document.getElementById('stage').value = lead.stage || '';
                    document.getElementById('dateOfContact').value = lead.dateofcontact ? new Date(lead.dateofcontact).toISOString().split('T')[0] : '';
                    document.getElementById('followUp').value = lead.followup ? new Date(lead.followup).toISOString().split('T')[0] : '';
                    document.getElementById('notes').value = lead.notes || '';

                    showModal(leadModal, 'Edit Lead');
                } else {
                    showMessage('Lead not found.', 'error');
                }
            }
            catch (error) {
                console.error('Error fetching lead details:', error);
                showMessage('Failed to load lead details.', 'error');
            } finally {
                hideLoading();
            }
        }
    });

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
                        console.error(`API Error deleting lead:`, errorText);
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    console.log(`Lead deletion successful. Result:`, result);
                    showMessage(result.message, 'success');
                    fetchLeads();
                    fetchCalendarEvents();
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    showMessage('Failed to delete lead.', 'error');
                } finally {
                    hideLoading();
                }
            }
        }
    });

    document.getElementById('addActivityForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const activityData = Object.fromEntries(formData.entries());
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
                console.error(`API Error adding lead activity:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`Lead activity added successful. Result:`, result);
            showMessage(result.message, 'success');
            console.log("Attempting to close visit modal and fetch data...");
            closeModal(visitModal);
            fetchCalendarEvents();
            fetchExpenditureReport();
            fetchLeads();
        } catch (error) {
            console.error('Error adding lead activity:', error);
            showMessage('Failed to add lead activity.', 'error');
        } finally {
            hideLoading();
        }
    });

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
        expenseData.amount = parseFloat(expenseData.amount || 0);

        console.log(`Attempting to ${method} General Expense:`, expenseData);
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
                console.error(`API Error during ${method} General Expense:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`General expense ${method} successful. Result:`, result);
            showMessage(result.message, 'success');
            console.log("Attempting to close general expense modal and fetch data...");
            closeModal(generalExpenseModal);
            fetchExpenditureReport();
            fetchCalendarEvents();
        } catch (error) {
            console.error('Error saving general expense:', error);
            showMessage('Failed to save general expense.', 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('expenditureReportTableBody').addEventListener('click', async function(event) {
        if (event.target.closest('.edit-expense-btn')) {
            const expenseId = event.target.closest('.edit-expense-btn').dataset.id;
            console.log("Editing expense with ID:", expenseId);
            showLoading();
            try {
                const response = await fetch(`/api/general_expenses?id=${expenseId}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error fetching expense details:`, errorText);
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const expenses = await response.json();
                const expense = expenses[0];
                console.log("Fetched expense details for editing:", expense);

                if (expense) {
                    document.getElementById('expenseId').value = expense.id;
                    document.getElementById('generalExpenseDate').value = expense.date ? new Date(expense.date).toISOString().split('T')[0] : '';
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
                        console.error(`API Error deleting expense:`, errorText);
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    console.log(`Expense deletion successful. Result:`, result);
                    showMessage(result.message, 'success');
                    fetchExpenditureReport();
                    fetchCalendarEvents();
                } catch (error) {
                    console.error('Error deleting expense:', error);
                    showMessage('Failed to delete expense.', 'error');
                } finally {
                    hideLoading();
                }
            }
        }
    });

    let calendar;
    async function fetchCalendarEvents() {
        console.log("Executing fetchCalendarEvents()...");
        showLoading();
        try {
            const response = await fetch('/api/calendar_events');
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error fetching calendar events:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const events = await response.json();
            console.log("Calendar events data received from API:", events);

            const calendarEvents = events.map(event => ({
                title: `${event.type || 'N/A'}: ${event.description || ''} ${event.lead_name ? '(' + event.lead_name + ')' : ''} ${event.amount && event.amount > 0 ? ' - KSh' + parseFloat(event.amount).toFixed(2) : ''}`,
                start: event.date || 'N/A',
                allDay: true,
                className: `fc-event-${(event.type || '').toLowerCase().replace(/\s/g, '-')}`,
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
                console.error(`API Error adding calendar event:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`Calendar event added successful. Result:`, result);
            showMessage(result.message, 'success');
            console.log("Attempting to close event modal and fetch data...");
            this.reset();
            closeModal(generalEventModal);
            fetchCalendarEvents();
            fetchExpenditureReport();
        } catch (error) {
            console.error('Error adding calendar event:', error);
            showMessage('Failed to add calendar event.', 'error');
        } finally {
            hideLoading();
        }
    });

    async function fetchExpenditureReport(startDate = '', endDate = '') {
        console.log("Executing fetchExpenditureReport()...");
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
                console.error(`API Error fetching expenditure report:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const reportItems = await response.json();
            console.log("Expenditure report data received from API:", reportItems);
            const reportTableBody = document.getElementById('expenditureReportTableBody');
            reportTableBody.innerHTML = '';

            let totalExpenditure = 0;

            reportItems.forEach(item => {
                console.log("Processing expenditure item:", item);
                const row = document.createElement('tr');
                let actionsHtml = '';
                if (item.type_category === 'General Expense' && item.source_table === 'general_expenses') {
                    actionsHtml = `
                        <button class="text-indigo-600 hover:text-indigo-900 edit-expense-btn" data-id="${item.id}" title="Edit Expense"><i class="fas fa-edit"></i></button>
                        <button class="text-red-600 hover:text-red-900 delete-expense-btn" data-id="${item.id}" title="Delete Expense"><i class="fas fa-trash-alt"></i></button>
                    `;
                } else {
                    actionsHtml = 'N/A';
                }

                const leadName = item.lead_name || 'N/A';
                const companyName = item.company || 'N/A';
                const expenseDate = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';

                row.innerHTML = `
                    <td data-label="Date">${expenseDate}</td>
                    <td data-label="Category">${item.type_category || 'N/A'}</td>
                    <td data-label="Description">${item.description || 'N/A'}</td>
                    <td data-label="Amount (KSh)">${parseFloat(item.amount || 0).toFixed(2)}</td>
                    <td data-label="Lead Name">${leadName}</td>
                    <td data-label="Company">${companyName}</td>
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

    // Event listener for filtering the expenditure report by date range
    document.getElementById('filterReportBtn').addEventListener('click', function() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value; // FIX: Changed ']' to ')' here
        fetchExpenditureReport(startDate, endDate); // Call the function to fetch and display the filtered report
    });

    // Event listener for clearing date filters on the expenditure report
    document.getElementById('clearReportDatesBtn').addEventListener('click', function() {
        document.getElementById('reportStartDate').value = '';
        document.getElementById('reportEndDate').value = '';
        fetchExpenditureReport(); // Fetch report without filters
    });

    document.getElementById('exportLeadsBtn').addEventListener('click', async function() {
        console.log("Exporting leads...");
        showLoading();
        try {
            const response = await fetch('/api/export_leads');
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error exporting leads:`, errorText);
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

    document.getElementById('exportExpenditureReportBtn').addEventListener('click', async function() {
        console.log("Exporting expenditure report...");
        showLoading();
        try {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value; // FIX: Changed ']' to ')' here
            let url = `/api/export_expenditure_report`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error exporting expenditure report:`, errorText);
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

    // Initial data load when the page loads
    fetchLeads();
    fetchCalendarEvents();
    fetchExpenditureReport();
});
