// Utility Functions
const showMessage = (message, type) => {
    const msgBox = document.getElementById('messageContainer');
    msgBox.textContent = message;
    msgBox.className = 'message-container active ' + type; // Add 'active' for transition
    msgBox.style.display = 'block'; // Ensure it's displayed
    setTimeout(() => {
        msgBox.classList.remove('active'); // Start fade out
        // Optional: Hide after transition completes if using CSS transitions for display: none
        setTimeout(() => {
            msgBox.style.display = 'none';
        }, 300); // Match CSS transition duration
    }, 5000); // Message visible for 5 seconds
};

const showLoading = () => {
    document.getElementById('loadingIndicator').style.display = 'flex';
};

const hideLoading = () => {
    document.getElementById('loadingIndicator').style.display = 'none';
};

// Modals
const leadModal = document.getElementById('leadModal');
const visitModal = document.getElementById('visitModal');
const generalExpenseModal = document.getElementById('generalExpenseModal');
const generalEventModal = document.getElementById('generalEventModal');
const calendarTooltip = document.getElementById('calendarTooltip'); // Re-added tooltip element

// Generic function to open modals
const openModal = (modalElement) => {
    modalElement.style.display = 'flex'; // Use flex for centering
    setTimeout(() => modalElement.classList.add('active'), 10); // Trigger transition
};

// Generic function to close modals
const closeModal = (modalElement) => {
    modalElement.classList.remove('active'); // Start fade out
    setTimeout(() => {
        modalElement.style.display = 'none'; // Hide after transition
        // Reset forms within the modal if needed
        const form = modalElement.querySelector('form');
        if (form) {
            form.reset();
        }
        // Clear validation errors
        const errorMessages = modalElement.querySelectorAll('.error-message');
        errorMessages.forEach(el => el.remove());
        const invalidInputs = modalElement.querySelectorAll('.is-invalid');
        invalidInputs.forEach(el => el.classList.remove('is-invalid'));
    }, 300); // Match CSS transition duration
};

// Specific modal open/close functions
const openAddLeadModal = () => {
    document.getElementById('leadForm').reset();
    document.getElementById('leadId').value = ''; // Clear lead ID for new lead
    document.getElementById('leadModalTitle').textContent = 'Add New Lead';
    openModal(leadModal);
};

const closeLeadModal = () => closeModal(leadModal);

const openVisitModal = (leadId) => {
    document.getElementById('visitForm').reset();
    document.getElementById('visitLeadId').value = leadId;
    openModal(visitModal);
};

const closeVisitModal = () => closeModal(visitModal);

const openGeneralExpenseModal = () => {
    document.getElementById('generalExpenseForm').reset();
    openModal(generalExpenseModal);
};

const closeGeneralExpenseModal = () => closeModal(generalExpenseModal);

const openGeneralEventModal = async () => {
    document.getElementById('generalEventForm').reset();
    openModal(generalEventModal);
    await populateLeadsForEvent();
};

const closeGeneralEventModal = () => closeModal(generalEventModal);


