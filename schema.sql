-- SQLite schema for pickup scheduling system

-- Crews table
CREATE TABLE IF NOT EXISTS crews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    zip_prefixes TEXT -- JSON array of ZIP prefixes
);

-- Pickups table
CREATE TABLE IF NOT EXISTS pickups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    scheduled_date TEXT NOT NULL, -- ISO date string
    scheduled_timeslot TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled',
    crew_id INTEGER REFERENCES crews(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- ZIP assignments table
CREATE TABLE IF NOT EXISTS zip_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zip_prefix TEXT NOT NULL UNIQUE,
    crew_id INTEGER NOT NULL REFERENCES crews(id)
);

-- SMS templates table
CREATE TABLE IF NOT EXISTS sms_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_type TEXT NOT NULL UNIQUE, -- 'Scheduled' or 'Completed'
    template_text TEXT NOT NULL
);

-- Insert default SMS templates
INSERT OR REPLACE INTO sms_templates (template_type, template_text) VALUES 
('Scheduled', 'We will be there on [scheduled_date] between [timeslot] to pick up your appliance.'),
('Completed', 'Your pickup at [address] has been completed. Thank you!');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pickups_crew_id ON pickups(crew_id);
CREATE INDEX IF NOT EXISTS idx_pickups_scheduled_date ON pickups(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_pickups_status ON pickups(status);
CREATE INDEX IF NOT EXISTS idx_zip_assignments_prefix ON zip_assignments(zip_prefix);
