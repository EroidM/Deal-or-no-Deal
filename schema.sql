-- schema.sql
-- This file defines the database schema for the lead tracking tool.
-- Updated for PostgreSQL compatibility.

-- Drop tables if they already exist to ensure a clean slate on re-initialization.
-- This is useful during development for easy schema updates.
DROP TABLE IF EXISTS leads;
-- DROP TABLE IF EXISTS visits; -- This table was removed and its functionality moved to lead_activities
DROP TABLE IF EXISTS general_expenses;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS lead_activities; -- New table for all lead interactions

-- Create the 'leads' table to store lead contact information.
CREATE TABLE leads (
    id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
    firstName TEXT NOT NULL,
    lastName TEXT,
    title TEXT,
    company TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    product TEXT,
    stage TEXT NOT NULL,
    dateOfContact TEXT NOT NULL,
    followUp TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the 'lead_activities' table to store all interactions with leads, including visits.
CREATE TABLE lead_activities (
    id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
    lead_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    activity_date TEXT NOT NULL,
    description TEXT,
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    expenditure REAL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
);

-- Create the 'general_expenses' table for non-lead-specific expenditures.
CREATE TABLE general_expenses (
    id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the 'calendar_events' table to store scheduled events.
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
    date TEXT NOT NULL,                  -- Date of the event (YYYY-MM-DD)
    description TEXT,                    -- Description of the event
    type TEXT NOT NULL,                  -- Type of event (e.g., 'meeting', 'follow_up', 'visit', 'general_expense')
    lead_id INTEGER,                     -- Optional foreign key linking to a lead
    amount REAL,                         -- NEW: Amount associated with the event (e.g., for general expenses)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE SET NULL -- If a lead is deleted, lead_id for its events becomes NULL
);