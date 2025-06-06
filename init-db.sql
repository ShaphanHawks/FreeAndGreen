-- Insert default SMS templates
INSERT INTO sms_templates (template_type, template_text) VALUES 
('Scheduled', 'We will be there on [scheduled_date] between [timeslot] to pick up your appliance.'),
('Completed', 'Your pickup at [address] has been completed. Thank you!')
ON CONFLICT (template_type) DO UPDATE SET template_text = EXCLUDED.template_text;

-- Insert sample crew accounts with hashed passwords
-- Password for all crews is "crew123"
INSERT INTO crews (email, password, display_name, zip_prefixes) VALUES 
('crew1@example.com', '$2b$10$K8qvzjQ4J5Y7YQzKvNv8.eR5Qz5FZN1ZV3YK5YKv8eR5Qz5FZN1ZV', 'North Crew', '{"100", "101", "102"}'),
('crew2@example.com', '$2b$10$K8qvzjQ4J5Y7YQzKvNv8.eR5Qz5FZN1ZV3YK5YKv8eR5Qz5FZN1ZV', 'South Crew', '{"200", "201", "202"}'),
('crew3@example.com', '$2b$10$K8qvzjQ4J5Y7YQzKvNv8.eR5Qz5FZN1ZV3YK5YKv8eR5Qz5FZN1ZV', 'East Crew', '{"300", "301", "302"}')
ON CONFLICT (email) DO NOTHING;

-- Insert sample ZIP assignments
INSERT INTO zip_assignments (zip_prefix, crew_id) VALUES 
('100', (SELECT id FROM crews WHERE email = 'crew1@example.com' LIMIT 1)),
('101', (SELECT id FROM crews WHERE email = 'crew1@example.com' LIMIT 1)),
('200', (SELECT id FROM crews WHERE email = 'crew2@example.com' LIMIT 1)),
('201', (SELECT id FROM crews WHERE email = 'crew2@example.com' LIMIT 1)),
('300', (SELECT id FROM crews WHERE email = 'crew3@example.com' LIMIT 1)),
('301', (SELECT id FROM crews WHERE email = 'crew3@example.com' LIMIT 1))
ON CONFLICT (zip_prefix) DO NOTHING;