// Form submission handlers
document.getElementById('leadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showLoading();

    const leadId = document.getElementById('leadId').value;
    const method = leadId ? 'PUT' : 'POST';
    const url = leadId ? `/leads/${leadId}` : '/leads';

    const leadData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        title: document.getElementById('title').value,
        company: document.getElementById('company').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        product: document.getElementById('product').value,
        stage: document.getElementById('stage').value,
        dateOfContact: document.getElementById('dateOfContact').value,
        followUp: document.getElementById('followUp').value,
        notes: document.getElementById('notes').value
    };

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(result.message, 'success');
        closeLeadModal();
        await fetchAndRenderLeads(); // Refresh leads list
        await renderPlanningCalendar(); // Refresh calendar if follow-up dates changed

    } catch (error) {
        console.error('Error saving lead:', error);
        showMessage('Failed to save lead. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

document.getElementById('visitForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showLoading();

    const visitData = {
        lead_id: document.getElementById('visitLeadId').value,
        visitDate: document.getElementById('visitDate').value,
        notes: document.getElementById('visitNotes').value,
        expenditure: parseFloat(document.getElementById('visitExpenditure').value)
    };

    try {
        const response = await fetch('/visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(visitData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(result.message, 'success');
        closeVisitModal();
        await fetchAndRenderExpenditureReport(); // Refresh report
        await renderPlanningCalendar(); // Calendar might include visits

    } catch (error) {
        console.error('Error adding visit:', error);
        showMessage('Failed to add visit. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

document.getElementById('generalExpenseForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showLoading();

    const expenseData = {
        date: document.getElementById('generalExpenseDate').value,
        description: document.getElementById('generalExpenseDescription').value,
        amount: parseFloat(document.getElementById('generalExpenseAmount').value)
    };

    try {
        const response = await fetch('/general_expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(result.message, 'success');
        closeGeneralExpenseModal();
        await fetchAndRenderExpenditureReport(); // Refresh report
        await renderPlanningCalendar(); // Calendar might include general expenses

    } catch (error) {
        console.error('Error adding general expense:', error);
        showMessage('Failed to add general expense. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

document.getElementById('generalEventForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showLoading();

    const eventData = {
        date: document.getElementById('eventDate').value,
        type: document.getElementById('eventType').value,
        description: document.getElementById('eventDescription').value,
        lead_id: document.getElementById('eventLeadId').value || null // Send null if no lead selected
    };

    try {
        const response = await fetch('/calendar_events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(result.message, 'success');
        closeGeneralEventModal();
        await renderPlanningCalendar(); // Refresh calendar

    } catch (error) {
        console.error('Error adding calendar event:', error);
        showMessage('Failed to add calendar event. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

// Function to populate leads dropdown for events
const populateLeadsForEvent = async () => {
    const selectElement = document.getElementById('eventLeadId');
    selectElement.innerHTML = '<option value="">-- Select Lead (Optional) --</option>'; // Default option

    try {
        const response = await fetch('/leads');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const leads = await response.json();

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead.id;
            option.textContent = `${lead.firstName} ${lead.lastName || ''} (${lead.company})`;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching leads for event dropdown:', error);
        showMessage('Could not load leads for event linking.', 'warning');
    }
};

// Data Fetching & Rendering Functions
let leadsData = []; // Store leads globally for search/filter

const fetchAndRenderLeads = async () => {
    showLoading();
    try {
        const response = await fetch('/leads');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        leadsData = await response.json(); // Store fetched leads

        renderLeadsTable(leadsData);
        updateLeadsStatistics(leadsData);
        renderLeadsByStageChart(leadsData);
        renderUpcomingFollowups(leadsData); // Update upcoming follow-ups

    } catch (error) {
        console.error('Error fetching leads:', error);
        showMessage('Failed to load leads data.', 'error');
    } finally {
        hideLoading();
    }
};

const renderLeadsTable = (leadsToRender) => {
    const tableBody = document.querySelector('#recentLeadsTable tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    if (leadsToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No leads found.</td></tr>';
        return;
    }

    leadsToRender.forEach(lead => {
        const row = tableBody.insertRow();
        row.dataset.id = lead.id; // Store lead ID on the row

        row.insertCell().textContent = `${lead.firstName} ${lead.lastName || ''}`;
        row.insertCell().textContent = lead.company;
        row.insertCell().textContent = lead.stage;
        row.insertCell().textContent = lead.dateOfContact;
        row.insertCell().textContent = lead.followUp || 'N/A';

        const actionsCell = row.insertCell();
        actionsCell.className = 'btn-group';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-primary btn-sm';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit Lead';
        editBtn.onclick = () => editLead(lead.id);
        actionsCell.appendChild(editBtn);

        // Add Visit button
        const addVisitBtn = document.createElement('button');
        addVisitBtn.className = 'btn btn-secondary btn-sm';
        addVisitBtn.innerHTML = '<i class="fas fa-calendar-check"></i>';
        addVisitBtn.title = 'Add Visit';
        addVisitBtn.onclick = () => openVisitModal(lead.id);
        actionsCell.appendChild(addVisitBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Delete Lead';
        deleteBtn.onclick = () => deleteLead(lead.id);
        actionsCell.appendChild(deleteBtn);
    });
};

const updateLeadsStatistics = (leads) => {
    document.getElementById('totalLeadsCount').textContent = leads.length;
    document.getElementById('newLeadsCount').textContent = leads.filter(l => l.stage === 'New').length;
    document.getElementById('qualifiedLeadsCount').textContent = leads.filter(l => l.stage === 'Qualified').length;
    document.getElementById('closedWonLeadsCount').textContent = leads.filter(l => l.stage === 'Closed Won').length;
    document.getElementById('closedLostLeadsCount').textContent = leads.filter(l => l.stage === 'Closed Lost').length;
};

// Chart.js instance (to be able to destroy and re-create)
let leadsChart;

const renderLeadsByStageChart = (leads) => {
    const ctx = document.getElementById('leadsByStageChart').getContext('2d');

    // Destroy existing chart if it exists
    if (leadsChart) {
        leadsChart.destroy();
    }

    const stageCounts = leads.reduce((acc, lead) => {
        acc[lead.stage] = (acc[lead.stage] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(stageCounts);
    const data = Object.values(stageCounts);
    const backgroundColors = [
        '#007bff', '#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6c757d' // Primary, Success, Warning, Info, Danger, Secondary
    ];

    leadsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 1
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
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1) + '%';
                                label += ` (${percentage})`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
};

const renderUpcomingFollowups = (leads) => {
    const listElement = document.getElementById('upcomingFollowupsList');
    listElement.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const upcoming = leads.filter(lead => {
        if (!lead.followUp) return false;
        const followUpDate = new Date(lead.followUp + 'T00:00:00'); // Ensure UTC for comparison
        followUpDate.setHours(0, 0, 0, 0);
        return followUpDate >= today;
    }).sort((a, b) => new Date(a.followUp) - new Date(b.followUp));

    if (upcoming.length === 0) {
        listElement.innerHTML = '<li>No upcoming follow-ups.</li>';
        return;
    }

    upcoming.forEach(lead => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="lead-name">${lead.firstName} ${lead.lastName || ''}</span>
            <span class="followup-details">
                Company: ${lead.company}<br>
                Stage: ${lead.stage}<br>
                Date: ${lead.followUp}
            </span>
        `;
        listElement.appendChild(li);
    });
};

// Lead Search Functionality
document.getElementById('leadSearchInput').addEventListener('input', (event) => {
    const searchTerm = event.target.value.toLowerCase();
    const filteredLeads = leadsData.filter(lead =>
        lead.firstName.toLowerCase().includes(searchTerm) ||
        (lead.lastName && lead.lastName.toLowerCase().includes(searchTerm)) ||
        lead.company.toLowerCase().includes(searchTerm) ||
        lead.stage.toLowerCase().includes(searchTerm) ||
        (lead.notes && lead.notes.toLowerCase().includes(searchTerm))
    );
    renderLeadsTable(filteredLeads);
});

// Lead Table Sorting
document.querySelectorAll('#recentLeadsTable th.sortable').forEach(header => {
    header.addEventListener('click', () => {
        const sortBy = header.dataset.sortBy;
        const currentOrder = header.classList.contains('asc') ? 'asc' : (header.classList.contains('desc') ? 'desc' : '');

        // Clear existing sort classes
        document.querySelectorAll('#recentLeadsTable th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });

        let newOrder = 'asc';
        if (currentOrder === 'asc') {
            newOrder = 'desc';
        }

        header.classList.add(newOrder);

        const sortedLeads = [...leadsData].sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            // Handle date comparison
            if (sortBy === 'dateOfContact' || sortBy === 'followUp') {
                valA = new Date(valA);
                valB = new Date(valB);
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return newOrder === 'asc' ? -1 : 1;
            if (valA > valB) return newOrder === 'asc' ? 1 : -1;
            return 0;
        });

        renderLeadsTable(sortedLeads);
    });
});

// Edit Lead Function
const editLead = async (leadId) => {
    showLoading();
    try {
        const response = await fetch(`/leads/${leadId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const lead = await response.json();

        document.getElementById('leadId').value = lead.id;
        document.getElementById('firstName').value = lead.firstName;
        document.getElementById('lastName').value = lead.lastName || '';
        document.getElementById('title').value = lead.title || '';
        document.getElementById('company').value = lead.company;
        document.getElementById('email').value = lead.email || '';
        document.getElementById('phone').value = lead.phone || '';
        document.getElementById('product').value = lead.product || '';
        document.getElementById('stage').value = lead.stage;
        document.getElementById('dateOfContact').value = lead.dateOfContact;
        document.getElementById('followUp').value = lead.followUp || '';
        document.getElementById('notes').value = lead.notes || '';

        document.getElementById('leadModalTitle').textContent = 'Edit Lead';
        openModal(leadModal);

    } catch (error) {
        console.error('Error fetching lead for edit:', error);
        showMessage('Failed to load lead details for editing.', 'error');
    } finally {
        hideLoading();
    }
};

// Delete Lead Function
const deleteLead = async (leadId) => {
    if (!confirm('Are you sure you want to delete this lead and all associated visits?')) {
        return;
    }

    showLoading();
    try {
        const response = await fetch(`/leads/${leadId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(result.message, 'success');
        await fetchAndRenderLeads(); // Refresh leads list
        await renderPlanningCalendar(); // Refresh calendar if related events were deleted

    } catch (error) {
        console.error('Error deleting lead:', error);
        showMessage('Failed to delete lead. Please try again.', 'error');
    } finally {
        hideLoading();
    }
};

// Expenditure Report
let expenditureData = []; // Store expenditure data globally

const fetchAndRenderExpenditureReport = async () => {
    showLoading();
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    let url = '/expenditure_report';
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    if (startDate || endDate) {
        url += `?${params.toString()}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        expenditureData = await response.json();
        renderExpenditureTable(expenditureData);
        updateTotalExpenditure(expenditureData);
    } catch (error) {
        console.error('Error fetching expenditure report:', error);
        showMessage('Failed to load expenditure report.', 'error');
    } finally {
        hideLoading();
    }
};

const renderExpenditureTable = (data) => {
    const tableBody = document.querySelector('#expenditureReportTable tbody');
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No expenditure records found for the selected period.</td></tr>';
        return;
    }

    data.forEach(item => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = item.date;
        row.insertCell().textContent = item.description;
        row.insertCell().textContent = item.lead_name || 'N/A'; // For general expenses, lead_name will be null
        row.insertCell().textContent = item.company || 'N/A';
        row.insertCell().textContent = parseFloat(item.amount).toFixed(2);
    });
};

const updateTotalExpenditure = (data) => {
    const total = data.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('totalExpenditureSummary').textContent = `Total Expenditure: KSh ${total.toFixed(2)}`;
};

const filterExpenditureReport = () => {
    fetchAndRenderExpenditureReport();
};

const exportExpenditureCsv = () => {
    if (expenditureData.length === 0) {
        showMessage('No data to export.', 'info');
        return;
    }

    const headers = ["Date", "Description", "Lead Name", "Company", "Amount (KSh)"];
    const csvRows = [
        headers.join(','),
        ...expenditureData.map(item =>
            [
                item.date,
                `"${item.description.replace(/"/g, '""')}"`, // Handle commas/quotes in description
                item.lead_name || '',
                item.company || '',
                parseFloat(item.amount).toFixed(2)
            ].join(',')
        )
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'expenditure_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage('Expenditure report exported!', 'success');
};


// FullCalendar Initialization and Event Loading
const renderPlanningCalendar = async () => {
    showLoading();
    try {
        const response = await fetch('/calendar_events');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const eventsData = await response.json();

        // Transform data for FullCalendar
        const transformedEvents = eventsData.map(event => {
            let title = event.description;
            let color = ''; // Default color, will be overridden by custom classes

            // Determine title and color based on event type
            if (event.type === 'follow_up' && event.lead_info && event.lead_info.leadName) {
                title = `Follow-up: ${event.lead_info.leadName}`;
                color = ''; // Use CSS class
            } else if (event.type === 'visit' && event.lead_info && event.lead_info.leadName) {
                title = `Visit: ${event.lead_info.leadName}`;
                color = ''; // Use CSS class
            } else if (event.type === 'meeting') {
                title = `Meeting: ${event.description}`;
                color = '';
            } else if (event.type === 'cold_visit') {
                title = `Cold Visit: ${event.description}`;
                color = '';
            } else if (event.type === 'office_day_note') {
                title = `Office Note: ${event.description}`;
                color = '';
            } else if (event.type === 'general_expense') {
                title = `Expense: KSh ${parseFloat(event.amount).toFixed(2)}`;
                color = '';
            }

            // Append lead company if available and applicable
            if (event.lead_info && event.lead_info.company && event.type !== 'office_day_note' && event.type !== 'general_expense') {
                title += ` (${event.lead_info.company})`;
            }

            return {
                id: event.id,
                title: title,
                start: event.date,
                classNames: [`fc-event-${event.type.replace(/_/g, '-')}`], // Custom class for styling
                extendedProps: {
                    description: event.description || 'No description provided.',
                    type: event.type,
                    lead_info: event.lead_info || null,
                    amount: event.amount || null // For general expenses
                }
            };
        });

        const calendarEl = document.getElementById('calendar');
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: transformedEvents,
            eventDidMount: function(info) {
                // console.log('Event mounted:', info.event); // Debugging
            },
            eventMouseEnter: function(info) {
                // Tooltip logic
                const props = info.event.extendedProps;
                let tooltipHtml = `<strong>${info.event.title}</strong>`;
                tooltipHtml += `<span>Date: ${info.event.start.toLocaleDateString()}</span>`;
                if (props.description && props.description !== 'No description provided.') {
                    tooltipHtml += `<span>Description: ${props.description}</span>`;
                }
                if (props.amount && props.amount > 0) {
                    tooltipHtml += `<span>Amount: KSh ${props.amount.toFixed(2)}</span>`;
                }

                calendarTooltip.innerHTML = tooltipHtml;
                calendarTooltip.style.left = info.jsEvent.pageX + 10 + 'px';
                calendarTooltip.style.top = info.jsEvent.pageY + 10 + 'px';
                calendarTooltip.style.opacity = 1;
            },
            eventMouseLeave: function() {
                calendarTooltip.style.opacity = 0;
            }
        });

        calendar.render();

    } catch (error) {
        console.error('Error rendering calendar:', error);
        showMessage('Failed to load calendar events.', 'error');
    } finally {
        hideLoading();
    }
};


// Initial data fetch on page load
document.addEventListener('DOMContentLoaded', () => {
const exportLeadsBtn = document.getElementById('exportLeadsBtn');
    if (exportLeadsBtn) {
        exportLeadsBtn.addEventListener('click', () => {
            window.location.href = '/export_leads'; // This will trigger the Flask route to download leads
        });
    }

    const exportExpenditureBtn = document.getElementById('exportExpenditureBtn');
    if (exportExpenditureBtn) {
        exportExpenditureBtn.addEventListener('click', () => {
            // Get current filter dates from the report date pickers
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;

            let url = '/export_expenditure_report';
            const params = new URLSearchParams();
            if (startDate) {
                params.append('start_date', startDate);
            }
            if (endDate) {
                params.append('end_date', endDate);
            }
            if (params.toString()) {
                url += '?' + params.toString();
            }
            window.location.href = url; // This will trigger the Flask route to download the report with filters
        });
    }
    fetchAndRenderLeads();
    fetchAndRenderExpenditureReport();
    renderPlanningCalendar(); // Initial calendar render

    // Initialize Flatpickr for date inputs
    flatpickr("#dateOfContact", {});
    flatpickr("#followUp", {});
    flatpickr("#visitDate", {});
    flatpickr("#generalExpenseDate", {});
    flatpickr("#reportStartDate", {});
    flatpickr("#reportEndDate", {});
    flatpickr("#eventDate", {});
});