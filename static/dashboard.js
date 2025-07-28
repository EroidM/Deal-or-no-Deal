// dashboard.js - Rewritten for clarity, robustness, and error prevention

document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard.js: DOM Content Loaded. Initializing dashboard components.");

    // Global variables to hold fetched data for client-side operations like sorting
    let allLeads = [];
    let currentLeadsData = [];
    let currentExpenditureData = [];
    let calendarInstance; // To store the FullCalendar instance

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
        const messageContainer = document.getElementById('messageContainer');
        if (messageContainer) {
            messageContainer.textContent = message;
            messageContainer.className = `message-container ${type} active`;
            setTimeout(() => {
                messageContainer.classList.remove('active');
            }, 3000); // Message disappears after 3 seconds
        } else {
            console.warn('Dashboard.js: Message container not found. Message:', message);
        }
    }

    // --- Flatpickr Initialization ---

    // Common options for all date pickers for consistent formatting
    const commonFlatpickrOptions = {
        dateFormat: "Y-m-d", // YYYY-MM-DD format
        allowInput: true,    // Allow manual date input
    };

    // Initialize Flatpickr on all relevant date input fields
    flatpickr("#dateOfContact", commonFlatpickrOptions);
    flatpickr("#activityDate", commonFlatpickrOptions);
    flatpickr("#eventDate", commonFlatpickrOptions);
    flatpickr("#reportStartDate", commonFlatpickrOptions);
    flatpickr("#reportEndDate", commonFlatpickrOptions);
    flatpickr("#generalExpenseDate", commonFlatpickrOptions);
    flatpickr("#followUp", commonFlatpickrOptions);

    // --- Modal Handling ---

    // Get references to all modal elements
    const leadModal = document.getElementById('leadModal');
    const visitModal = document.getElementById('visitModal');
    const generalExpenseModal = document.getElementById('generalExpenseModal');
    const generalEventModal = document.getElementById('generalEventModal');

    /**
     * Shows a specific modal.
     * @param {HTMLElement} modalElement - The modal DOM element to show.
     * @param {string} [title=''] - Optional title to set for the modal's H2.
     */
    function showModal(modalElement, title = '') {
        console.log(`Dashboard.js: Showing modal: ${modalElement.id} with title: "${title}"`);
        if (title) {
            const modalTitleElement = modalElement.querySelector('h2');
            if (modalTitleElement) {
                modalTitleElement.textContent = title;
            }
        }
        modalElement.classList.add('active');
    }

    /**
     * Closes a specific modal and resets its form.
     * @param {HTMLElement} modalElement - The modal DOM element to close.
     */
    function closeModal(modalElement) {
        console.log(`Dashboard.js: Closing modal: ${modalElement.id}`);
        modalElement.classList.remove('active');
        const form = modalElement.querySelector('form');
        if (form) {
            form.reset(); // Reset form fields on close
        }
    }

    // Event listeners for opening modals via buttons
    document.getElementById('addLeadModalBtn')?.addEventListener('click', function() {
        showModal(leadModal, 'Add New Lead');
        document.getElementById('addLeadForm')?.reset();
        document.getElementById('leadId').value = ''; // Clear hidden ID for new entry
    });

    document.getElementById('addExpenseModalBtn')?.addEventListener('click', function() {
        showModal(generalExpenseModal, 'Add General Expense');
        document.getElementById('addExpenseForm')?.reset();
        document.getElementById('expenseId').value = ''; // Clear hidden ID for new entry
        document.getElementById('generalExpenseAmount').value = '0.00'; // Default amount
    });

    document.getElementById('addEventModalBtn')?.addEventListener('click', function() {
        showModal(generalEventModal, 'Add Calendar Event');
        document.getElementById('addEventForm')?.reset();
        document.getElementById('eventAmount').value = '0.00'; // Default amount
        document.getElementById('eventId').value = ''; // Clear hidden ID for new entry
        populateLeadSelect(allLeads); // Ensure lead dropdown is populated
    });

    // Event listeners for closing modals via close buttons
    document.getElementById('closeLeadModalBtn')?.addEventListener('click', () => closeModal(leadModal));
    document.getElementById('closeVisitModalBtn')?.addEventListener('click', () => closeModal(visitModal));
    document.getElementById('closeGeneralExpenseModalBtn')?.addEventListener('click', () => closeModal(generalExpenseModal));
    document.getElementById('closeGeneralEventModalBtn')?.addEventListener('click', () => closeModal(generalEventModal));

    // Close modal when clicking outside the modal content area
    window.addEventListener('click', function(event) {
        if (event.target === leadModal) closeModal(leadModal);
        if (event.target === visitModal) closeModal(visitModal);
        if (event.target === generalExpenseModal) closeModal(generalExpenseModal);
        if (event.target === generalEventModal) closeModal(generalEventModal);
    });

    // --- Table Sorting Functionality ---

    /**
     * Enables client-side sorting for a given table.
     * @param {string} tableId - The ID of the table to make sortable.
     * @param {Array<Object>} dataArray - The array of data backing the table.
     * @param {function(Array<Object>): void} renderFunction - The function to call to re-render the table with sorted data.
     */
    function enableTableSorting(tableId, dataArray, renderFunction) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.warn(`Dashboard.js: Table with ID "${tableId}" not found for sorting.`);
            return;
        }
        const headers = table.querySelectorAll('th[data-sort-by]');

        headers.forEach(header => {
            // Check if the event listener has already been added to prevent duplicates
            if (!header.dataset.sortingListenerAdded) {
                header.addEventListener('click', function() {
                    const sortBy = this.dataset.sortBy;
                    let sortOrder = this.dataset.sortOrder || 'asc'; // Default to ascending

                    // Remove existing sort indicators from other headers
                    headers.forEach(h => {
                        if (h !== this) {
                            h.classList.remove('asc', 'desc');
                            h.dataset.sortOrder = ''; // Clear sort order for others
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
                    this.dataset.sortOrder = sortOrder; // Update data attribute

                    // Sort the dataArray in place
                    dataArray.sort((a, b) => {
                        let valA = a[sortBy];
                        let valB = b[sortBy];

                        // Handle null/undefined values by treating them as empty strings for comparison
                        valA = (valA === null || valA === undefined) ? '' : valA;
                        valB = (valB === null || valB === undefined) ? '' : valB;

                        // Numerical sorting
                        if (typeof valA === 'number' && typeof valB === 'number') {
                            return sortOrder === 'asc' ? valA - valB : valB - valA;
                        }
                        // Date sorting (assuming YYYY-MM-DD format or parsable date strings)
                        if (sortBy.includes('date') || sortBy.includes('Date') || sortBy.includes('followUp')) {
                            const dateA = new Date(valA);
                            const dateB = new Date(valB);
                            // Handle invalid dates (e.g., 'N/A') by pushing them to the end
                            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
                            if (isNaN(dateA.getTime())) return sortOrder === 'asc' ? 1 : -1;
                            if (isNaN(dateB.getTime())) return sortOrder === 'asc' ? -1 : 1;
                            return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
                        }
                        // String sorting (case-insensitive)
                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                        }
                        // Fallback for other types (e.g., boolean, objects - might need specific handling if complex)
                        return 0;
                    });

                    // Re-render the table with the newly sorted data
                    renderFunction(dataArray);
                });
                header.dataset.sortingListenerAdded = 'true'; // Mark listener as added
            }
        });
    }

    // --- Data Fetching & Rendering Functions ---

    /**
     * Fetches leads data from the API and updates the UI.
     */
    async function fetchLeads() {
        console.log("Dashboard.js: Fetching leads...");
        showLoading();
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }
            const leads = await response.json();
            console.log("Dashboard.js: Leads data received:", leads);

            allLeads = leads; // Store all leads globally
            currentLeadsData = [...leads]; // Create a mutable copy for sorting

            renderLeadsTable(currentLeadsData);
            updateLeadStats(leads);
            populateLeadSelect(leads);
            updateUpcomingFollowups(leads);
        } catch (error) {
            console.error('Dashboard.js: Error fetching leads:', error);
            showMessage('Failed to load leads.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Renders the leads table with the given data.
     * @param {Array<Object>} leadsToRender - The array of lead objects to display.
     */
    function renderLeadsTable(leadsToRender) {
        const leadsListBody = document.getElementById('recentLeadsTable')?.querySelector('tbody');
        if (!leadsListBody) {
            console.warn("Dashboard.js: Leads table body not found.");
            return;
        }
        leadsListBody.innerHTML = ''; // Clear existing rows

        if (leadsToRender.length === 0) {
            leadsListBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No leads found.</td></tr>';
            return;
        }

        leadsToRender.forEach(lead => {
            const row = document.createElement('tr');
            const firstName = lead.firstname || '';
            const lastName = lead.lastname || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const displayName = fullName || 'N/A';

            const dateOfContact = lead.dateofcontact ? new Date(lead.dateofcontact).toISOString().split('T')[0] : 'N/A';
            const followUp = lead.followup ? new Date(lead.followup).toISOString().split('T')[0] : 'N/A';

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
            leadsListBody.appendChild(row);
        });
        console.log("Dashboard.js: Leads table rendered.");
    }

    /**
     * Updates the lead statistics cards.
     * @param {Array<Object>} leads - The array of lead objects.
     */
    function updateLeadStats(leads) {
        console.log("Dashboard.js: Updating lead statistics.");
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

    /**
     * Populates the lead selection dropdowns (e.g., for events/activities).
     * @param {Array<Object>} leads - The array of lead objects.
     */
    function populateLeadSelect(leads) {
        console.log("Dashboard.js: Populating lead select dropdowns.");
        const eventLeadSelect = document.getElementById('eventLeadId');
        if (!eventLeadSelect) {
            console.warn("Dashboard.js: eventLeadId select element not found.");
            return;
        }
        eventLeadSelect.innerHTML = '<option value="">-- No Lead --</option>'; // Default option

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            const leadDisplayName = `${lead.firstname || ''} ${lead.lastname || ''}`.trim();
            const companyDisplayName = lead.company || '';

            if (leadDisplayName && companyDisplayName) {
                option.textContent = `${leadDisplayName} (${companyDisplayName})`;
            } else if (leadDisplayName) {
                option.textContent = leadDisplayName;
            } else if (companyDisplayName) {
                option.textContent = companyDisplayName;
            } else {
                option.textContent = `Lead ID: ${lead.id}`; // Fallback
            }
            eventLeadSelect.appendChild(option);
        });
        console.log("Dashboard.js: Lead select dropdown populated.");
    }

    let leadsByStageChart; // Chart.js instance
    /**
     * Updates or creates the Leads by Stage Doughnut Chart.
     * @param {Array<Object>} leads - The array of lead objects.
     */
    function updateLeadsByStageChart(leads) {
        console.log("Dashboard.js: Updating Leads by Stage Chart.");
        const stageCounts = leads.reduce((acc, lead) => {
            acc[lead.stage] = (acc[lead.stage] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(stageCounts);
        const data = Object.values(stageCounts);

        const ctx = document.getElementById('leadsByStageChart')?.getContext('2d');
        if (!ctx) {
            console.warn("Dashboard.js: Leads by Stage Chart canvas context not found.");
            return;
        }

        if (leadsByStageChart) {
            leadsByStageChart.destroy(); // Destroy existing chart instance
        }

        leadsByStageChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8' // Example colors
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
        console.log("Dashboard.js: Leads by Stage Chart updated.");
    }

    /**
     * Updates the list of upcoming follow-ups.
     * @param {Array<Object>} leads - The array of lead objects.
     */
    function updateUpcomingFollowups(leads) {
        console.log("Dashboard.js: Updating upcoming follow-ups list.");
        const upcomingList = document.getElementById('upcomingFollowupsList');
        if (!upcomingList) {
            console.warn("Dashboard.js: Upcoming follow-ups list element not found.");
            return;
        }
        upcomingList.innerHTML = ''; // Clear existing items

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const sortedFollowups = leads
            .filter(lead => lead.followup && new Date(lead.followup) >= today)
            .sort((a, b) => new Date(a.followup).getTime() - new Date(b.followup).getTime());

        if (sortedFollowups.length === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = 'No upcoming follow-ups.';
            upcomingList.appendChild(listItem);
            return;
        }

        sortedFollowups.forEach(lead => {
            const listItem = document.createElement('li');
            const leadDisplayName = `${lead.firstname || ''} ${lead.lastname || ''}`.trim();
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
                <span class="followup-details">Follow-up on: ${new Date(lead.followup).toISOString().split('T')[0]} (Stage: ${lead.stage || 'N/A'})</span>
            `;
            upcomingList.appendChild(listItem);
        });
        console.log("Dashboard.js: Upcoming follow-ups list updated.");
    }

    /**
     * Fetches calendar events from the API and updates the FullCalendar instance.
     */
    async function fetchCalendarEvents() {
        console.log("Dashboard.js: Fetching calendar events...");
        showLoading();
        try {
            const response = await fetch('/api/calendar_events');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }
            const events = await response.json();
            console.log("Dashboard.js: Calendar events data received:", events);

            const calendarEvents = events.map(event => {
                // Construct lead info string safely
                let leadInfo = '';
                if (event.lead_name) {
                    leadInfo = `(${event.lead_name}`;
                    if (event.company) {
                        leadInfo += `, ${event.company}`;
                    }
                    leadInfo += ')';
                }
                
                // Construct amount info string safely
                let amountInfo = '';
                if (event.amount && parseFloat(event.amount) > 0) {
                    amountInfo = ` - KSh${parseFloat(event.amount).toFixed(2)}`;
                }

                return {
                    // Use template literals for clear string construction
                    title: `${event.type || 'N/A'}: ${event.description || ''} ${leadInfo}${amountInfo}`.trim(),
                    start: event.date || 'N/A',
                    allDay: true,
                    // Sanitize class name for CSS
                    className: `fc-event-${(event.type || '').toLowerCase().replace(/\s/g, '-')}`,
                    extendedProps: {
                        type: event.type,
                        leadId: event.lead_id,
                        amount: event.amount,
                        description: event.description,
                        id: event.id,
                        leadName: event.lead_name,
                        company: event.company
                    }
                };
            });

            const calendarEl = document.getElementById('calendar');
            if (!calendarEl) {
                console.warn("Dashboard.js: FullCalendar element not found.");
                return;
            }

            if (calendarInstance) {
                // If calendar already exists, just update its events
                calendarInstance.setOption('events', calendarEvents);
                console.log("Dashboard.js: FullCalendar events updated.");
            } else {
                // Initialize FullCalendar for the first time
                calendarInstance = new FullCalendar.Calendar(calendarEl, {
                    initialView: 'dayGridMonth',
                    events: calendarEvents,
                    headerToolbar: {
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,dayGridWeek,dayGridDay'
                    },
                    eventDidMount: function(info) {
                        const tooltip = document.getElementById('calendarTooltip');
                        if (!tooltip) {
                            console.warn("Dashboard.js: Calendar tooltip element not found.");
                            return;
                        }

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
                            if (eventProps.amount && parseFloat(eventProps.amount) > 0) {
                                tooltipHtml += `<span>Amount: KSh ${parseFloat(eventProps.amount).toFixed(2)}</span>`;
                            }

                            tooltip.innerHTML = tooltipHtml;
                            // Position tooltip dynamically
                            const rect = info.el.getBoundingClientRect();
                            tooltip.style.left = `${rect.left + window.scrollX}px`;
                            tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 10}px`;
                            tooltip.classList.add('active');
                        });
                        info.el.addEventListener('mouseout', function() {
                            tooltip.classList.remove('active');
                        });
                    },
                    eventClick: function(info) {
                        // When an event is clicked, open the generalEventModal for editing
                        const eventProps = info.event.extendedProps;
                        document.getElementById('eventId').value = eventProps.id || '';
                        document.getElementById('eventDate').value = info.event.startStr || '';
                        document.getElementById('eventType').value = eventProps.type || '';
                        document.getElementById('eventDescription').value = eventProps.description || '';
                        document.getElementById('eventAmount').value = parseFloat(eventProps.amount || 0).toFixed(2);
                        populateLeadSelect(allLeads); // Ensure leads are loaded for the dropdown
                        document.getElementById('eventLeadId').value = eventProps.leadId || ''; // Select the linked lead

                        showModal(generalEventModal, 'Edit Calendar Event');
                    }
                });
                calendarInstance.render();
                console.log("Dashboard.js: FullCalendar initialized and rendered.");
            }
        } catch (error) {
            console.error('Dashboard.js: Error fetching calendar events:', error);
            showMessage('Failed to load calendar events.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Fetches expenditure report data and updates the UI.
     * @param {string} [startDate=''] - Optional start date for filtering.
     * @param {string} [endDate=''] - Optional end date for filtering.
     */
    async function fetchExpenditureReport(startDate = '', endDate = '') {
        console.log(`Dashboard.js: Fetching expenditure report (Start: ${startDate || 'N/A'}, End: ${endDate || 'N/A'})...`);
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
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }
            const reportItems = await response.json();
            console.log("Dashboard.js: Expenditure report data received:", reportItems);
            
            currentExpenditureData = [...reportItems]; // Store a mutable copy for sorting
            renderExpenditureReportTable(currentExpenditureData);

        } catch (error) {
            console.error('Dashboard.js: Error fetching expenditure report:', error);
            showMessage('Failed to load expenditure report.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Renders the expenditure report table with the given data.
     * @param {Array<Object>} reportItemsToRender - The array of report items to display.
     */
    function renderExpenditureReportTable(reportItemsToRender) {
        const reportTableBody = document.getElementById('expenditureReportTableBody');
        if (!reportTableBody) {
            console.warn("Dashboard.js: Expenditure report table body not found.");
            return;
        }
        reportTableBody.innerHTML = ''; // Clear existing rows

        let totalExpenditure = 0;

        if (reportItemsToRender.length === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No expenditure items found for this period.</td></tr>';
            document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh 0.00`;
            return;
        }

        reportItemsToRender.forEach(item => {
            const row = document.createElement('tr');
            let actionsHtml = `
                <button class="text-indigo-600 hover:text-indigo-900 edit-expense-btn" data-id="${item.id}" data-source="${item.source_table}" title="Edit Item"><i class="fas fa-edit"></i></button>
                <button class="text-red-600 hover:text-red-900 delete-expense-btn" data-id="${item.id}" data-source="${item.source_table}" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
            `;
            // Hide action buttons if item has no ID (e.g., aggregated data that isn't editable)
            if (item.id === undefined || item.id === null) { 
                actionsHtml = 'N/A';
            }

            const leadNameDisplay = item.lead_name || 'N/A';
            const companyNameDisplay = item.company || 'N/A';
            const expenseDate = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';
            const amount = parseFloat(item.amount || 0);

            row.innerHTML = `
                <td data-label="Date">${expenseDate}</td>
                <td data-label="Category">${item.type_category || 'N/A'}</td>
                <td data-label="Description">${item.description || 'N/A'}</td>
                <td data-label="Amount (KSh)">${amount.toFixed(2)}</td>
                <td data-label="Lead Name">${leadNameDisplay}</td>
                <td data-label="Company">${companyNameDisplay}</td>
                <td data-label="Actions">${actionsHtml}</td>
            `;
            reportTableBody.appendChild(row);
            totalExpenditure += amount;
        });

        document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh ${totalExpenditure.toFixed(2)}`;
        console.log("Dashboard.js: Expenditure report table rendered.");
    }

    // --- Form Submission Handlers ---

    document.getElementById('addLeadForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log("Dashboard.js: Add/Edit Lead form submitted.");
        const formData = new FormData(this);
        const leadData = Object.fromEntries(formData.entries());
        const leadId = document.getElementById('leadId').value;

        // Basic client-side validation
        if (!leadData.firstName?.trim()) { showMessage('First Name is required.', 'error'); return; }
        if (!leadData.company?.trim()) { showMessage('Company is required.', 'error'); return; }
        if (!leadData.dateOfContact?.trim()) { showMessage('Date of Contact is required.', 'error'); return; }

        let url = '/api/leads';
        let method = 'POST';

        if (leadId) { // If leadId exists, it's an update
            method = 'PUT';
            leadData.id = leadId;
        }

        showLoading();
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(leadModal);
            fetchLeads(); // Re-fetch all leads to update UI
        } catch (error) {
            console.error('Dashboard.js: Error saving lead:', error);
            showMessage('Failed to save lead.', 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('addActivityForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log("Dashboard.js: Add Lead Activity form submitted.");
        const formData = new FormData(this);
        const activityData = Object.fromEntries(formData.entries());
        // Ensure lead_id is null if empty string
        activityData.lead_id = activityData.lead_id === '' ? null : activityData.lead_id;
        activityData.expenditure = parseFloat(activityData.expenditure || 0);

        // Basic client-side validation
        if (!activityData.activityType?.trim()) { showMessage('Activity Type is required.', 'error'); return; }
        if (!activityData.activityDate?.trim()) { showMessage('Activity Date is required.', 'error'); return; }

        showLoading();
        try {
            const response = await fetch('/api/lead_activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activityData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(visitModal);
            fetchCalendarEvents(); // Activities can be calendar events
            fetchExpenditureReport(); // Activities can have expenditure
            fetchLeads(); // To refresh lead-related stats/followups
        } catch (error) {
            console.error('Dashboard.js: Error adding lead activity:', error);
            showMessage('Failed to add lead activity.', 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('addExpenseForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log("Dashboard.js: Add/Edit General Expense form submitted.");
        const formData = new FormData(this);
        const expenseData = Object.fromEntries(formData.entries());
        const expenseId = document.getElementById('expenseId').value;

        let url = '/api/general_expenses';
        let method = 'POST';

        if (expenseId) { // If expenseId exists, it's an update
            method = 'PUT';
            expenseData.id = expenseId;
        }
        expenseData.amount = parseFloat(expenseData.amount || 0);

        // Basic client-side validation
        if (!expenseData.category?.trim()) { showMessage('Category is required.', 'error'); return; }
        if (!expenseData.generalExpenseDate?.trim()) { showMessage('Date is required.', 'error'); return; }
        if (isNaN(expenseData.amount) || expenseData.amount < 0) { showMessage('Amount must be a non-negative number.', 'error'); return; }


        showLoading();
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenseData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            closeModal(generalExpenseModal);
            fetchExpenditureReport(); // Refresh report
            fetchCalendarEvents(); // In case it affects total expenditure
        } catch (error) {
            console.error('Dashboard.js: Error saving general expense:', error);
            showMessage('Failed to save general expense.', 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('addEventForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log("Dashboard.js: Add/Edit Calendar Event form submitted.");
        const formData = new FormData(this);
        const eventData = Object.fromEntries(formData.entries());
        const eventId = document.getElementById('eventId').value;

        let url = '/api/calendar_events';
        let method = 'POST';

        if (eventId) { // If eventId exists, it's an update
            method = 'PUT';
            eventData.id = eventId;
        }

        // Ensure lead_id is null if empty string, and amount is parsed as float
        eventData.lead_id = eventData.lead_id === '' ? null : eventData.lead_id;
        eventData.amount = parseFloat(eventData.amount || 0);

        // Basic client-side validation
        if (!eventData.eventType?.trim()) { showMessage('Event Type is required.', 'error'); return; }
        if (!eventData.eventDate?.trim()) { showMessage('Event Date is required.', 'error'); return; }
        if (isNaN(eventData.amount) || eventData.amount < 0) { showMessage('Amount must be a non-negative number.', 'error'); return; }

        showLoading();
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            showMessage(result.message, 'success');
            this.reset(); // Reset form after successful submission
            closeModal(generalEventModal);
            fetchCalendarEvents(); // Refresh calendar
            fetchExpenditureReport(); // Refresh expenditure if amount was involved
            fetchLeads(); // To update follow-ups/stats if lead was linked
        } catch (error) {
            console.error('Dashboard.js: Error saving calendar event:', error);
            showMessage('Failed to save calendar event.', 'error');
        } finally {
            hideLoading();
        }
    });

    // --- Table Action Handlers (View/Edit/Delete) ---

    // Event delegation for Leads table actions
    document.getElementById('recentLeadsTable')?.addEventListener('click', async function(event) {
        const targetBtn = event.target.closest('.view-lead-btn, .delete-lead-btn');
        if (!targetBtn) return; // Not a relevant button click

        const leadId = targetBtn.dataset.id;

        if (targetBtn.classList.contains('view-lead-btn')) {
            console.log(`Dashboard.js: Viewing/Editing lead with ID: ${leadId}`);
            showLoading();
            try {
                const response = await fetch(`/api/leads?id=${leadId}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
                }
                const leads = await response.json();
                const lead = leads[0]; // API returns array, take first item

                if (lead) {
                    // Populate the lead modal form for editing
                    document.getElementById('leadId').value = lead.id || '';
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
            } catch (error) {
                console.error('Dashboard.js: Error fetching lead details:', error);
                showMessage('Failed to load lead details.', 'error');
            } finally {
                hideLoading();
            }
        } else if (targetBtn.classList.contains('delete-lead-btn')) {
            // Confirmation for deletion (simple double-click, consider a dedicated modal for production)
            showMessage('Are you sure you want to delete this lead? This will also remove associated calendar events and activities. Click again to confirm.', 'warning');
            
            let confirmDeleteTimeout;
            const confirmBtn = targetBtn; // Reference the clicked button
            confirmBtn.dataset.confirmClick = (parseInt(confirmBtn.dataset.confirmClick || '0') || 0) + 1;

            if (confirmBtn.dataset.confirmClick === '2') {
                clearTimeout(confirmDeleteTimeout); // Clear any pending single-click reset
                console.log(`Dashboard.js: Deleting lead with ID: ${leadId}`);
                showLoading();
                try {
                    const response = await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success');
                    fetchLeads(); // Refresh all related data
                    fetchCalendarEvents();
                    fetchExpenditureReport();
                } catch (error) {
                    console.error('Dashboard.js: Error deleting lead:', error);
                    showMessage('Failed to delete lead.', 'error');
                } finally {
                    hideLoading();
                    confirmBtn.dataset.confirmClick = '0'; // Reset confirm state
                }
            } else {
                // Set a timeout to reset the click count if not confirmed
                confirmDeleteTimeout = setTimeout(() => {
                    confirmBtn.dataset.confirmClick = '0';
                    showMessage('', ''); // Clear message
                }, 3000);
            }
        }
    });

    // Event delegation for Expenditure Report table actions (Edit/Delete)
    document.getElementById('expenditureReportTableBody')?.addEventListener('click', async function(event) {
        const targetBtn = event.target.closest('.edit-expense-btn, .delete-expense-btn');
        if (!targetBtn) return;

        const itemId = targetBtn.dataset.id;
        const sourceType = targetBtn.dataset.source;

        if (targetBtn.classList.contains('edit-expense-btn')) {
            console.log(`Dashboard.js: Editing item with ID: ${itemId} from source: ${sourceType}`);
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
                    throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
                }
                const items = await response.json();
                const item = items[0]; // API returns array, take first item

                if (item) {
                    if (sourceType === 'general_expenses') {
                        document.getElementById('expenseId').value = item.id || '';
                        document.getElementById('generalExpenseDate').value = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
                        document.getElementById('generalExpenseAmount').value = parseFloat(item.amount || 0).toFixed(2);
                        document.getElementById('generalExpenseDescription').value = item.description || '';
                        document.getElementById('generalExpenseCategory').value = item.category || ''; // Ensure category is set
                        showModal(generalExpenseModal, 'Edit General Expense');
                    } else if (sourceType === 'calendar_events') {
                        document.getElementById('eventId').value = item.id || '';
                        document.getElementById('eventDate').value = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
                        document.getElementById('eventType').value = item.type || '';
                        document.getElementById('eventDescription').value = item.description || '';
                        document.getElementById('eventAmount').value = parseFloat(item.amount || 0).toFixed(2);
                        await populateLeadSelect(allLeads); // Ensure leads are loaded
                        document.getElementById('eventLeadId').value = item.lead_id || '';
                        showModal(generalEventModal, 'Edit Calendar Event');
                    }
                } else {
                    showMessage('Item not found.', 'error');
                }
            } catch (error) {
                console.error('Dashboard.js: Error fetching item details:', error);
                showMessage('Failed to load item details.', 'error');
            } finally {
                hideLoading();
            }
        } else if (targetBtn.classList.contains('delete-expense-btn')) {
            // Confirmation for deletion
            showMessage('Are you sure you want to delete this item? Click again to confirm.', 'warning');
            
            let confirmDeleteTimeout;
            const confirmBtn = targetBtn;
            confirmBtn.dataset.confirmClick = (parseInt(confirmBtn.dataset.confirmClick || '0') || 0) + 1;

            if (confirmBtn.dataset.confirmClick === '2') {
                clearTimeout(confirmDeleteTimeout);
                console.log(`Dashboard.js: Deleting item with ID: ${itemId} from source: ${sourceType}`);
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

                    const response = await fetch(url, { method: 'DELETE' });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showMessage(result.message, 'success');
                    fetchExpenditureReport(); // Refresh relevant data
                    fetchCalendarEvents();
                    fetchLeads();
                } catch (error) {
                    console.error('Dashboard.js: Error deleting item:', error);
                    showMessage('Failed to delete item.', 'error');
                } finally {
                    hideLoading();
                    confirmBtn.dataset.confirmClick = '0';
                }
            } else {
                confirmDeleteTimeout = setTimeout(() => {
                    confirmBtn.dataset.confirmClick = '0';
                    showMessage('', '');
                }, 3000);
            }
        }
    });

    // --- Report Filtering & Export ---

    document.getElementById('filterReportBtn')?.addEventListener('click', function() {
        console.log("Dashboard.js: Filter Report button clicked.");
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        fetchExpenditureReport(startDate, endDate);
    });

    document.getElementById('clearReportDatesBtn')?.addEventListener('click', function() {
        console.log("Dashboard.js: Clear Report Dates button clicked.");
        document.getElementById('reportStartDate').value = '';
        document.getElementById('reportEndDate').value = '';
        fetchExpenditureReport(); // Fetch report without filters
    });

    document.getElementById('exportLeadsBtn')?.addEventListener('click', async function() {
        console.log("Dashboard.js: Export Leads button clicked.");
        showLoading();
        try {
            const response = await fetch('/api/export_leads');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'leads_export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url); // Clean up the URL object
            showMessage('Leads exported successfully!', 'success');
        } catch (error) {
            console.error('Dashboard.js: Error exporting leads:', error);
            showMessage('Failed to export leads.', 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('exportExpenditureReportBtn')?.addEventListener('click', async function() {
        console.log("Dashboard.js: Export Expenditure Report button clicked.");
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
                throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
            }
            const blob = await response.blob();
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = urlBlob;
            a.download = 'expenditure_report_export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(urlBlob); // Clean up the URL object
            showMessage('Expenditure report exported successfully!', 'success');
        } catch (error) {
            console.error('Dashboard.js: Error exporting expenditure report:', error);
            showMessage('Failed to export expenditure report.', 'error');
        } finally {
            hideLoading();
        }
    });

    // --- Initial Data Load & Event Listener Setup ---

    // Initial data load when the page loads
    // These functions will also trigger the initial rendering of tables and charts.
    fetchLeads();
    fetchCalendarEvents();
    fetchExpenditureReport();

    // Set up sorting listeners on table headers after initial load
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

    // Ensure all elements are correctly referenced before adding listeners
    // The '?.` (optional chaining) operator is used for safety in case an element isn't found.
});
