// dashboard.js - Final and complete version with all dashboard features

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';
import { getAuth, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard.js: DOM Content Loaded. Initializing dashboard components with Firebase.");

    // Global variables to hold fetched data for client-side operations
    let allLeads = [];
    let currentExpenditureData = [];
    let calendarInstance;
    let leadsStatusChart; // To store the Chart.js instance

    // --- Utility Functions: Loading Spinner & Messages ---

    /**
     * Shows a global loading overlay to indicate ongoing operations.
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
     * @param {'success'|'error'|'warning'} type - The message type.
     */
    function showMessage(message, type) {
        const messageBox = document.getElementById('messageBox');
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = `message-box ${type} active`;
            setTimeout(() => {
                messageBox.classList.remove('active');
            }, 5000);
        }
    }

    // --- Firebase Initialization ---

    /**
     * Fetches Firebase config and initializes the app and auth.
     */
    async function initializeFirebase() {
        showLoading();
        try {
            const response = await fetch('/firebase_config');
            if (!response.ok) {
                throw new Error('Failed to fetch Firebase config from server.');
            }
            const data = await response.json();
            console.log("Firebase config and auth token fetched successfully.");

            // Initialize Firebase with the received object
            const app = initializeApp(data.firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // Sign in with the custom token
            await signInWithCustomToken(auth, data.initialAuthToken);
            console.log("Firebase signed in with custom token. User ID:", auth.currentUser.uid);
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            showMessage(`Error initializing application: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    // --- View and Navigation Management ---

    /**
     * Toggles between different dashboard views.
     * @param {string} viewId - The ID of the view to show.
     */
    function showView(viewId) {
        document.querySelectorAll('.dashboard-view').forEach(view => {
            view.style.display = 'none';
        });
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.style.display = 'block';
            console.log(`Switched to view: ${viewId}`);
            // Trigger data load for the active view
            if (viewId === 'leads-view') {
                renderAllLeadsTable(allLeads);
                enableTableSorting('allLeadsTable', allLeads, renderAllLeadsTable);
            } else if (viewId === 'expenditure-report-view') {
                fetchExpenditureReport();
            } else if (viewId === 'calendar-view') {
                initFullCalendar();
            }
        }
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`.nav-link[data-view="${viewId}"]`)?.classList.add('active');
    }

    // Add event listeners for navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const viewId = event.target.dataset.view;
            showView(viewId);
        });
    });

    // --- Data Fetching and Rendering ---

    /**
     * Fetches leads data from the Flask API and populates all relevant sections.
     */
    async function fetchLeads() {
        showLoading();
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) {
                throw new Error('Failed to fetch leads.');
            }
            const data = await response.json();
            allLeads = data;
            
            // Render all relevant data
            renderOverviewCards(allLeads);
            renderOverviewCharts(allLeads);
            renderRecentLeadsTable(allLeads);
            
            // Setup sorting for the recent leads table
            enableTableSorting('recentLeadsTable', allLeads, renderRecentLeadsTable);
            
        } catch (error) {
            console.error('Error fetching leads:', error);
            showMessage('Failed to load leads data.', 'error');
        } finally {
            hideLoading();
        }
    }
    
    /**
     * Renders the summary cards on the overview page.
     * @param {Array} leads - The list of all leads.
     */
    function renderOverviewCards(leads) {
        const totalLeads = leads.length;
        const now = new Date();
        const thisMonth = now.getMonth();
        const newLeadsThisMonth = leads.filter(lead => {
            const leadDate = new Date(lead.created_at);
            return leadDate.getMonth() === thisMonth && leadDate.getFullYear() === now.getFullYear();
        }).length;
        const activeLeads = leads.filter(lead => lead.status.toLowerCase() === 'active').length;
        const wonDeals = leads.filter(lead => lead.status.toLowerCase() === 'won').length;

        document.getElementById('totalLeadsCount').textContent = totalLeads;
        document.getElementById('newLeadsCount').textContent = newLeadsThisMonth;
        document.getElementById('activeLeadsCount').textContent = activeLeads;
        document.getElementById('wonDealsCount').textContent = wonDeals;
    }

    /**
     * Renders the Chart.js graph for lead status.
     * @param {Array} leads - The list of all leads.
     */
    function renderOverviewCharts(leads) {
        if (leadsStatusChart) {
            leadsStatusChart.destroy();
        }

        const statusCounts = leads.reduce((acc, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);

        const ctx = document.getElementById('leadsStatusChart')?.getContext('2d');
        if (ctx) {
            leadsStatusChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '# of Leads by Status',
                        data: data,
                        backgroundColor: [
                            'rgba(76, 175, 80, 0.6)', // Primary Color
                            'rgba(33, 150, 243, 0.6)', // Secondary Color
                            'rgba(255, 193, 7, 0.6)', // Warning Color
                            'rgba(239, 83, 80, 0.6)' // Danger Color
                        ],
                        borderColor: [
                            'rgba(76, 175, 80, 1)',
                            'rgba(33, 150, 243, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(239, 83, 80, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }
    }
    
    /**
     * Renders the recent leads table on the overview page.
     * @param {Array} leads - The list of leads to render.
     */
    function renderRecentLeadsTable(leads) {
        const tableBody = document.querySelector('#recentLeadsTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const recentLeads = leads.slice(0, 5); // Display top 5 recent leads
        if (recentLeads.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No recent leads found.</td></tr>';
            return;
        }

        recentLeads.forEach(lead => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${lead.full_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.company || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.status}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(lead.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href="#" class="text-indigo-600 hover:text-indigo-900">Edit</a>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    /**
     * Renders the full leads table on the leads page.
     * @param {Array} leads - The list of all leads to render.
     */
    function renderAllLeadsTable(leads) {
        const tableBody = document.querySelector('#allLeadsTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (leads.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No leads found.</td></tr>';
            return;
        }

        leads.forEach(lead => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${lead.full_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.company || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.email || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.phone || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.status}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(lead.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href="#" class="text-indigo-600 hover:text-indigo-900">Edit</a>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    /**
     * Fetches and renders the expenditure report.
     * @param {string} startDate - Optional start date for filtering.
     * @param {string} endDate - Optional end date for filtering.
     */
    async function fetchExpenditureReport(startDate, endDate) {
        showLoading();
        try {
            let url = '/api/expenditure_report';
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            url += '?' + params.toString();

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch expenditure report.');
            }
            const data = await response.json();
            currentExpenditureData = data;
            renderExpenditureReportTable(currentExpenditureData);
        } catch (error) {
            console.error('Error fetching expenditure report:', error);
            showMessage('Failed to load expenditure data.', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Renders the expenditure report table.
     * @param {Array} report - The expenditure data.
     */
    function renderExpenditureReportTable(report) {
        const tableBody = document.querySelector('#expenditureReportTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (report.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No expenditure data found for this period.</td></tr>';
            return;
        }

        report.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${new Date(item.date).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.type_category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.description}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.amount.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.lead_full_name || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.company || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- FullCalendar Initialization ---

    /**
     * Initializes the FullCalendar instance.
     */
    function initFullCalendar() {
        if (calendarInstance) {
            calendarInstance.destroy();
        }
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,dayGridWeek,dayGridDay'
                },
                events: allLeads.map(lead => ({
                    title: `Lead: ${lead.full_name}`,
                    start: lead.created_at,
                    allDay: true,
                    backgroundColor: '#4CAF50',
                    borderColor: '#388E3C'
                }))
            });
            calendarInstance.render();
        }
    }

    // --- Table Sorting Logic ---

    /**
     * Enables client-side sorting on a table.
     * @param {string} tableId - The ID of the table.
     * @param {Array} data - The data array to sort.
     * @param {Function} renderFunction - The function to call to re-render the table.
     */
    function enableTableSorting(tableId, data, renderFunction) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const headers = table.querySelectorAll('th[data-sort-by]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const sortBy = header.dataset.sortBy;
                const sortDir = header.dataset.sortDir === 'asc' ? 'desc' : 'asc';
                
                // Update sorting direction in the dataset
                headers.forEach(h => {
                    h.dataset.sortDir = '';
                    const icon = h.querySelector('span.sort-icon');
                    if (icon) icon.textContent = '—';
                });
                header.dataset.sortDir = sortDir;
                const icon = header.querySelector('span.sort-icon');
                if (icon) {
                    icon.textContent = sortDir === 'asc' ? '▲' : '▼';
                }

                // Sort the data
                data.sort((a, b) => {
                    let aVal = a[sortBy];
                    let bVal = b[sortBy];
                    
                    if (typeof aVal === 'string') {
                        aVal = aVal.toLowerCase();
                        bVal = bVal.toLowerCase();
                    }
                    
                    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
                    return 0;
                });
                
                // Re-render the table with sorted data
                renderFunction(data);
            });
        });
    }

    // --- Main Initialization on DOMContentLoaded ---

    initializeFirebase().then(() => {
        // Once Firebase is ready, load the default view and data
        fetchLeads();
        // The first view is always 'overview-view'
        showView('overview-view');
    }).catch(error => {
        console.error("Firebase initialization failed, cannot proceed with dashboard.", error);
    });

    // --- Event Listeners for Date Pickers and Export Buttons ---

    // Date range picker for expenditure report
    const flatpickrRange = document.getElementById('flatpickr-range');
    if (flatpickrRange) {
        flatpickr(flatpickrRange, {
            mode: "range",
            dateFormat: "Y-m-d",
            onClose: function(selectedDates, dateStr, instance) {
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
    }

    // Export button for expenditure report
    document.getElementById('exportExpenditureBtn')?.addEventListener('click', function() {
        const dateRange = document.getElementById('flatpickr-range').value;
        const [startDate, endDate] = dateRange.split(' to ');
        
        let url = '/api/export_expenditure';
        const params = new URLSearchParams();
        if (startDate && startDate !== ' to ') {
            params.append('start_date', startDate);
            if (endDate) {
                params.append('end_date', endDate);
            }
            url += '?' + params.toString();
        }
        window.location.href = url;
    });

});
