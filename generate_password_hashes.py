#!/usr/bin/env python
"""
Generate password hashes for test users.
Run this script to get the hashed passwords for the SQL script.
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostel_coordination.settings')
django.setup()

from django.contrib.auth.hashers import make_password

# Generate password hashes
passwords = {
    'student123': make_password('student123'),
    'security123': make_password('security123'),
    'warden123': make_password('warden123')
}

print("Password Hashes Generated:")
print("=" * 80)
for pwd, hash_val in passwords.items():
    print(f"\nPassword: {pwd}")
    print(f"Hash: {hash_val}")
print("\n" + "=" * 80)

# Generate SQL script
sql_script = f"""-- SQL script to create test users in Supabase
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
    '{passwords['student123']}',
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
    '{passwords['security123']}',
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
    '{passwords['warden123']}',
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
"""

# Save to file
with open('create_test_users.sql', 'w') as f:
    f.write(sql_script)

print("\n✓ SQL script saved to: create_test_users.sql")
print("\nTest User Credentials:")
print("-" * 40)
print("Student: student@hostel.edu / student123")
print("Security: security@hostel.edu / security123")
print("Warden: warden@hostel.edu / warden123")
print("-" * 40)
