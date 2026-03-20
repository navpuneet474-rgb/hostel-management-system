"""
Serializers for the AI-Powered Hostel Coordination System API.
Handles serialization and deserialization of model data for REST API endpoints.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Student, Staff, GuestRequest, AbsenceRecord, MaintenanceRequest, AuditLog


class StudentSerializer(serializers.ModelSerializer):
    """Serializer for Student model."""
    
    has_recent_violations = serializers.ReadOnlyField()
    
    class Meta:
        model = Student
        fields = [
            'student_id', 'name', 'room_number', 'block', 'phone',
            'violation_count', 'last_violation_date', 'has_recent_violations',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class StaffSerializer(serializers.ModelSerializer):
    """Serializer for Staff model."""
    
    class Meta:
        model = Staff
        fields = [
            'staff_id', 'name', 'role', 'permissions', 'phone', 'email',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class GuestRequestSerializer(serializers.ModelSerializer):
    """Serializer for GuestRequest model."""
    
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_room = serializers.CharField(source='student.room_number', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    duration_days = serializers.ReadOnlyField()
    is_short_stay = serializers.ReadOnlyField()
    relationship_display = serializers.CharField(source='get_relationship_display', read_only=True)
    
    class Meta:
        model = GuestRequest
        fields = [
            'request_id', 'student', 'student_name', 'student_room',
            'guest_name', 'relationship', 'relationship_display', 'guest_phone', 
            'start_date', 'end_date', 'purpose',
            'status', 'auto_approved', 'approval_reason', 'approved_by',
            'approved_by_name', 'duration_days', 'is_short_stay',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'request_id', 'student', 'auto_approved', 'approved_by', 'created_at', 'updated_at'
        ]


class AbsenceRecordSerializer(serializers.ModelSerializer):
    """Serializer for AbsenceRecord model."""
    
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_room = serializers.CharField(source='student.room_number', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    duration_days = serializers.ReadOnlyField()
    is_short_leave = serializers.ReadOnlyField()
    
    class Meta:
        model = AbsenceRecord
        fields = [
            'absence_id', 'student', 'student_name', 'student_room',
            'start_date', 'end_date', 'reason', 'emergency_contact',
            'status', 'auto_approved', 'approval_reason', 'approved_by',
            'approved_by_name', 'duration_days', 'is_short_leave',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'absence_id', 'auto_approved', 'approved_by', 'created_at', 'updated_at'
        ]


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    """Serializer for MaintenanceRequest model."""
    
    student_name = serializers.CharField(source='student.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)
    is_overdue = serializers.ReadOnlyField()
    days_pending = serializers.ReadOnlyField()
    
    class Meta:
        model = MaintenanceRequest
        fields = [
            'request_id', 'student', 'student_name', 'room_number',
            'issue_type', 'description', 'priority', 'status',
            'auto_approved', 'assigned_to', 'assigned_to_name',
            'estimated_completion', 'actual_completion', 'notes',
            'is_overdue', 'days_pending', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'request_id', 'student', 'auto_approved', 'is_overdue', 'days_pending',
            'created_at', 'updated_at'
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model."""
    
    class Meta:
        model = AuditLog
        fields = [
            'log_id', 'action_type', 'entity_type', 'entity_id',
            'decision', 'reasoning', 'confidence_score', 'rules_applied',
            'user_id', 'user_type', 'metadata', 'timestamp'
        ]
        read_only_fields = ['log_id', 'timestamp']


class HealthCheckSerializer(serializers.Serializer):
    """Serializer for health check responses."""
    
    status = serializers.CharField()
    timestamp = serializers.DateTimeField()
    version = serializers.CharField()
    services = serializers.JSONField()


class SystemInfoSerializer(serializers.Serializer):
    """Serializer for system information responses."""
    
    project = serializers.CharField()
    version = serializers.CharField()
    features = serializers.JSONField()
    environment = serializers.CharField()
    database_status = serializers.CharField()


class RequestApprovalSerializer(serializers.Serializer):
    """Serializer for request approval/rejection."""
    
    request_id = serializers.UUIDField()
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    reason = serializers.CharField(max_length=500, required=False)
    staff_id = serializers.CharField(max_length=20)
    
    def validate_staff_id(self, value):
        """Validate staff member exists and has approval permissions."""
        try:
            staff = Staff.objects.get(staff_id=value, is_active=True)
            if staff.role not in ['warden', 'admin']:
                raise serializers.ValidationError("Staff member does not have approval permissions.")
        except Staff.DoesNotExist:
            raise serializers.ValidationError("Staff member not found or inactive.")
        return value