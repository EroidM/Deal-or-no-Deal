-- seed.sql
-- This script inserts sample data into the dashboard database tables.
-- Run this AFTER init_db() has been executed.

-- Sample Leads
INSERT INTO leads (firstName, lastName, title, company, email, phone, product, stage, dateOfContact, followUp, notes) VALUES
('Alice', 'Smith', 'CEO', 'Tech Solutions Inc.', 'alice.s@example.com', '111-222-3333', 'Cloud Services', 'New', '2025-07-01', '2025-07-15', 'Initial contact via LinkedIn.'),
('Bob', 'Johnson', 'Marketing Director', 'Global Widgets Co.', 'bob.j@example.com', '444-555-6666', 'CRM Software', 'Qualified', '2025-06-20', '2025-08-01', 'Expressed strong interest during demo.'),
('Charlie', 'Brown', 'HR Manager', 'Innovate Corp.', 'charlie.b@example.com', '777-888-9999', 'HR Platform', 'Proposal', '2025-07-05', '2025-07-28', 'Sent proposal. Awaiting feedback.'),
('Diana', 'Prince', 'VP Sales', 'Wonder Enterprises', 'diana.p@example.com', '000-111-2222', 'Data Analytics', 'Negotiation', '2025-06-10', '2025-07-26', 'Discussing contract terms.'),
('Eve', 'Adams', 'Product Manager', 'Future Tech', 'eve.a@example.com', '333-444-5555', 'AI Solutions', 'Closed Won', '2025-05-25', NULL, 'Contract signed. Project initiated.'),
('Frank', 'White', 'Operations Lead', 'Old School Co.', 'frank.w@example.com', '666-777-8888', 'Legacy Systems', 'Closed Lost', '2025-06-01', NULL, 'Decided to stick with current vendor.');

-- Sample Lead Activities (including visits with geo-data)
INSERT INTO lead_activities (lead_id, activity_type, activity_date, description, latitude, longitude, location_name, expenditure) VALUES
((SELECT id FROM leads WHERE firstName = 'Alice'), 'call', '2025-07-02', 'Initial discovery call, identified pain points.', NULL, NULL, NULL, 0.00),
((SELECT id FROM leads WHERE firstName = 'Alice'), 'email', '2025-07-03', 'Sent follow-up email with product brochure.', NULL, NULL, NULL, 0.00),
((SELECT id FROM leads WHERE firstName = 'Alice'), 'visit', '2025-07-08', 'On-site meeting to discuss requirements.', -1.286389, 36.817223, 'Client Office, Nairobi CBD', 500.00), -- Example Nairobi coords
((SELECT id FROM leads WHERE firstName = 'Bob'), 'visit', '2025-07-10', 'Provided detailed product demo at their office.', -1.292066, 36.821946, 'Global Widgets HQ, Upper Hill', 750.00), -- Example Nairobi coords
((SELECT id FROM leads WHERE firstName = 'Bob'), 'note', '2025-07-11', 'Internal note: Bob seemed very impressed, strong potential.', NULL, NULL, NULL, 0.00),
((SELECT id FROM leads WHERE firstName = 'Charlie'), 'visit', '2025-07-12', 'Follow-up on proposal, addressed concerns.', -1.266667, 36.800000, 'Innovate Corp. Office, Westlands', 300.00), -- Example Nairobi coords
((SELECT id FROM leads WHERE firstName = 'Diana'), 'call', '2025-07-14', 'Negotiation call regarding pricing.', NULL, NULL, NULL, 0.00),
((SELECT id FROM leads WHERE firstName = 'Diana'), 'visit', '2025-07-15', 'Final negotiation meeting.', -1.300000, 36.800000, 'Wonder Enterprises HQ, Karen', 600.00); -- Example Nairobi coords

-- Sample General Expenses
INSERT INTO general_expenses (date, description, amount) VALUES
('2025-07-03', 'Office Supplies', 1200.50),
('2025-07-10', 'Marketing Campaign Ad Spend', 5000.00),
('2025-07-18', 'Team Lunch', 850.00);

-- Sample Calendar Events (Manual entries, including some linked to leads, and general expenses)
-- Note: 'visit' activities are now automatically added to calendar_events by app.py's add_lead_activity
INSERT INTO calendar_events (date, description, type, lead_id, amount) VALUES
('2025-07-27', 'Review Q3 Sales Targets', 'meeting', NULL, NULL),
('2025-07-29', 'Prepare for client presentation', 'office_day_note', NULL, NULL),
('2025-07-20', 'Cold visit to new industrial park', 'cold_visit', NULL, NULL),
('2025-07-25', 'Team Building Event', 'other', NULL, NULL),
('2025-07-15', 'Follow-up with Alice Smith', 'follow_up', (SELECT id FROM leads WHERE firstName = 'Alice'), NULL),
('2025-08-01', 'Follow-up with Bob Johnson', 'follow_up', (SELECT id FROM leads WHERE firstName = 'Bob'), NULL);

