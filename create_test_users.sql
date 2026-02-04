-- SQL script to create test users in Supabase
-- Run this in your Supabase SQL Editor

-- Create test student
INSERT INTO core_student (
    student_id, 
    name, 
    email, 
    password_hash, 
    room_number, 
    block, 
    phone, 
    is_first_login,
    mobile_number,
    roll_number
) VALUES (
    'STU001',
    'Test Student',
    'student@hostel.edu',
    'pbkdf2_sha256$600000$v8EVIVB2ZKcEtevvXLo11s$Lkuje/793BjFneKKB8BiJfQH+bEQroGKEOcKof+Yopo=',
    '101',
    'A',
    '1234567890',
    false,
    '',
    ''
)
ON CONFLICT (student_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    email = EXCLUDED.email;

-- Create test security staff
INSERT INTO core_staff (
    staff_id,
    name,
    email,
    password_hash,
    role,
    phone,
    is_active
) VALUES (
    'SEC001',
    'Security Guard',
    'security@hostel.edu',
    'pbkdf2_sha256$600000$AweQf3Vj9VaynmKgrGkgEr$m1eg5IKFY7TNQDA0zholTALG/Ai03Pd1tAaTckJ4TC4=',
    'security',
    '9876543210',
    true
)
ON CONFLICT (staff_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    email = EXCLUDED.email;

-- Create test warden
INSERT INTO core_staff (
    staff_id,
    name,
    email,
    password_hash,
    role,
    phone,
    is_active
) VALUES (
    'WAR001',
    'Hostel Warden',
    'warden@hostel.edu',
    'pbkdf2_sha256$600000$HAEZy5shkzXJDXCMJWTZX2$QPfoU3xsBL70MsCIIYOWW6lRXCZEIKsazkwCMXD+Gg4=',
    'warden',
    '9876543211',
    true
)
ON CONFLICT (staff_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    email = EXCLUDED.email;

-- Verify the users were created
SELECT 'Students:' as type, student_id as id, name, email FROM core_student WHERE student_id = 'STU001'
UNION ALL
SELECT 'Staff:' as type, staff_id as id, name, email FROM core_staff WHERE staff_id IN ('SEC001', 'WAR001');
