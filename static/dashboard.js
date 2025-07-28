// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded. Initializing dashboard.");

    // Global variable to store fetched leads
    let allLeads = [];
    // Global variables to store table data for client-side sorting
    let currentLeadsData = [];
    let currentExpenditureData = [];

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
    flatpickr("#followUp", {}); // Ensure followUp also has flatpickr

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
        document.getElementById('eventId').value = ''; // Ensure eventId is cleared for new entries
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

    // --- Table Sorting Functionality ---
    function enableTableSorting(tableId, dataArray, renderFunction) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.warn(`Table with ID ${tableId} not found for sorting.`);
            return;
        }
        const headers = table.querySelectorAll('th[data-sort-by]');

        headers.forEach(header => {
            header.addEventListener('click', function() {
                const sortBy = this.dataset.sortBy;
                let sortOrder = this.dataset.sortOrder || 'asc'; // Default to ascending

                // Remove existing sort indicators from other headers
                headers.forEach(h => {
                    if (h !== this) {
                        h.classList.remove('asc', 'desc');
                        h.dataset.sortOrder = '';
                    }
                });

                // Toggle sort order for the clicked header
                if (sortOrder === 'asc') {
                    sortOrder = 'desc';
                    this.classList.remove('asc');
                    this.classList.add('desc');
                } else {
                    sortOrder = 'asc';
                    this.classList.remove('desc');
                    this.classList.add('asc');
                }
                this.dataset.sortOrder = sortOrder;

                // Sort the data
                dataArray.sort((a, b) => {
                    let valA = a[sortBy];
                    let valB = b[sortBy];

                    // Handle numerical sorting
                    if (typeof valA === 'number' && typeof valB === 'number') {
                        return sortOrder === 'asc' ? valA - valB : valB - valA;
                    }
                    // Handle date sorting
                    if (sortBy.includes('Date') || sortBy.includes('date') || sortBy.includes('followUp')) { // Added followUp
                        valA = valA ? new Date(valA) : null;
                        valB = valB ? new Date(valB) : null;
                        
                        // Handle null/undefined dates for sorting
                        if (valA === null && valB === null) return 0;
                        if (valA === null) return sortOrder === 'asc' ? 1 : -1; // Nulls last for asc, first for desc
                        if (valB === null) return sortOrder === 'asc' ? -1 : 1;

                        return sortOrder === 'asc' ? valA - valB : valB - valA;
                    }
                    // Handle string sorting (case-insensitive)
                    if (valA === null || valA === undefined) valA = '';
                    if (valB === null || valB === undefined) valB = '';
                    
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();

                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });

                // Re-render the table with sorted data
                renderFunction(dataArray);
            });
        });
    }

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
            currentLeadsData = [...leads]; // Store a copy for sorting

            renderLeadsTable(currentLeadsData); // Render initial table
            updateLeadStats(leads);
            populateLeadSelect(leads);
            updateUpcomingFollowups(leads);
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Failed to load leads.', 'error');
        } finally {
            hideLoading();
        }
    }

    function renderLeadsTable(leadsToRender) {
        const leadsList = document.getElementById('recentLeadsTable').querySelector('tbody');
        leadsList.innerHTML = ''; // Clear existing leads to prevent duplication

        leadsToRender.forEach(lead => {
            const row = document.createElement('tr');
            const firstName = lead.firstName || '';
            const lastName = lead.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const displayName = fullName || 'N/A'; // Use N/A if both first and last name are empty

            const dateOfContact = lead.dateOfContact ? new Date(lead.dateOfContact).toISOString().split('T')[0] : 'N/A';
            const followUp = lead.followUp ? new Date(lead.followUp).toISOString().split('T')[0] : 'N/A';

            row.innerHTML = `
                <td data-label="Name">${displayName}</td>
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
            // Display lead name and company, with 'N/A' fallback for name if empty
            const leadDisplayName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
            const companyDisplayName = lead.company || '';

            if (leadDisplayName && companyDisplayName) {
                option.textContent = `${leadDisplayName} (${companyDisplayName})`;
            } else if (leadDisplayName) {
                option.textContent = leadDisplayName;
            } else if (companyDisplayName) {
                option.textContent = companyDisplayName;
            } else {
                option.textContent = `Lead ID: ${lead.id}`; // Fallback if neither name nor company
            }
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
            const leadDisplayName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
            const companyDisplayName = lead.company || '';
            let displayString = '';

            if (leadDisplayName && companyDisplayName) {
                displayString = `${leadDisplayName} (${companyDisplayName})`;
            } else if (leadDisplayName) {
                displayString = leadDisplayName;
            } else if (companyDisplayName) {
                displayString = companyDisplayName;
            } else {
                displayString = `Lead ID: ${lead.id}`;
            }

            listItem.innerHTML = `
                <span class="lead-name">${displayString}</span>
                <span class="followup-details">Follow-up on: ${new Date(lead.followUp).toISOString().split('T')[0]} (Stage: ${lead.stage || 'N/A'})</span>
            `;
            upcomingList.appendChild(listItem);
        });
    }

    document.getElementById('addLeadForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());
        const leadId = document.getElementById('leadId').value;

        // Client-side validation for required fields
        if (!leadData.firstName || leadData.firstName.trim() === '') {
            showMessage('First Name is required.', 'error');
            return;
        }
        if (!leadData.company || leadData.company.trim() === '') {
            showMessage('Company is required.', 'error');
            return;
        }
        if (!leadData.dateOfContact || leadData.dateOfContact.trim() === '') {
            showMessage('Date of Contact is required.', 'error');
            return;
        }

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
            fetchLeads(); // Re-fetch leads to update all lists and dropdowns
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
                    document.getElementById('firstName').value = lead.firstName || '';
                    document.getElementById('lastName').value = lead.lastName || '';
                    document.getElementById('title').value = lead.title || '';
                    document.getElementById('company').value = lead.company || '';
                    document.getElementById('email').value = lead.email || '';
                    document.getElementById('phone').value = lead.phone || '';
                    document.getElementById('product').value = lead.product || '';
                    document.getElementById('stage').value = lead.stage || '';
                    document.getElementById('dateOfContact').value = lead.dateOfContact ? new Date(lead.dateOfContact).toISOString().split('T')[0] : '';
                    document.getElementById('followUp').value = lead.followUp ? new Date(lead.followUp).toISOString().split('T')[0] : '';
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
            // Replaced alert with showMessage for consistency and better UX
            showMessage('Are you sure you want to delete this lead? This will also remove associated calendar events and activities. Click again to confirm.', 'warning');
            
            // Simple double-click confirmation for demonstration. For production, consider a custom confirmation modal.
            let confirmDeleteTimeout;
            const confirmBtn = event.target.closest('.delete-lead-btn');
            confirmBtn.dataset.confirmClick = (parseInt(confirmBtn.dataset.confirmClick) || 0) + 1;

            if (confirmBtn.dataset.confirmClick === '2') {
                clearTimeout(confirmDeleteTimeout);
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
                    fetchExpenditureReport(); // Also refresh expenditure report
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    showMessage('Failed to delete lead.', 'error');
                } finally {
                    hideLoading();
                    confirmBtn.dataset.confirmClick = '0'; // Reset confirm click
                }
            } else {
                confirmDeleteTimeout = setTimeout(() => {
                    confirmBtn.dataset.confirmClick = '0'; // Reset after a short delay
                    showMessage('', ''); // Clear message
                }, 3000);
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

    // Event listener for editing/deleting an expense from the Expenditure Report table
    document.getElementById('expenditureReportTableBody').addEventListener('click', async function(event) {
        const targetBtn = event.target.closest('.edit-expense-btn, .delete-expense-btn');
        if (!targetBtn) return;

        const itemId = targetBtn.dataset.id;
        const sourceType = targetBtn.dataset.source;

        if (targetBtn.classList.contains('edit-expense-btn')) {
            console.log(`Editing item with ID: ${itemId} from source: ${sourceType}`);
            showLoading();
            try {
                let url;
                if (sourceType === 'general_expenses') {
                    url = `/api/general_expenses?id=${itemId}`;
                } else if (sourceType === 'calendar_events') {
                    url = `/api/calendar_events?id=${itemId}`;
                } else {
                    throw new Error("Unknown source type for editing.");
                }

                const response = await fetch(url);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error fetching item details for editing:`, errorText);
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const items = await response.json();
                const item = items[0];
                console.log("Fetched item details for editing:", item);

                if (item) {
                    if (sourceType === 'general_expenses') {
                        document.getElementById('expenseId').value = item.id;
                        document.getElementById('generalExpenseDate').value = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
                        document.getElementById('generalExpenseAmount').value = parseFloat(item.amount || 0).toFixed(2);
                        document.getElementById('generalExpenseDescription').value = item.description || '';
                        showModal(generalExpenseModal, 'Edit General Expense');
                    } else if (sourceType === 'calendar_events') {
                        document.getElementById('eventId').value = item.id;
                        document.getElementById('eventDate').value = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
                        document.getElementById('eventType').value = item.type || '';
                        document.getElementById('eventDescription').value = item.description || '';
                        document.getElementById('eventAmount').value = parseFloat(item.amount || 0).toFixed(2);
                        await populateLeadSelect(allLeads); // Ensure leads are loaded before setting value
                        document.getElementById('eventLeadId').value = item.lead_id || '';
                        showModal(generalEventModal, 'Edit Calendar Event');
                    }
                } else {
                    showMessage('Item not found.', 'error');
                }
            } catch (error) {
                console.error('Error fetching item details:', error);
                showMessage('Failed to load item details.', 'error');
            } finally {
                hideLoading();
            }
        }

        if (targetBtn.classList.contains('delete-expense-btn')) {
            // Replaced alert with showMessage for consistency and better UX
            showMessage('Are you sure you want to delete this item? Click again to confirm.', 'warning');
            
            // Simple double-click confirmation for demonstration. For production, consider a custom confirmation modal.
            let confirmDeleteTimeout;
            const confirmBtn = event.target.closest('.delete-expense-btn');
            confirmBtn.dataset.confirmClick = (parseInt(confirmBtn.dataset.confirmClick) || 0) + 1;

            if (confirmBtn.dataset.confirmClick === '2') {
                clearTimeout(confirmDeleteTimeout);
                console.log(`Deleting item with ID: ${itemId} from source: ${sourceType}`);
                showLoading();
                try {
                    let url;
                    if (sourceType === 'general_expenses') {
                        url = `/api/general_expenses?id=${itemId}`;
                    } else if (sourceType === 'calendar_events') {
                        url = `/api/calendar_events?id=${itemId}`;
                    } else {
                        throw new Error("Unknown source type for deletion.");
                    }

                    const response = await fetch(url, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`API Error deleting item:`, errorText);
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    console.log(`Item deletion successful. Result:`, result);
                    showMessage(result.message, 'success');
                    fetchExpenditureReport();
                    fetchCalendarEvents();
                    fetchLeads(); // Refresh leads as well, in case a linked event was deleted
                } catch (error) {
                    console.error('Error deleting item:', error);
                    showMessage('Failed to delete item.', 'error');
                } finally {
                    hideLoading();
                    confirmBtn.dataset.confirmClick = '0'; // Reset confirm click
                }
            } else {
                confirmDeleteTimeout = setTimeout(() => {
                    confirmBtn.dataset.confirmClick = '0'; // Reset after a short delay
                    showMessage('', ''); // Clear message
                }, 3000);
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
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const events = await response.json();
            console.log("Calendar events data received from API:", events);

            const calendarEvents = events.map(event => ({
                // Ensure lead_name and company are correctly displayed
                title: `${event.type || 'N/A'}: ${event.description || ''} ${event.lead_name ? '(' + event.lead_name + (event.company ? ', ' + event.company : '') + ')' : ''} ${event.amount && event.amount > 0 ? ' - KSh' + parseFloat(event.amount).toFixed(2) : ''}`,
                start: event.date || 'N/A',
                allDay: true,
                className: `fc-event-${(event.type || '').toLowerCase().replace(/\s/g, '-')}`,
                extendedProps: {
                    type: event.type,
                    leadId: event.lead_id,
                    amount: event.amount,
                    description: event.description,
                    id: event.id,
                    leadName: event.lead_name, // Pass lead name for tooltip
                    company: event.company // Pass company for tooltip
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
                            const eventProps = info.event.extendedProps;
                            let tooltipHtml = `
                                <strong>${info.event.title}</strong>
                                <span>Date: ${info.event.startStr}</span>
                            `;
                            if (eventProps.description) {
                                tooltipHtml += `<span>Description: ${eventProps.description}</span>`;
                            }
                            if (eventProps.leadName) {
                                tooltipHtml += `<span>Lead: ${eventProps.leadName}</span>`;
                            }
                            if (eventProps.company) {
                                tooltipHtml += `<span>Company: ${eventProps.company}</span>`;
                            }
                            if (eventProps.amount && eventProps.amount > 0) {
                                tooltipHtml += `<span>Amount: KSh ${parseFloat(eventProps.amount).toFixed(2)}</span>`;
                            }

                            tooltip.innerHTML = tooltipHtml;
                            tooltip.style.left = `${info.el.getBoundingClientRect().left + window.scrollX}px`;
                            tooltip.style.top = `${info.el.getBoundingClientRect().top + window.scrollY - tooltip.offsetHeight - 10}px`;
                            tooltip.classList.add('active');
                        });
                        info.el.addEventListener('mouseout', function() {
                            tooltip.classList.remove('active');
                        });
                    },
                    eventClick: function(info) {
                        // When an event is clicked on the calendar, open the generalEventModal for editing
                        const eventProps = info.event.extendedProps;
                        document.getElementById('eventId').value = eventProps.id;
                        document.getElementById('eventDate').value = info.event.startStr;
                        document.getElementById('eventType').value = eventProps.type || '';
                        document.getElementById('eventDescription').value = eventProps.description || '';
                        document.getElementById('eventAmount').value = parseFloat(eventProps.amount || 0).toFixed(2);
                        populateLeadSelect(allLeads); // Ensure leads are loaded for the dropdown
                        document.getElementById('eventLeadId').value = eventProps.leadId || ''; // Select the linked lead

                        showModal(generalEventModal, 'Edit Calendar Event');
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
        const eventId = document.getElementById('eventId').value;

        let url = '/api/calendar_events';
        let method = 'POST';

        if (eventId) {
            method = 'PUT';
            eventData.id = eventId;
        }

        eventData.lead_id = eventData.lead_id === '' ? null : eventData.lead_id;
        eventData.amount = eventData.amount === '' ? 0 : parseFloat(eventData.amount);

        console.log(`Attempting to ${method} Calendar Event:`, eventData);
        showLoading();
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error during ${method} Calendar Event:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`Calendar event ${method} successful. Result:`, result);
            showMessage(result.message, 'success');
            console.log("Attempting to close event modal and fetch data...");
            this.reset();
            closeModal(generalEventModal);
            fetchCalendarEvents();
            fetchExpenditureReport();
            fetchLeads(); // Re-fetch leads to update follow-ups and stats
        } catch (error) {
            console.error('Error saving calendar event:', error);
            showMessage('Failed to save calendar event.', 'error');
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
            
            currentExpenditureData = [...reportItems]; // Store a copy for sorting
            renderExpenditureReportTable(currentExpenditureData); // Render initial table

        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            showMessage('Failed to load expenditure report.', 'error');
        } finally {
            hideLoading();
        }
    }

    function renderExpenditureReportTable(reportItemsToRender) {
        const reportTableBody = document.getElementById('expenditureReportTableBody');
        reportTableBody.innerHTML = '';

        let totalExpenditure = 0;

        reportItemsToRender.forEach(item => {
            console.log("Processing expenditure item:", item);
            const row = document.createElement('tr');
            let actionsHtml = `
                <button class="text-indigo-600 hover:text-indigo-900 edit-expense-btn" data-id="${item.id}" data-source="${item.source_table}" title="Edit Item"><i class="fas fa-edit"></i></button>
                <button class="text-red-600 hover:text-red-900 delete-expense-btn" data-id="${item.id}" data-source="${item.source_table}" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
            `;
            // If item has no ID (e.g., aggregated data or a special entry), hide action buttons.
            // This condition might need adjustment based on how 'id' is guaranteed for editable items.
            if (item.id === undefined || item.id === null) { 
                actionsHtml = 'N/A';
            }

            // --- Improved Lead Name and Company Display Logic ---
            let leadNameDisplay = item.lead_name || 'N/A';
            let companyNameDisplay = item.company || 'N/A';

            const expenseDate = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';

            row.innerHTML = `
                <td data-label="Date">${expenseDate}</td>
                <td data-label="Category">${item.type_category || 'N/A'}</td>
                <td data-label="Description">${item.description || 'N/A'}</td>
                <td data-label="Amount (KSh)">${parseFloat(item.amount || 0).toFixed(2)}</td>
                <td data-label="Lead Name">${leadNameDisplay}</td>
                <td data-label="Company">${companyNameDisplay}</td>
                <td data-label="Actions">${actionsHtml}</td>
            `;
            reportTableBody.appendChild(row);
            totalExpenditure += parseFloat(item.amount || 0);
        });

        document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh ${totalExpenditure.toFixed(2)}`;
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
            const endDate = document.getElementById('reportEndDate').value;
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

    // Enable sorting after initial data load (or when data is updated)
    // Call these AFTER the initial fetch functions have populated currentLeadsData and currentExpenditureData
    // For leads table
    document.getElementById('recentLeadsTable').addEventListener('click', function(event) {
        // Check if the click was on a TH element with data-sort-by
        const targetTh = event.target.closest('th[data-sort-by]');
        if (targetTh) {
            // If sorting is not yet enabled, enable it once.
            // This ensures the event listener is set up only once per table.
            if (!targetTh.dataset.sortingEnabled) {
                enableTableSorting('recentLeadsTable', currentLeadsData, renderLeadsTable);
                targetTh.dataset.sortingEnabled = 'true'; // Mark as enabled
            }
            // Manually trigger click on the header to apply sorting
            targetTh.click(); 
        }
    });

    // For expenditure report table
    document.getElementById('expenditureReportTable').addEventListener('click', function(event) {
        // Check if the click was on a TH element with data-sort-by
        const targetTh = event.target.closest('th[data-sort-by]');
        if (targetTh) {
            // If sorting is not yet enabled, enable it once.
            if (!targetTh.dataset.sortingEnabled) {
                enableTableSorting('expenditureReportTable', currentExpenditureData, renderExpenditureReportTable);
                targetTh.dataset.sortingEnabled = 'true'; // Mark as enabled
            }
            // Manually trigger click on the header to apply sorting
            targetTh.click();
        }
    });
});

