-- SQL script to create test users using your existing auth_student/auth_staff tables
-- Run this in your Supabase SQL Editor

-- Insert test student into auth_student table
INSERT INTO auth_student (
    student_id, 
    name, 
    room_number, 
    block, 
    phone
) VALUES (
    'STU001',
    'Test Student',
    '209',
    'C',
    '1234567890'
)
ON CONFLICT (student_id) DO NOTHING;

-- Check if auth_user table exists and insert login credentials
-- First, let's see what tables you have
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%student%' OR table_name LIKE '%staff%' OR table_name LIKE '%user%'
ORDER BY table_name;
