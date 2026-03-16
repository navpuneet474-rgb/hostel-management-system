-- Supabase Schema Setup for AI-Powered Hostel Coordination System
-- This file contains the complete database schema and RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS absence_records CASCADE;
DROP TABLE IF EXISTS guest_requests CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- Create Students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    block VARCHAR(5) NOT NULL,
    phone VARCHAR(15),
    violation_count INTEGER DEFAULT 0 CHECK (violation_count >= 0),
    last_violation_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Staff table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('warden', 'security', 'admin', 'maintenance')),
    permissions JSONB DEFAULT '{}',
    phone VARCHAR(15),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID UNIQUE DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES students(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    processed BOOLEAN DEFAULT FALSE,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    extracted_intent JSONB,
    response_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Guest Requests table
CREATE TABLE guest_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    guest_name VARCHAR(100) NOT NULL,
    guest_phone VARCHAR(15),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    purpose TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    auto_approved BOOLEAN DEFAULT FALSE,
    approval_reason TEXT,
    approved_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Create Absence Records table
CREATE TABLE absence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    absence_id UUID UNIQUE DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    emergency_contact VARCHAR(15),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    auto_approved BOOLEAN DEFAULT FALSE,
    approval_reason TEXT,
    approved_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_absence_range CHECK (end_date > start_date)
);

-- Create Audit Logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id UUID UNIQUE DEFAULT gen_random_uuid(),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('message_processing', 'guest_approval', 'absence_approval', 'rule_validation', 'conflict_detection', 'staff_query', 'system_action')),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected', 'escalated', 'processed', 'failed')),
    reasoning TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    rules_applied JSONB DEFAULT '[]',
    user_id VARCHAR(50) NOT NULL,
    user_type VARCHAR(20) DEFAULT 'student' CHECK (user_type IN ('student', 'staff')),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_room ON students(room_number, block);
CREATE INDEX idx_staff_staff_id ON staff(staff_id);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_guest_requests_student ON guest_requests(student_id);
CREATE INDEX idx_guest_requests_status ON guest_requests(status);
CREATE INDEX idx_guest_requests_dates ON guest_requests(start_date, end_date);
CREATE INDEX idx_absence_records_student ON absence_records(student_id);
CREATE INDEX idx_absence_records_dates ON absence_records(start_date, end_date);
CREATE INDEX idx_audit_logs_action_time ON audit_logs(action_type, timestamp);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp);

-- Enable Row Level Security on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Students table
CREATE POLICY "Students can view own data" ON students
    FOR SELECT USING (
        auth.uid()::text = student_id OR
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role IN ('warden', 'admin', 'security')
        )
    );

CREATE POLICY "Students can update own data" ON students
    FOR UPDATE USING (auth.uid()::text = student_id);

CREATE POLICY "Staff can manage all students" ON students
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role IN ('warden', 'admin')
        )
    );

-- RLS Policies for Staff table
CREATE POLICY "Staff can view own data" ON staff
    FOR SELECT USING (auth.uid()::text = staff_id);

CREATE POLICY "Admins can manage all staff" ON staff
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- RLS Policies for Messages table
CREATE POLICY "Students can view own messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = sender_id 
            AND student_id = auth.uid()::text
        )
    );

CREATE POLICY "Students can create messages" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = sender_id 
            AND student_id = auth.uid()::text
        )
    );

CREATE POLICY "Staff can view all messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role IN ('warden', 'admin', 'security')
        )
    );

-- RLS Policies for Guest Requests table
CREATE POLICY "Students can view own guest requests" ON guest_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id 
            AND student_id = auth.uid()::text
        )
    );

CREATE POLICY "Students can create guest requests" ON guest_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id 
            AND student_id = auth.uid()::text
        )
    );

CREATE POLICY "Staff can manage all guest requests" ON guest_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role IN ('warden', 'admin', 'security')
        )
    );

-- RLS Policies for Absence Records table
CREATE POLICY "Students can view own absence records" ON absence_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id 
            AND student_id = auth.uid()::text
        )
    );

CREATE POLICY "Students can create absence records" ON absence_records
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id 
            AND student_id = auth.uid()::text
        )
    );

CREATE POLICY "Staff can manage all absence records" ON absence_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role IN ('warden', 'admin')
        )
    );

-- RLS Policies for Audit Logs table
CREATE POLICY "Only admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "System can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Insert sample data for testing
INSERT INTO students (student_id, name, room_number, block, phone) VALUES
    ('STU001', 'John Doe', 'A101', 'A', '1234567890'),
    ('STU002', 'Jane Smith', 'A102', 'A', '1234567891'),
    ('STU003', 'Bob Johnson', 'B201', 'B', '1234567892');

INSERT INTO staff (staff_id, name, role, permissions, phone, email) VALUES
    ('STF001', 'Alice Wilson', 'warden', '{"approve_guests": true, "view_reports": true}', '0987654321', 'alice@hostel.edu'),
    ('STF002', 'Charlie Brown', 'security', '{"view_guests": true}', '0987654322', 'charlie@hostel.edu'),
    ('STF003', 'Diana Prince', 'admin', '{"full_access": true}', '0987654323', 'diana@hostel.edu');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_requests_updated_at BEFORE UPDATE ON guest_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_absence_records_updated_at BEFORE UPDATE ON absence_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();