"""
Views for the AI-Powered Hostel Coordination System.
REST API endpoints for message processing, request management, and system monitoring.
"""

import logging
from datetime import datetime, date
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.shortcuts import get_object_or_404, render
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import HttpResponse, Http404
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.decorators import action
from django.db.models import Q

from .models import Student, Staff, Message, GuestRequest, AbsenceRecord, MaintenanceRequest, AuditLog, DigitalPass, SecurityRecord
from .serializers import (
    StudentSerializer, StaffSerializer, MessageSerializer, MessageCreateSerializer,
    GuestRequestSerializer, AbsenceRecordSerializer, MaintenanceRequestSerializer,
    AuditLogSerializer, MessageProcessingResponseSerializer, HealthCheckSerializer,
    SystemInfoSerializer, StaffQuerySerializer, StaffQueryResponseSerializer,
    DailySummarySerializer, RequestApprovalSerializer, ConversationContextSerializer
)
from .authentication import (
    IsStudentOrStaff, IsStaffOnly, IsStudentOnly, HasStaffRole, 
    CanApproveRequests, CanAccessOwnDataOnly
)
from .security import (
    InputValidator, DataProtection, SecurityAuditLogger, validate_input
)
from .services.dashboard_service import dashboard_service
from .services.gemini_service import gemini_service
from .services.supabase_service import supabase_service
from .services.message_router_service import message_router, ProcessingResult, ProcessingStatus
from .services.daily_summary_service import daily_summary_generator as daily_summary_service
from .services.followup_bot_service import followup_bot_service
from .services.leave_request_service import leave_request_service
from .authentication import get_authenticated_user
from .utils import get_or_create_dev_staff, get_staff_from_request_or_dev, build_pass_history_query, format_pass_history_records

logger = logging.getLogger(__name__)

# Alias for backward compatibility - use get_authenticated_user directly in new code
get_user_from_request = get_authenticated_user
    
@method_decorator(csrf_exempt, name='dispatch')
class MessageViewSet(ModelViewSet):
    """ViewSet for managing messages and message processing."""
    
    queryset = Message.objects.all().order_by('-created_at')
    serializer_class = MessageSerializer
    permission_classes = [AllowAny]  # Allow unauthenticated access for development
    
    def get_queryset(self):
        """Filter queryset based on user type."""
        if hasattr(self.request.user, 'user_type'):
            if self.request.user.user_type == 'student':
                # Students can only see their own messages
                return self.queryset.filter(sender=self.request.user.user_object)
            elif self.request.user.user_type == 'staff':
                # Staff can see all messages
                return self.queryset
        logger.warning("No authenticated user - returning all (DEV)")
        return self.queryset
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer
    
    def create(self, request, *args, **kwargs):
        """Create and process a new message."""
        try:
            # Validate input data
            content = request.data.get('content', '')
            validated_content = InputValidator.validate_message_content(content)
            
            # Log data access event
            user_id = getattr(request.user, 'user_id', 'anonymous')
            SecurityAuditLogger.log_data_access_event(
                user_id=user_id,
                resource='message',
                action='create',
                request=request,
                details={'content_length': len(validated_content)}
            )
            
        except ValidationError as e:
            SecurityAuditLogger.log_security_event(
                event_type='input_validation_error',
                details={'error': str(e), 'field': 'content'},
                request=request,
                severity='WARNING'
            )
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create serializer with validated data
        data = request.data.copy()
        data['content'] = validated_content
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        
        # Get or create sender based on user context
        sender = None
        user_context = request.data.get('user_context', {})
        
        if hasattr(request.user, 'user_object') and request.user.user_object:
            # For authenticated users, always use a student instance for messages
            if isinstance(request.user.user_object, Student):
                sender = request.user.user_object
            else:
                # If it's a staff member, create/get a development student for message storage
                sender, created = Student.objects.get_or_create(
                    student_id='STAFF_MSG_001',
                    defaults={
                        'name': f"Staff Message ({request.user.user_object.name})",
                        'room_number': '000',
                        'block': 'STAFF',
                        'phone': '0000000000'
                    }
                )
        elif user_context and user_context.get('name') != 'Guest User':
            # Try to find user based on context
            user_name = user_context.get('name', '')
            user_role = user_context.get('role', 'guest')
            
            if user_role == 'student':
                # Try to find student by name or create development student
                try:
                    sender = Student.objects.filter(name__icontains=user_name).first()
                    if not sender:
                        # Create a development student
                        sender, created = Student.objects.get_or_create(
                            student_id=user_context.get('user_id', 'DEV001'),
                            defaults={
                                'name': user_name,
                                'room_number': user_context.get('room_number', '101').split(',')[0].replace('Room ', ''),
                                'block': 'A',
                                'phone': '1234567890'
                            }
                        )
                except Exception as e:
                    logger.warning(f"Could not create/find student from context: {e}")
                    sender = None
            elif user_role == 'staff':
                # For staff messages, create a special student record to store the message
                try:
                    sender, created = Student.objects.get_or_create(
                        student_id=f"STAFF_{user_context.get('user_id', 'STAFF001')}",
                        defaults={
                            'name': f"Staff Message ({user_name})",
                            'room_number': '000',
                            'block': 'STAFF',
                            'phone': '0000000000'
                        }
                    )
                except Exception as e:
                    logger.warning(f"Could not create staff message record: {e}")
                    sender = None
        
        if not sender:
            # Fallback to default development student
            sender, created = Student.objects.get_or_create(
                student_id='DEV001',
                defaults={
                    'name': 'Development Student',
                    'room_number': '101',
                    'block': 'A',
                    'phone': '1234567890'
                }
            )
        
        # Create the message
        message = serializer.save(sender=sender, status='pending')
        
        try:
            # Process the message through the router
            # Pass the actual user context to the router for proper handling
            actual_user_context = user_context if user_context else {}
            
            # If this is a staff message, route it as a staff query
            if user_context and user_context.get('role') == 'staff':
                # Handle as staff query
                staff_member, created = Staff.objects.get_or_create(
                    staff_id=user_context.get('user_id', 'STAFF001'),
                    defaults={
                        'name': user_context.get('name', 'Staff Member'),
                        'role': 'warden',
                        'email': f"{user_context.get('user_id', 'staff')}@hostel.edu",
                        'phone': '9876543210'
                    }
                )
                
                # Process as staff query
                query_result = message_router.handle_staff_query(validated_content, staff_member)
                
                # Convert staff query result to message processing result format
                processing_result = ProcessingResult(
                    status=ProcessingStatus.SUCCESS if query_result['status'] == 'success' else ProcessingStatus.FAILED,
                    response_message=query_result['response'],
                    confidence=1.0,
                    intent_result=None,
                    approval_result=None,
                    conversation_context=None,
                    requires_follow_up=False,
                    metadata=query_result.get('metadata', {})
                )
            else:
                # Handle as regular student message
                processing_result = message_router.route_message(message)
            
            # Sanitize response data for logging
            sanitized_metadata = DataProtection.sanitize_for_logging(processing_result.metadata)
            
            # Prepare response
            response_data = {
                'success': True,
                'message_id': str(message.message_id),
                'ai_response': processing_result.response_message,
                'status': processing_result.status.value,
                'confidence': processing_result.confidence,
                'needs_clarification': processing_result.requires_follow_up,
                'clarification_question': processing_result.response_message if processing_result.requires_follow_up else None,
                'conversation_id': f"conv_{sender.student_id}_{timezone.now().strftime('%Y%m%d')}",
                'metadata': sanitized_metadata
            }
            
            # Log successful processing
            SecurityAuditLogger.log_data_access_event(
                user_id=sender.student_id,
                resource='message',
                action='process_success',
                request=request,
                details={'message_id': str(message.message_id), 'status': processing_result.status.value}
            )
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error processing message {message.message_id}: {e}")
            message.status = 'failed'
            message.save()
            
            # Log processing error
            SecurityAuditLogger.log_security_event(
                event_type='message_processing_error',
                details={'message_id': str(message.message_id), 'error': str(e)},
                request=request,
                severity='ERROR'
            )
            
            return Response({
                'success': False,
                'message_id': str(message.message_id),
                'error': 'Failed to process message',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def by_student(self, request):
        """Get messages for a specific student."""
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id parameter required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        messages = self.queryset.filter(sender__student_id=student_id)
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent messages (last 24 hours)."""
        # Get messages for the current user
        if not hasattr(request.user, 'user_object') or not request.user.user_object:
            return Response({'results': []})
        
        sender = request.user.user_object
        
        since = timezone.now() - timezone.timedelta(hours=24)
        messages = self.queryset.filter(sender=sender, created_at__gte=since)
        serializer = self.get_serializer(messages, many=True)
        return Response({'results': serializer.data})
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Handle file uploads for chat interface."""
        try:
            if 'file' not in request.FILES:
                return Response({
                    'success': False,
                    'error': 'No file provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            uploaded_file = request.FILES['file']
            file_type = request.data.get('type', 'document')
            
            # Validate file size (max 10MB)
            if uploaded_file.size > 10 * 1024 * 1024:
                return Response({
                    'success': False,
                    'error': 'File size must be less than 10MB'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate file type
            allowed_types = {
                'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                'document': ['.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx']
            }
            
            file_extension = uploaded_file.name.lower().split('.')[-1]
            if f'.{file_extension}' not in allowed_types.get(file_type, []):
                return Response({
                    'success': False,
                    'error': f'File type not allowed for {file_type}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Save file (in production, you'd want to use cloud storage)
            import os
            from django.conf import settings
            
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'chat_uploads')
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate unique filename
            import uuid
            unique_filename = f"{uuid.uuid4()}_{uploaded_file.name}"
            file_path = os.path.join(upload_dir, unique_filename)
            
            with open(file_path, 'wb+') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            
            # Generate URL for the file
            file_url = f"{settings.MEDIA_URL}chat_uploads/{unique_filename}"
            
            return Response({
                'success': True,
                'url': file_url,
                'filename': uploaded_file.name,
                'size': uploaded_file.size,
                'type': file_type
            })
            
        except Exception as e:
            logger.error(f"File upload error: {e}")
            return Response({
                'success': False,
                'error': 'Upload failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GuestRequestViewSet(ModelViewSet):
    """ViewSet for managing guest requests."""
    
    queryset = GuestRequest.objects.all().order_by('-created_at')
    serializer_class = GuestRequestSerializer
    permission_classes = [AllowAny]  # Allow session-authenticated students
    
    def get_queryset(self):
        """Filter queryset based on user type."""
        # Debug logging for session data
        session_user_id = self.request.session.get('user_id')
        session_user_type = self.request.session.get('user_type')
        logger.debug(f"GuestRequest get_queryset: session_user_id={session_user_id}, session_user_type={session_user_type}")
        
        user_object, auth_source = get_user_from_request(self.request)
        logger.debug(f"GuestRequest get_queryset: auth_source={auth_source}, user_object={user_object}")
        
        if user_object:
            if isinstance(user_object, Student):
                logger.debug(f"Filtering guest requests for student: {user_object.student_id}")
                return self.queryset.filter(student=user_object)
            elif isinstance(user_object, Staff):
                logger.debug(f"Returning all guest requests for staff: {user_object.staff_id}")
                return self.queryset
        
        # FALLBACK for development - return empty queryset for unauthenticated
        logger.warning(f"No authenticated user - session_user_id={session_user_id}")
        return self.queryset.none()
    
    def create(self, request, *args, **kwargs):
        """Override create to ensure only authenticated students can create guest requests."""
        user_object, auth_source = get_user_from_request(self.request)
        
        if not user_object:
            return Response(
                {'error': 'Authentication required. Please log in.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not isinstance(user_object, Student):
            return Response(
                {'error': 'Only students can submit guest requests.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().create(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        """Set the student to the current user when creating a guest request."""
        from .authentication import get_authenticated_user
        user_object, auth_source = get_user_from_request(self.request)
        
        if user_object and isinstance(user_object, Student):
            serializer.save(student=user_object)
        else:
            # For non-students, still save but may be empty depending on permissions
            serializer.save()
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending guest requests."""
        pending_requests = self.get_queryset().filter(status='pending')
        serializer = self.get_serializer(pending_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active (approved) guest requests."""
        active_requests = self.queryset.filter(
            status='approved',
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        )
        serializer = self.get_serializer(active_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a guest request."""
        guest_request = self.get_object()
        staff_id = request.data.get('staff_id')
        reason = request.data.get('reason', 'Approved by staff')
        
        # Check if user has approval permissions
        if not request.user.is_staff_member:
            return Response({'error': 'Only staff can approve requests'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        if request.user.user_object.role not in ['warden', 'admin']:
            return Response({'error': 'Insufficient permissions to approve requests'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        try:
            guest_request.status = 'approved'
            guest_request.approved_by = request.user.user_object
            guest_request.approval_reason = reason
            guest_request.save()
            
            # Send approval email to student
            from .services.email_service import email_service
            email_success, email_message = email_service.send_guest_approval_email(
                student=guest_request.student,
                guest_request=guest_request,
                approved_by=request.user.user_object
            )
            
            # Notify security personnel
            from .services.notification_service import notification_service
            security_results = notification_service.notify_security_guest_approval(
                guest_request=guest_request,
                student=guest_request.student,
                approved_by=request.user.user_object
            )
            security_notified = sum(1 for results in security_results.values() if any(r.success for r in results))
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            serializer = self.get_serializer(guest_request)
            response_data = serializer.data
            response_data['email_sent'] = email_success
            response_data['security_notified'] = security_notified
            return Response(response_data)
            
        except Exception as e:
            return Response({'error': f'Failed to approve request: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a guest request."""
        guest_request = self.get_object()
        staff_id = request.data.get('staff_id')
        reason = request.data.get('reason', 'Rejected by staff')
        
        if not staff_id:
            return Response({'error': 'staff_id required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            staff = Staff.objects.get(staff_id=staff_id, is_active=True)
            guest_request.status = 'rejected'
            guest_request.approved_by = staff
            guest_request.approval_reason = reason
            guest_request.save()
            
            serializer = self.get_serializer(guest_request)
            return Response(serializer.data)
            
        except Staff.DoesNotExist:
            return Response({'error': 'Staff member not found'}, 
                          status=status.HTTP_404_NOT_FOUND)


class AbsenceRecordViewSet(ModelViewSet):
    """ViewSet for managing absence records."""
    
    queryset = AbsenceRecord.objects.all().order_by('-created_at')
    serializer_class = AbsenceRecordSerializer
    permission_classes = [AllowAny]  # Allow session-authenticated students
    
    def get_queryset(self):
        """Filter queryset based on user type."""
        # Use the authentication helper to get the user
        from .authentication import get_authenticated_user
        user_object, auth_type = get_user_from_request(self.request)
        
        # Debug logging
        session_user_id = self.request.session.get('user_id')
        logger.debug(f"AbsenceRecord get_queryset: auth_type={auth_type}, user_object={user_object}, session_user_id={session_user_id}")
        
        if user_object:
            if isinstance(user_object, Student):
                # Students can only see their own records
                logger.debug(f"Filtering absence records for student: {user_object.student_id}")
                return self.queryset.filter(student=user_object)
            elif isinstance(user_object, Staff):
                # Staff can see all records
                logger.debug(f"Returning all absence records for staff: {user_object.staff_id}")
                return self.queryset
        
        # Return empty queryset for unauthenticated users
        logger.warning(f"AbsenceRecord: No authenticated user - session_user_id={session_user_id}")
        return self.queryset.none()
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending absence requests."""
        pending_requests = self.get_queryset().filter(status='pending')
        serializer = self.get_serializer(pending_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active (approved) absence records."""
        active_absences = self.queryset.filter(
            status='approved',
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        )
        serializer = self.get_serializer(active_absences, many=True)
        return Response(serializer.data)


class MaintenanceRequestViewSet(ModelViewSet):
    """ViewSet for managing maintenance requests."""
    
    queryset = MaintenanceRequest.objects.all().order_by('-created_at')
    serializer_class = MaintenanceRequestSerializer
    permission_classes = [AllowAny]  # Allow session-authenticated students
    
    def get_queryset(self):
        """Filter queryset based on user type."""
        # Use the authentication helper to get the user
        from .authentication import get_authenticated_user
        user_object, auth_type = get_user_from_request(self.request)
        
        # Debug logging
        session_user_id = self.request.session.get('user_id')
        logger.debug(f"MaintenanceRequest get_queryset: auth_type={auth_type}, user_object={user_object}, session_user_id={session_user_id}")
        
        if user_object:
            if isinstance(user_object, Student):
                # Students can only see their own requests
                logger.debug(f"Filtering maintenance requests for student: {user_object.student_id}")
                return self.queryset.filter(student=user_object)
            elif isinstance(user_object, Staff):
                # Staff can see all requests
                logger.debug(f"Returning all maintenance requests for staff: {user_object.staff_id}")
                return self.queryset
        
        # Return empty queryset for unauthenticated users
        logger.warning(f"MaintenanceRequest: No authenticated user - session_user_id={session_user_id}")
        return self.queryset.none()
    
    def perform_create(self, serializer):
        """Set the student to the current user when creating a maintenance request."""
        from .authentication import get_authenticated_user
        user_object, auth_source = get_user_from_request(self.request)
        
        if user_object and isinstance(user_object, Student):
            serializer.save(student=user_object)
        else:
            # For non-students, still save but may be empty depending on permissions
            serializer.save()
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending maintenance requests."""
        pending_requests = self.queryset.filter(status='pending')
        serializer = self.get_serializer(pending_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all overdue maintenance requests."""
        overdue_requests = [req for req in self.queryset.all() if req.is_overdue]
        serializer = self.get_serializer(overdue_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign a maintenance request to staff."""
        maintenance_request = self.get_object()
        staff_id = request.data.get('staff_id')
        estimated_completion = request.data.get('estimated_completion')
        
        if not staff_id:
            return Response({'error': 'staff_id required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            staff = Staff.objects.get(staff_id=staff_id, is_active=True)
            maintenance_request.assigned_to = staff
            maintenance_request.status = 'assigned'
            if estimated_completion:
                maintenance_request.estimated_completion = estimated_completion
            maintenance_request.save()
            
            serializer = self.get_serializer(maintenance_request)
            return Response(serializer.data)
            
        except Staff.DoesNotExist:
            return Response({'error': 'Staff member not found'}, 
                          status=status.HTTP_404_NOT_FOUND)


class StudentViewSet(ReadOnlyModelViewSet):
    """ViewSet for student information (read-only)."""
    
    queryset = Student.objects.all().order_by('student_id')
    serializer_class = StudentSerializer
    permission_classes = [IsStudentOrStaff]  # Require authentication
    lookup_field = 'student_id'
    
    @action(detail=True, methods=['get'])
    def requests(self, request, student_id=None):
        """Get all requests for a specific student."""
        student = self.get_object()
        
        guest_requests = GuestRequest.objects.filter(student=student).order_by('-created_at')
        absence_records = AbsenceRecord.objects.filter(student=student).order_by('-created_at')
        maintenance_requests = MaintenanceRequest.objects.filter(student=student).order_by('-created_at')
        
        return Response({
            'student': StudentSerializer(student).data,
            'guest_requests': GuestRequestSerializer(guest_requests, many=True).data,
            'absence_records': AbsenceRecordSerializer(absence_records, many=True).data,
            'maintenance_requests': MaintenanceRequestSerializer(maintenance_requests, many=True).data
        })


class StaffViewSet(ReadOnlyModelViewSet):
    """ViewSet for staff information (read-only)."""
    
    queryset = Staff.objects.filter(is_active=True).order_by('staff_id')
    serializer_class = StaffSerializer
    permission_classes = [IsStaffOnly]  # Only staff can view staff info
    lookup_field = 'staff_id'


class AuditLogViewSet(ReadOnlyModelViewSet):
    """ViewSet for audit logs (read-only)."""
    
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsStaffOnly]  # Only staff can view audit logs
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent audit logs (last 24 hours)."""
        since = timezone.now() - timezone.timedelta(hours=24)
        logs = self.queryset.filter(timestamp__gte=since)
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_user(self, request):
        """Get audit logs for a specific user."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'user_id parameter required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        logs = self.queryset.filter(user_id=user_id)
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def staff_query(request):
    """Process natural language queries from staff."""
    try:
        # Validate input
        query = request.data.get('query', '')
        validated_query = InputValidator.validate_query_content(query)
        
        # Log staff query access
        user_id = getattr(request.user, 'user_id', 'unknown')
        SecurityAuditLogger.log_data_access_event(
            user_id=user_id,
            resource='staff_query',
            action='execute',
            request=request,
            details={'query_length': len(validated_query)}
        )
        
    except ValidationError as e:
        SecurityAuditLogger.log_security_event(
            event_type='input_validation_error',
            details={'error': str(e), 'field': 'query'},
            request=request,
            severity='WARNING'
        )
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get or create default staff for development
        staff_member = get_staff_from_request_or_dev(request)
        
        # Process the query through the message router
        query_result = message_router.handle_staff_query(validated_query, staff_member)
        
        # Sanitize response data
        sanitized_results = query_result.get('results', [])
        sanitized_metadata = query_result.get('metadata', {})
        
        # Only sanitize if they are dictionaries
        if isinstance(sanitized_results, dict):
            sanitized_results = DataProtection.sanitize_for_logging(sanitized_results)
        if isinstance(sanitized_metadata, dict):
            sanitized_metadata = DataProtection.sanitize_for_logging(sanitized_metadata)
        
        response_data = {
            'success': query_result['status'] == 'success',
            'query': validated_query,
            'response': query_result['response'],
            'query_type': query_result['query_type'],
            'results': sanitized_results,
            'metadata': sanitized_metadata
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error processing staff query: {e}")
        
        # Log query processing error
        SecurityAuditLogger.log_security_event(
            event_type='staff_query_error',
            details={'error': str(e), 'user_id': user_id},
            request=request,
            severity='ERROR'
        )
        
        return Response({
            'success': False,
            'error': 'Failed to process query',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsStaffOnly])
def daily_summary(request):
    """Get daily summary for a specific date."""
    from dataclasses import asdict
    
    date_str = request.query_params.get('date')
    if date_str:
        try:
            summary_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                          status=status.HTTP_400_BAD_REQUEST)
    else:
        summary_date = datetime.now()
    
    try:
        summary_data = daily_summary_service.generate_morning_summary(summary_date)
        return Response(asdict(summary_data), status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error generating daily summary: {e}")
        return Response({
            'error': 'Failed to generate daily summary',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def conversation_status(request):
    """Get status of active follow-up conversations."""
    # Simplified - return empty conversations since followup bot is simplified
    return Response({
        'total_conversations': 0,
        'conversations': []
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def debug_auth_status(request):
    """Debug endpoint to check authentication status."""
    session_user_id = request.session.get('user_id')
    session_user_type = request.session.get('user_type')
    
    from .authentication import get_authenticated_user
    user_object, auth_type = get_authenticated_user(request)
    
    logger.info(f"DEBUG: session_user_id={session_user_id}, session_user_type={session_user_type}, auth_type={auth_type}, user_object={user_object}")
    
    return Response({
        'session': {
            'user_id': session_user_id,
            'user_type': session_user_type,
            'session_keys': list(request.session.keys())
        },
        'authenticated_user': {
            'user_object': str(user_object) if user_object else None,
            'auth_type': auth_type
        },
        'request_user': {
            'is_authenticated': request.user.is_authenticated,
            'user': str(request.user)
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify system status.
    Returns the status of all major system components.
    """
    try:
        health_status = {
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
            "services": {
                "django": "healthy",
                "supabase": "healthy" if supabase_service.is_configured() else "not_configured",
                "gemini_ai": "healthy" if gemini_service.is_configured() else "not_configured",
                "message_router": "healthy",
                "followup_bot": "healthy",
                "daily_summary": "healthy"
            },
            "version": "1.0.0"
        }
        
        # Determine overall status
        if not supabase_service.is_configured() or not gemini_service.is_configured():
            health_status["status"] = "degraded"
            
        return Response(health_status, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return Response({
            "status": "unhealthy",
            "error": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def approve_request(request):
    """Approve a pending request (guest, absence, or maintenance)."""
    request_type = request.data.get('request_type')
    request_id = request.data.get('request_id')
    reason = request.data.get('reason', 'Approved by staff')
    
    if not request_type or not request_id:
        return Response({'error': 'request_type and request_id required'}, 
                      status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get or create default staff for development
        staff_member, created = Staff.objects.get_or_create(
            staff_id='STAFF001',
            defaults={
                'name': 'Development Warden',
                'role': 'warden',
                'email': 'warden@hostel.edu',
                'phone': '9876543210'
            }
        )
        
        if request_type == 'guest':
            guest_request = get_object_or_404(GuestRequest, request_id=request_id)
            guest_request.status = 'approved'
            guest_request.approved_by = staff_member
            guest_request.approval_reason = reason
            guest_request.save()
            
            # Send approval email to student with guest pass details
            from .services.email_service import email_service
            email_success, email_message = email_service.send_guest_approval_email(
                student=guest_request.student,
                guest_request=guest_request,
                approved_by=staff_member
            )
            
            if email_success:
                logger.info(f"Guest approval email sent to {guest_request.student.email}")
            else:
                logger.warning(f"Failed to send guest approval email: {email_message}")
            
            # Notify security personnel about the approved guest
            from .services.notification_service import notification_service
            security_results = notification_service.notify_security_guest_approval(
                guest_request=guest_request,
                student=guest_request.student,
                approved_by=staff_member
            )
            
            # Count successful security notifications
            security_notified = sum(1 for results in security_results.values() if any(r.success for r in results))
            logger.info(f"Security personnel notified: {security_notified}")
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response({
                'success': True,
                'message': f'Guest request for {guest_request.guest_name} approved',
                'email_sent': email_success,
                'email_message': email_message,
                'security_notified': security_notified,
                'request': GuestRequestSerializer(guest_request).data
            })
            
        elif request_type == 'absence':
            absence_request = get_object_or_404(AbsenceRecord, absence_id=request_id)
            absence_request.status = 'approved'
            absence_request.approved_by = staff_member
            absence_request.approval_reason = reason
            absence_request.save()
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response({
                'success': True,
                'message': f'Absence request for {absence_request.student.name} approved',
                'request': AbsenceRecordSerializer(absence_request).data
            })
            
        elif request_type == 'maintenance':
            maintenance_request = get_object_or_404(MaintenanceRequest, request_id=request_id)
            maintenance_request.status = 'assigned'
            maintenance_request.assigned_to = staff_member
            maintenance_request.save()
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response({
                'success': True,
                'message': f'Maintenance request assigned',
                'request': MaintenanceRequestSerializer(maintenance_request).data
            })
            
        else:
            return Response({'error': 'Invalid request_type'}, 
                          status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error approving request: {e}")
        return Response({'error': f'Failed to approve request: {str(e)}'}, 
                      status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def reject_request(request):
    """Reject a pending request (guest, absence, or maintenance)."""
    request_type = request.data.get('request_type')
    request_id = request.data.get('request_id')
    reason = request.data.get('reason', 'Rejected by staff')
    
    if not request_type or not request_id:
        return Response({'error': 'request_type and request_id required'}, 
                      status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get or create default staff for development
        staff_member, _ = get_or_create_dev_staff()
        
        if request_type == 'guest':
            guest_request = get_object_or_404(GuestRequest, request_id=request_id)
            guest_request.status = 'rejected'
            guest_request.approved_by = staff_member
            guest_request.approval_reason = reason
            guest_request.save()
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response({
                'success': True,
                'message': f'Guest request for {guest_request.guest_name} rejected',
                'request': GuestRequestSerializer(guest_request).data
            })
            
        elif request_type == 'absence':
            absence_request = get_object_or_404(AbsenceRecord, absence_id=request_id)
            absence_request.status = 'rejected'
            absence_request.approved_by = staff_member
            absence_request.approval_reason = reason
            absence_request.save()
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response({
                'success': True,
                'message': f'Absence request for {absence_request.student.name} rejected',
                'request': AbsenceRecordSerializer(absence_request).data
            })
            
        elif request_type == 'maintenance':
            maintenance_request = get_object_or_404(MaintenanceRequest, request_id=request_id)
            maintenance_request.status = 'cancelled'
            maintenance_request.notes = reason
            maintenance_request.save()
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response({
                'success': True,
                'message': f'Maintenance request cancelled',
                'request': MaintenanceRequestSerializer(maintenance_request).data
            })
            
        else:
            return Response({'error': 'Invalid request_type'}, 
                          status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error rejecting request: {e}")
        return Response({'error': f'Failed to reject request: {str(e)}'}, 
                      status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def dashboard_data(request):
    """Get dashboard data for staff interface with caching."""
    try:
        # Check if force refresh is requested
        force_refresh = request.GET.get('refresh', 'false').lower() == 'true'
        
        # Get dashboard data using the service
        result = dashboard_service.get_dashboard_data(force_refresh=force_refresh)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Error in dashboard_data view: {e}")
        return Response({
            'success': False,
            'error': f'Failed to load dashboard data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def students_present_details(request):
    """Get detailed information about students currently present."""
    try:
        result = dashboard_service.get_students_present_details()
        return Response({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error getting present students details: {e}")
        return Response({
            'success': False,
            'error': f'Failed to get present students details: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def invalidate_dashboard_cache(request):
    """Invalidate dashboard cache for fresh data."""
    try:
        cache_type = request.data.get('cache_type')  # Optional: 'stats', 'requests', 'activity', 'summary'
        dashboard_service.invalidate_cache(cache_type)
        
        return Response({
            'success': True,
            'message': f'Dashboard cache {"(" + cache_type + ")" if cache_type else ""} invalidated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error invalidating dashboard cache: {e}")
        return Response({
            'success': False,
            'error': f'Failed to invalidate cache: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def submit_leave_request(request):
    """Submit an enhanced leave request with auto-approval logic."""
    try:
        # Get request data
        from_date_str = request.data.get('from_date')
        to_date_str = request.data.get('to_date')
        reason = request.data.get('reason', '').strip()
        emergency_contact = request.data.get('emergency_contact', '').strip()
        
        # Validate required fields
        if not all([from_date_str, to_date_str, reason]):
            return Response({
                'success': False,
                'error': 'From date, to date, and reason are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse dates
        try:
            from datetime import datetime
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get authenticated student (supports both JWT and session auth)
        from .authentication import get_authenticated_user
        student, auth_type = get_user_from_request(request)
        
        logger.debug(f"Leave request - auth_type: {auth_type}, session_user_id: {request.session.get('user_id')}")
        
        if not student:
            logger.warning(f"Leave request - unauthenticated from {request.META.get('REMOTE_ADDR')}")
            return Response({
                'success': False,
                'error': 'Please log in to submit a leave request'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Process the leave request
        result = leave_request_service.process_leave_request(
            student=student,
            from_date=from_date,
            to_date=to_date,
            reason=reason,
            emergency_contact=emergency_contact if emergency_contact else None
        )
        
        if result.success:
            response_data = {
                'success': True,
                'message': result.message,
                'auto_approved': result.auto_approved,
                'requires_warden_approval': result.requires_warden_approval,
                'absence_record': {
                    'id': str(result.absence_record.absence_id),
                    'status': result.absence_record.status,
                    'from_date': result.absence_record.start_date.date().isoformat(),
                    'to_date': result.absence_record.end_date.date().isoformat(),
                    'total_days': (result.absence_record.end_date.date() - result.absence_record.start_date.date()).days + 1,
                    'reason': result.absence_record.reason
                }
            }
            
            # Add digital pass info if generated
            if result.digital_pass:
                response_data['digital_pass'] = {
                    'pass_number': result.digital_pass.pass_number,
                    'verification_code': result.digital_pass.verification_code,
                    'status': result.digital_pass.status,
                    'from_date': result.digital_pass.from_date.isoformat(),
                    'to_date': result.digital_pass.to_date.isoformat(),
                    'total_days': result.digital_pass.total_days
                }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        else:
            return Response({
                'success': False,
                'error': result.error or result.message
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error in submit_leave_request: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while processing your leave request'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def get_digital_passes(request):
    """Get digital passes for the current student."""
    try:
        # Get authenticated student (supports both JWT and session auth)
        from .authentication import get_authenticated_user
        student, auth_type = get_user_from_request(request)
        
        # Debug logging
        logger.debug(f"Digital passes request - auth_type: {auth_type}, session_user_id: {request.session.get('user_id')}, student: {student}")
        
        if not student:
            logger.warning(f"Digital passes - unauthenticated request from {request.META.get('REMOTE_ADDR')}")
            # Return empty list for unauthenticated users
            return Response({
                'success': True,
                'passes': []
            })
        
        # Filter passes for this student only
        digital_passes = DigitalPass.objects.filter(
            student=student
        ).order_by('-created_at')
        
        passes_data = []
        for pass_obj in digital_passes:
            passes_data.append({
                'pass_number': pass_obj.pass_number,
                'student_name': pass_obj.student.name,  # From pass record (correct student)
                'student_id': pass_obj.student.student_id,  # From pass record (correct student)
                'room_number': pass_obj.student.room_number,  # From pass record (correct student)
                'verification_code': pass_obj.verification_code,
                'from_date': pass_obj.from_date.isoformat(),
                'to_date': pass_obj.to_date.isoformat(),
                'total_days': pass_obj.total_days,
                'reason': pass_obj.reason,
                'status': pass_obj.status,
                'approval_type': pass_obj.approval_type,
                'is_valid': pass_obj.is_valid,
                'days_remaining': pass_obj.days_remaining,
                'created_at': pass_obj.created_at.isoformat()
            })
        
        return Response({
            'success': True,
            'passes': passes_data
        })
    
    except Exception as e:
        logger.error(f"Error in get_digital_passes: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while fetching digital passes'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def verify_digital_pass(request):
    """Verify a digital pass by pass number."""
    try:
        pass_number = request.data.get('pass_number', '').strip()
        verified_by = request.data.get('verified_by', 'Security Personnel')
        
        if not pass_number:
            return Response({
                'success': False,
                'error': 'Pass number is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify the pass
        verification_result = leave_request_service.verify_digital_pass(pass_number)
        
        # Record verification event if pass exists
        if verification_result.get('valid'):
            try:
                digital_pass = DigitalPass.objects.get(pass_number=pass_number)
                # Update or create security record with verification details
                security_record, created = SecurityRecord.objects.get_or_create(
                    student=digital_pass.student,
                    digital_pass=digital_pass,
                    defaults={
                        'status': 'allowed_to_leave',
                        'verified_by': verified_by,
                        'verification_time': timezone.now(),
                        'notes': f'Pass verified via security dashboard'
                    }
                )
                if not created:
                    # Update existing record with latest verification
                    security_record.verified_by = verified_by
                    security_record.verification_time = timezone.now()
                    security_record.notes = f'Pass re-verified via security dashboard'
                    security_record.save()
                    
                # Add verification timestamp to result
                verification_result['last_verified'] = timezone.now().isoformat()
                verification_result['verified_by'] = verified_by
                
            except DigitalPass.DoesNotExist:
                pass  # Pass not found, already handled in verification_result
        
        return Response({
            'success': True,
            'verification_result': verification_result
        })
    
    except Exception as e:
        logger.error(f"Error in verify_digital_pass: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while verifying the pass'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def approve_leave_request(request):
    """Approve a pending leave request and generate digital pass."""
    try:
        absence_id = request.data.get('absence_id')
        approval_reason = request.data.get('reason', 'Approved by warden')
        
        if not absence_id:
            return Response({
                'success': False,
                'error': 'absence_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the absence record with UUID validation
        try:
            absence_record = AbsenceRecord.objects.get(absence_id=absence_id)
        except AbsenceRecord.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Leave request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, ValidationError) as e:
            # Handle UUID validation errors
            return Response({
                'success': False,
                'error': 'Invalid UUID format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create default staff for development
        staff_member = get_staff_from_request_or_dev(request)
        
        # Approve the leave request
        result = leave_request_service.approve_leave_request(
            absence_record=absence_record,
            approved_by=staff_member,
            approval_reason=approval_reason
        )
        
        if result.success:
            response_data = {
                'success': True,
                'message': result.message,
                'absence_record': {
                    'id': str(result.absence_record.absence_id),
                    'status': result.absence_record.status,
                    'student_name': result.absence_record.student.name,
                    'from_date': result.absence_record.start_date.date().isoformat(),
                    'to_date': result.absence_record.end_date.date().isoformat(),
                    'total_days': (result.absence_record.end_date.date() - result.absence_record.start_date.date()).days + 1,
                    'reason': result.absence_record.reason,
                    'approved_by': staff_member.name
                }
            }
            
            # Add digital pass info
            if result.digital_pass:
                response_data['digital_pass'] = {
                    'pass_number': result.digital_pass.pass_number,
                    'verification_code': result.digital_pass.verification_code,
                    'status': result.digital_pass.status,
                    'from_date': result.digital_pass.from_date.isoformat(),
                    'to_date': result.digital_pass.to_date.isoformat(),
                    'total_days': result.digital_pass.total_days
                }
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response(response_data, status=status.HTTP_200_OK)
        
        else:
            return Response({
                'success': False,
                'error': result.error or result.message
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error in approve_leave_request: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while approving the leave request'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def reject_leave_request(request):
    """Reject a pending leave request."""
    try:
        absence_id = request.data.get('absence_id')
        rejection_reason = request.data.get('reason')
        
        if not absence_id:
            return Response({
                'success': False,
                'error': 'absence_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate reason is required for rejection
        if not rejection_reason or not rejection_reason.strip():
            return Response({
                'success': False,
                'error': 'Rejection reason is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the absence record with UUID validation
        try:
            absence_record = AbsenceRecord.objects.get(absence_id=absence_id)
        except AbsenceRecord.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Leave request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, ValidationError) as e:
            # Handle UUID validation errors
            return Response({
                'success': False,
                'error': 'Invalid UUID format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create default staff for development
        staff_member = get_staff_from_request_or_dev(request)
        
        # Reject the leave request
        result = leave_request_service.reject_leave_request(
            absence_record=absence_record,
            rejected_by=staff_member,
            rejection_reason=rejection_reason
        )
        
        if result.success:
            response_data = {
                'success': True,
                'message': result.message,
                'absence_record': {
                    'id': str(result.absence_record.absence_id),
                    'status': result.absence_record.status,
                    'student_name': result.absence_record.student.name,
                    'from_date': result.absence_record.start_date.date().isoformat(),
                    'to_date': result.absence_record.end_date.date().isoformat(),
                    'total_days': (result.absence_record.end_date.date() - result.absence_record.start_date.date()).days + 1,
                    'reason': result.absence_record.reason,
                    'rejected_by': staff_member.name,
                    'rejection_reason': rejection_reason
                }
            }
            
            # Invalidate dashboard cache
            dashboard_service.invalidate_cache()
            
            return Response(response_data, status=status.HTTP_200_OK)
        
        else:
            return Response({
                'success': False,
                'error': result.error or result.message
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error in reject_leave_request: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while rejecting the leave request'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def download_digital_pass(request, pass_number):
    """Download PDF for a digital pass."""
    try:
        logger.info(f"Attempting to download pass: {pass_number}")
        
        # Get the digital pass
        try:
            logger.info(f"Looking up DigitalPass with pass_number: {pass_number}")
            digital_pass = DigitalPass.objects.get(pass_number=pass_number)
            logger.info(f"Found digital pass: {digital_pass.pass_number}, pdf_generated: {digital_pass.pdf_generated}, pdf_path: {digital_pass.pdf_path}")
        except DigitalPass.DoesNotExist:
            logger.error(f"Digital pass not found for pass_number: {pass_number}")
            return Response({
                'success': False,
                'error': f'Digital pass not found: {pass_number}'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if user has permission to download this pass
        # For development, allow all; in production, check if user is the student or staff
        user_can_download = True
        if hasattr(request.user, 'user_object') and request.user.user_object:
            user_obj = request.user.user_object
            if isinstance(user_obj, Student):
                # Students can only download their own passes
                user_can_download = (user_obj.student_id == digital_pass.student.student_id)
            elif isinstance(user_obj, Staff):
                # Staff can download any pass
                user_can_download = True
        
        if not user_can_download:
            return Response({
                'success': False,
                'error': 'Permission denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get PDF bytes
        pdf_bytes = leave_request_service.get_pass_pdf_bytes(digital_pass)
        
        if not pdf_bytes:
            return Response({
                'success': False,
                'error': 'PDF not available or could not be generated'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Detect content type based on file extension or content
        is_html = (digital_pass.pdf_path and digital_pass.pdf_path.endswith('.html')) or \
                  pdf_bytes.startswith(b'<!DOCTYPE html') or pdf_bytes.startswith(b'<html')
        
        # Create HTTP response with appropriate content type
        if is_html:
            response = HttpResponse(pdf_bytes, content_type='text/html')
            filename = f"leave_pass_{digital_pass.pass_number}_{digital_pass.student.student_id}.html"
        else:
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"leave_pass_{digital_pass.pass_number}_{digital_pass.student.student_id}.pdf"
        
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(pdf_bytes)
        
        return response
    
    except Exception as e:
        logger.error(f"Error downloading digital pass {pass_number}: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while downloading the pass'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def security_verification_dashboard(request):
    """Render the security verification dashboard."""
    return render(request, 'security/verification_dashboard.html')


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def get_security_stats(request):
    """Get security statistics for the verification dashboard."""
    try:
        from django.db.models import Q
        from datetime import date
        
        today = timezone.now().date()
        
        # Count active passes (valid today)
        active_passes = DigitalPass.objects.filter(
            status='active',
            from_date__lte=today,
            to_date__gte=today
        ).count()
        
        # Count students currently away (with active passes)
        students_away = SecurityRecord.objects.filter(
            status='allowed_to_leave',
            digital_pass__status='active',
            digital_pass__from_date__lte=today,
            digital_pass__to_date__gte=today
        ).count()
        
        # Count expired passes
        expired_passes = DigitalPass.objects.filter(
            Q(status='expired') | Q(to_date__lt=today)
        ).count()
        
        return Response({
            'success': True,
            'stats': {
                'active_passes': active_passes,
                'students_away': students_away,
                'expired_passes': expired_passes
            }
        })
    
    except Exception as e:
        logger.error(f"Error getting security stats: {e}")
        return Response({
            'success': False,
            'error': 'Failed to load security statistics'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def get_all_active_passes(request):
    """Get all currently active digital passes for security verification."""
    try:
        from datetime import date
        
        today = timezone.now().date()
        
        # Get all active passes
        active_passes = DigitalPass.objects.filter(
            status='active',
            from_date__lte=today,
            to_date__gte=today
        ).select_related('student').order_by('-created_at')
        
        passes_data = []
        for pass_obj in active_passes:
            passes_data.append({
                'pass_number': pass_obj.pass_number,
                'verification_code': pass_obj.verification_code,
                'student_name': pass_obj.student.name,
                'student_id': pass_obj.student.student_id,
                'room_number': pass_obj.student.room_number,
                'block': pass_obj.student.block,
                'from_date': pass_obj.from_date.isoformat(),
                'to_date': pass_obj.to_date.isoformat(),
                'total_days': pass_obj.total_days,
                'reason': pass_obj.reason,
                'days_remaining': pass_obj.days_remaining,
                'approval_type': pass_obj.approval_type,
                'created_at': pass_obj.created_at.isoformat()
            })
        
        return Response({
            'success': True,
            'active_passes': passes_data
        })
    
    except Exception as e:
        logger.error(f"Error getting all active passes: {e}")
        return Response({
            'success': False,
            'error': 'Failed to load active passes'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])  # Allow for development
def search_student_passes(request):
    """Search for student passes by name or ID."""
    try:
        # Support both GET and POST requests
        if request.method == 'GET':
            student_name = request.query_params.get('q', '').strip()
        else:
            student_name = request.data.get('student_name', '').strip() or request.data.get('q', '').strip()
        
        if not student_name:
            return Response({
                'success': False,
                'error': 'Student name or ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Search for students by name OR student ID (case-insensitive partial match)
        students = Student.objects.filter(
            Q(name__icontains=student_name) | Q(student_id__icontains=student_name)
        ).prefetch_related('digital_passes')[:20]  # Limit results
        
        today = timezone.now().date()
        results = []
        for student in students:
            # Get active passes for this student (valid today)
            active_passes = student.digital_passes.filter(
                status='active',
                from_date__lte=today,
                to_date__gte=today
            ).order_by('-created_at')
            
            has_active_pass = active_passes.exists()
            
            student_data = {
                'student_id': student.student_id,
                'name': student.name,
                'room_number': student.room_number,
                'block': student.block,
                'email': student.email,
                'has_active_pass': has_active_pass,
                'active_passes': []
            }
            
            for pass_obj in active_passes:
                student_data['active_passes'].append({
                    'pass_number': pass_obj.pass_number,
                    'verification_code': pass_obj.verification_code,
                    'from_date': pass_obj.from_date.isoformat(),
                    'to_date': pass_obj.to_date.isoformat(),
                    'total_days': pass_obj.total_days,
                    'reason': pass_obj.reason,
                    'is_valid': pass_obj.is_valid,
                    'days_remaining': pass_obj.days_remaining
                })
            
            results.append(student_data)
        
        return Response({
            'success': True,
            'students': results
        })
    
    except Exception as e:
        logger.error(f"Error searching student passes: {e}")
        return Response({
            'success': False,
            'error': 'Failed to search student passes'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def get_recent_verifications(request):
    """Get recent pass verification history for security dashboard."""
    try:
        # Get recent verifications from the last 24 hours
        since = timezone.now() - timezone.timedelta(hours=24)
        recent_verifications = SecurityRecord.objects.filter(
            verification_time__gte=since
        ).select_related('student', 'digital_pass').order_by('-verification_time')[:10]
        
        verifications_data = []
        for record in recent_verifications:
            verifications_data.append({
                'student_name': record.student.name,
                'student_id': record.student.student_id,
                'pass_number': record.digital_pass.pass_number if record.digital_pass else 'N/A',
                'verified_by': record.verified_by or 'Unknown',
                'verification_time': record.verification_time.isoformat() if record.verification_time else None,
                'status': record.status,
                'notes': record.notes or ''
            })
        
        return Response({
            'success': True,
            'recent_verifications': verifications_data
        })
    
    except Exception as e:
        logger.error(f"Error getting recent verifications: {e}")
        return Response({
            'success': False,
            'error': 'Failed to load recent verifications'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def clear_messages(request):
    """Clear chat messages for a user."""
    try:
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response({
                'success': False,
                'error': 'user_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find messages for this user
        # For development, we'll clear messages based on user context
        messages_deleted = 0
        
        # Try to find student by user_id or name
        try:
            # First try to find by student_id
            student = Student.objects.filter(student_id=user_id).first()
            if not student:
                # Try to find by name (for development users)
                student = Student.objects.filter(name__icontains=user_id.replace('-', ' ')).first()
            
            if student:
                # Delete messages for this student
                messages_to_delete = Message.objects.filter(sender=student)
                messages_deleted = messages_to_delete.count()
                messages_to_delete.delete()
                
                logger.info(f"Cleared {messages_deleted} messages for user {user_id}")
            
        except Exception as e:
            logger.warning(f"Could not find specific user {user_id}, clearing anyway: {e}")
        
        # Log the clear action
        SecurityAuditLogger.log_data_access_event(
            user_id=user_id,
            resource='messages',
            action='clear_chat',
            request=request,
            details={'messages_deleted': messages_deleted}
        )
        
        return Response({
            'success': True,
            'message': f'Chat cleared successfully ({messages_deleted} messages deleted)',
            'messages_deleted': messages_deleted
        })
        
    except Exception as e:
        logger.error(f"Error clearing messages: {e}")
        return Response({
            'success': False,
            'error': 'Failed to clear messages'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow for development
def bulk_verify_passes(request):
    """Bulk verify multiple passes at once."""
    try:
        pass_numbers = request.data.get('pass_numbers', [])
        verified_by = request.data.get('verified_by', 'Security Personnel')
        
        if not pass_numbers or not isinstance(pass_numbers, list):
            return Response({
                'success': False,
                'error': 'pass_numbers array is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        results = []
        for pass_number in pass_numbers:
            try:
                # Verify each pass
                verification_result = leave_request_service.verify_digital_pass(pass_number.strip())
                
                # Record verification event if pass exists
                if verification_result.get('valid'):
                    try:
                        digital_pass = DigitalPass.objects.get(pass_number=pass_number.strip())
                        # Update or create security record with verification details
                        security_record, created = SecurityRecord.objects.get_or_create(
                            student=digital_pass.student,
                            digital_pass=digital_pass,
                            defaults={
                                'status': 'allowed_to_leave',
                                'verified_by': verified_by,
                                'verification_time': timezone.now(),
                                'notes': f'Pass verified via bulk verification'
                            }
                        )
                        if not created:
                            # Update existing record with latest verification
                            security_record.verified_by = verified_by
                            security_record.verification_time = timezone.now()
                            security_record.notes = f'Pass re-verified via bulk verification'
                            security_record.save()
                            
                        # Add verification timestamp to result
                        verification_result['last_verified'] = timezone.now().isoformat()
                        verification_result['verified_by'] = verified_by
                        
                    except DigitalPass.DoesNotExist:
                        pass  # Pass not found, already handled in verification_result
                
                results.append({
                    'pass_number': pass_number.strip(),
                    'verification_result': verification_result
                })
                
            except Exception as e:
                results.append({
                    'pass_number': pass_number.strip(),
                    'verification_result': {
                        'valid': False,
                        'error': f'Error verifying pass: {str(e)}'
                    }
                })
        
        return Response({
            'success': True,
            'results': results
        })
    
    except Exception as e:
        logger.error(f"Error in bulk_verify_passes: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred during bulk verification'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def export_security_report(request):
    """Export security report with pass verification data."""
    try:
        from datetime import date
        import csv
        from io import StringIO
        
        # Get date range from query parameters
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                start_date = date.today() - timezone.timedelta(days=7)
        else:
            start_date = date.today() - timezone.timedelta(days=7)
            
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                end_date = date.today()
        else:
            end_date = date.today()
        
        # Get verification records within date range
        verification_records = SecurityRecord.objects.filter(
            verification_time__date__gte=start_date,
            verification_time__date__lte=end_date
        ).select_related('student', 'digital_pass').order_by('-verification_time')
        
        # Create CSV content
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date', 'Time', 'Student Name', 'Student ID', 'Room', 'Block',
            'Pass Number', 'Verification Code', 'Verified By', 'Status', 'Notes'
        ])
        
        # Write data rows
        for record in verification_records:
            verification_time = record.verification_time or timezone.now()
            writer.writerow([
                verification_time.strftime('%Y-%m-%d'),
                verification_time.strftime('%H:%M:%S'),
                record.student.name,
                record.student.student_id,
                record.student.room_number,
                record.student.block,
                record.digital_pass.pass_number if record.digital_pass else 'N/A',
                record.digital_pass.verification_code if record.digital_pass else 'N/A',
                record.verified_by or 'Unknown',
                record.status,
                record.notes or ''
            ])
        
        # Create HTTP response
        csv_content = output.getvalue()
        output.close()
        
        response = HttpResponse(csv_content, content_type='text/csv')
        filename = f'security_report_{start_date}_{end_date}.csv'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    except Exception as e:
        logger.error(f"Error exporting security report: {e}")
        return Response({
            'success': False,
            'error': 'Failed to export security report'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def get_students_by_date_range(request):
    """Get students with passes valid within a specific date range."""
    try:
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if not start_date_str or not end_date_str:
            return Response({
                'success': False,
                'error': 'start_date and end_date parameters are required (YYYY-MM-DD format)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get passes that overlap with the date range
        passes_in_range = DigitalPass.objects.filter(
            status='active',
            from_date__lte=end_date,
            to_date__gte=start_date
        ).select_related('student').order_by('from_date')
        
        students_data = []
        for pass_obj in passes_in_range:
            students_data.append({
                'student_name': pass_obj.student.name,
                'student_id': pass_obj.student.student_id,
                'room_number': pass_obj.student.room_number,
                'block': pass_obj.student.block,
                'pass_number': pass_obj.pass_number,
                'verification_code': pass_obj.verification_code,
                'from_date': pass_obj.from_date.isoformat(),
                'to_date': pass_obj.to_date.isoformat(),
                'total_days': pass_obj.total_days,
                'reason': pass_obj.reason,
                'approval_type': pass_obj.approval_type,
                'is_valid_today': pass_obj.is_valid,
                'days_remaining': pass_obj.days_remaining
            })
        
        return Response({
            'success': True,
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'students_with_passes': students_data,
            'total_count': len(students_data)
        })
    
    except Exception as e:
        logger.error(f"Error getting students by date range: {e}")
        return Response({
            'success': False,
            'error': 'Failed to get students by date range'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow for development
def view_digital_pass(request, pass_number):
    """View PDF for a digital pass in browser."""
    try:
        logger.info(f"Attempting to view pass: {pass_number}")
        
        # Get the digital pass
        try:
            logger.info(f"Looking up DigitalPass with pass_number: {pass_number}")
            digital_pass = DigitalPass.objects.get(pass_number=pass_number)
            logger.info(f"Found digital pass: {digital_pass.pass_number}, pdf_generated: {digital_pass.pdf_generated}, pdf_path: {digital_pass.pdf_path}")
        except DigitalPass.DoesNotExist:
            logger.error(f"Digital pass not found for pass_number: {pass_number}")
            raise Http404("Digital pass not found")
        
        # Check if user has permission to view this pass
        user_can_view = True
        if hasattr(request.user, 'user_object') and request.user.user_object:
            user_obj = request.user.user_object
            if isinstance(user_obj, Student):
                # Students can only view their own passes
                user_can_view = (user_obj.student_id == digital_pass.student.student_id)
            elif isinstance(user_obj, Staff):
                # Staff can view any pass
                user_can_view = True
        
        if not user_can_view:
            raise Http404("Permission denied")
        
        # Get PDF bytes
        pdf_bytes = leave_request_service.get_pass_pdf_bytes(digital_pass)
        
        if not pdf_bytes:
            raise Http404("PDF not available")
        
        # Detect content type based on file extension or content
        is_html = (digital_pass.pdf_path and digital_pass.pdf_path.endswith('.html')) or \
                  pdf_bytes.startswith(b'<!DOCTYPE html') or pdf_bytes.startswith(b'<html')
        
        # Create HTTP response with appropriate content type for viewing
        if is_html:
            response = HttpResponse(pdf_bytes, content_type='text/html')
            filename = f"leave_pass_{digital_pass.pass_number}_{digital_pass.student.student_id}.html"
        else:
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"leave_pass_{digital_pass.pass_number}_{digital_pass.student.student_id}.pdf"
        
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['Content-Length'] = len(pdf_bytes)
        
        return response
    
    except Exception as e:
        logger.error(f"Error viewing digital pass {pass_number}: {e}")
        raise Http404("An error occurred while viewing the pass")


@api_view(['GET'])
@permission_classes([AllowAny])
def system_info(request):
    """
    System information endpoint for debugging and monitoring.
    """
    try:
        info = {
            "project": "AI-Powered Hostel Coordination System",
            "version": "1.0.0",
            "django_version": "4.2.7",
            "features": [
                "Natural Language Processing",
                "Auto-Approval Engine", 
                "Follow-up Bot System",
                "Message Routing",
                "Daily Summaries",
                "Comprehensive Audit Logging",
                "Staff Dashboard",
                "Staff Query Interface"
            ],
            "endpoints": {
                "health": "/api/health/",
                "info": "/api/info/",
                "messages": "/api/messages/",
                "guest-requests": "/api/guest-requests/",
                "absence-records": "/api/absence-records/",
                "maintenance-requests": "/api/maintenance-requests/",
                "students": "/api/students/",
                "staff": "/api/staff/",
                "audit-logs": "/api/audit-logs/",
                "staff-query": "/api/staff-query/",
                "daily-summary": "/api/daily-summary/",
                "conversation-status": "/api/conversation-status/",
                "dashboard-data": "/api/dashboard-data/",
                "approve-request": "/api/approve-request/",
                "reject-request": "/api/reject-request/"
            },
            "environment": "development",
            "database_status": "connected"
        }
        
        return Response(info, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"System info request failed: {e}")
        return Response({
            "error": "Unable to retrieve system information"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def chat_interface(request):
    """
    Render the chat interface template.
    Provides a WhatsApp-like chat experience for students and staff.
    """
    # Get user context for template
    user_context = {}
    
    # Get user information from session
    user_id = request.session.get('user_id')
    user_type = request.session.get('user_type')
    
    if user_id and user_type:
        if user_type == 'student':
            try:
                student = Student.objects.get(student_id=user_id)
                user_context = {
                    'name': student.name,
                    'room_number': student.room_number,
                    'block': student.block,
                    'email': student.email,
                    'user_type': 'student'
                }
            except Student.DoesNotExist:
                user_context = {
                    'name': 'Student',
                    'room_number': '',
                    'block': '',
                    'email': '',
                    'user_type': 'student'
                }
        elif user_type in ['staff', 'warden']:
            try:
                staff = Staff.objects.get(staff_id=user_id)
                user_context = {
                    'name': staff.name,
                    'designation': staff.role.title(),
                    'email': staff.email,
                    'user_type': user_type
                }
            except Staff.DoesNotExist:
                user_context = {
                    'name': 'Staff Member',
                    'designation': 'Staff',
                    'email': '',
                    'user_type': user_type
                }
    else:
        # For development/testing - try to get from session or create test user
        session_user = request.session.get('test_user')
        if session_user:
            user_context = session_user
        else:
            # Create a test student context for development
            user_context = {
                'name': 'Test Student',
                'room_number': '101',
                'block': 'A',
                'email': 'test@example.com',
                'user_type': 'student'
            }
    
    return render(request, 'chat/index.html', {'user': user_context})


@api_view(['GET'])
@permission_classes([IsStaffOnly])
def get_pass_history(request):
    """Get comprehensive pass history for staff/admin."""
    try:
        logger.info(f"get_pass_history called with params: {dict(request.query_params)}")
        
        # Get filter parameters
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        student_name = request.query_params.get('student_name')
        pass_type = request.query_params.get('pass_type')  # 'digital' or 'leave'
        status_filter = request.query_params.get('status')
        
        logger.info(f"Filters - start: {start_date_str}, end: {end_date_str}, pass_type: {pass_type}, status: {status_filter}")
        
        # Use shared utility function for filtering
        digital_passes, absence_records = build_pass_history_query(
            start_date_str=start_date_str,
            end_date_str=end_date_str,
            student_name=student_name,
            status_filter=status_filter,
            pass_type=pass_type
        )
        
        logger.info(f"After filtering: digital_passes={digital_passes.count()}, absence_records={absence_records.count()}")
        
        # Use shared utility function for formatting
        history = format_pass_history_records(digital_passes, absence_records, pass_type)
        
        logger.info(f"Returning {len(history)} records")
        
        return Response({
            'success': True,
            'total_records': len(history),
            'history': history
        })
    
    except Exception as e:
        logger.error(f"Error in get_pass_history: {e}", exc_info=True)
        return Response({
            'success': False,
            'error': 'Failed to retrieve pass history'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsStaffOnly])
def export_pass_history(request):
    """Export pass history as CSV."""
    try:
        import csv
        from io import StringIO
        
        # Get filter parameters
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        student_name = request.query_params.get('student_name')
        pass_type = request.query_params.get('pass_type')
        status_filter = request.query_params.get('status')
        
        # Use shared utility function for filtering
        digital_passes, absence_records = build_pass_history_query(
            start_date_str=start_date_str,
            end_date_str=end_date_str,
            student_name=student_name,
            status_filter=status_filter,
            pass_type=pass_type
        )
        
        # Use shared utility function for formatting
        history = format_pass_history_records(digital_passes, absence_records, pass_type)
        
        # Create CSV content
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Type', 'Student Name', 'Student ID', 'Room Number',
            'Pass Number', 'From Date', 'To Date', 'Total Days',
            'Status', 'Approved By', 'Created At'
        ])
        
        # Write data rows
        for record in history:
            writer.writerow([
                record['type'],
                record['student_name'],
                record['student_id'],
                record['room_number'],
                record['pass_number'],
                record['from_date'],
                record['to_date'],
                record['total_days'],
                record['status'],
                record['approved_by'],
                record['created_at']
            ])
        
        # Create HTTP response
        csv_content = output.getvalue()
        output.close()
        
        response = HttpResponse(csv_content, content_type='text/csv')
        filename = f'pass_history_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    except Exception as e:
        logger.error(f"Error exporting pass history: {e}")
        return Response({
            'success': False,
            'error': 'Failed to export pass history'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def staff_dashboard(request):
    """
    Render the staff dashboard for wardens and administrators.
    Provides overview of pending requests, daily summaries, and management tools.
    """
    # Get staff member from request or use dev staff
    staff_member = get_staff_from_request_or_dev(request)
    
    # Get dashboard data
    try:
        # Pending requests
        pending_guest_requests = GuestRequest.objects.filter(status='pending').order_by('-created_at')[:10]
        pending_absence_requests = AbsenceRecord.objects.filter(status='pending').order_by('-created_at')[:10]
        pending_maintenance_requests = MaintenanceRequest.objects.filter(status='pending').order_by('-created_at')[:10]
        
        # Recent activity
        recent_messages = Message.objects.filter(status='processed').order_by('-created_at')[:5]
        recent_audit_logs = AuditLog.objects.order_by('-timestamp')[:10]
        
        # Statistics
        stats = {
            'total_pending_requests': (
                pending_guest_requests.count() + 
                pending_absence_requests.count() + 
                pending_maintenance_requests.count()
            ),
            'total_students': Student.objects.count(),
            'active_guests': GuestRequest.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).count(),
            'absent_students': AbsenceRecord.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).count(),
        }
        
        # Get today's daily summary
        from dataclasses import asdict
        today_summary = daily_summary_service.generate_morning_summary(datetime.now())
        
        context = {
            'staff': staff_member,
            'pending_guest_requests': pending_guest_requests,
            'pending_absence_requests': pending_absence_requests,
            'pending_maintenance_requests': pending_maintenance_requests,
            'recent_messages': recent_messages,
            'recent_audit_logs': recent_audit_logs,
            'stats': stats,
            'daily_summary': asdict(today_summary),
        }
        
        return render(request, 'staff/dashboard.html', context)
        
    except Exception as e:
        logger.error(f"Error loading staff dashboard: {e}")
        # Fallback context for errors
        context = {
            'staff': staff_member,
            'error': 'Unable to load dashboard data',
            'stats': {'total_pending_requests': 0, 'total_students': 0, 'active_guests': 0, 'absent_students': 0}
        }
        return render(request, 'staff/dashboard.html', context)


def pass_history_view(request):
    """
    Render the pass history page for staff.
    """
    return render(request, 'staff/pass_history.html')


def security_dashboard(request):
    """
    Render the security staff dashboard.
    Provides pass verification, student tracking, and gate management tools.
    """
    # Get security staff member from session
    security_staff = None
    if hasattr(request.user, 'user_object') and request.user.user_object:
        security_staff = request.user.user_object
    else:
        # Try to get from session
        user_id = request.session.get('user_id')
        if user_id:
            try:
                security_staff = Staff.objects.get(staff_id=user_id)
            except Staff.DoesNotExist:
                pass
    
    # Get today's statistics
    today = timezone.now().date()
    now = timezone.now()
    
    # Active passes count
    active_passes_count = DigitalPass.objects.filter(
        status='active',
        from_date__lte=today,
        to_date__gte=today
    ).count()
    
    # Students currently away
    students_away_count = SecurityRecord.objects.filter(
        status='allowed_to_leave',
        digital_pass__status='active',
        digital_pass__from_date__lte=today,
        digital_pass__to_date__gte=today
    ).count()
    
    # Recent verifications
    recent_verifications = SecurityRecord.objects.filter(
        verification_time__date=today
    ).select_related('student', 'digital_pass').order_by('-verification_time')[:10]
    
    # Get approved guest requests for today (guests expected or currently visiting)
    approved_guests = GuestRequest.objects.filter(
        status='approved',
        start_date__lte=now,
        end_date__gte=now
    ).select_related('student', 'approved_by').order_by('start_date')
    
    # Get upcoming guests (arriving within next 24 hours)
    tomorrow = now + timezone.timedelta(days=1)
    upcoming_guests = GuestRequest.objects.filter(
        status='approved',
        start_date__gt=now,
        start_date__lte=tomorrow
    ).select_related('student', 'approved_by').order_by('start_date')
    
    # Active guests count
    active_guests_count = approved_guests.count()
    
    context = {
        'staff': security_staff,
        'active_passes_count': active_passes_count,
        'students_away_count': students_away_count,
        'recent_verifications': recent_verifications,
        'today': today,
        'approved_guests': approved_guests,
        'upcoming_guests': upcoming_guests,
        'active_guests_count': active_guests_count,
    }
    
    return render(request, 'security/dashboard.html', context)


def active_passes_view(request):
    """
    Render the active passes page with formatted HTML view.
    Shows all currently active digital passes for security verification.
    """
    today = timezone.now().date()
    
    # Get all active passes
    active_passes = DigitalPass.objects.filter(
        status='active',
        from_date__lte=today,
        to_date__gte=today
    ).select_related('student').order_by('student__name')
    
    # Calculate stats
    expiring_today = sum(1 for p in active_passes if p.to_date == today)
    long_leaves = sum(1 for p in active_passes if p.total_days >= 7)
    
    context = {
        'active_passes': active_passes,
        'today': today,
        'expiring_today': expiring_today,
        'long_leaves': long_leaves,
    }
    
    return render(request, 'security/active_passes.html', context)

def maintenance_dashboard(request):
    """
    Render the maintenance staff dashboard.
    Provides maintenance request management and work order tracking.
    """
    # Get maintenance staff member from session
    maintenance_staff = None
    if hasattr(request.user, 'user_object') and request.user.user_object:
        maintenance_staff = request.user.user_object
    else:
        # Try to get from session
        user_id = request.session.get('user_id')
        if user_id:
            try:
                maintenance_staff = Staff.objects.get(staff_id=user_id)
            except Staff.DoesNotExist:
                pass
    
    # Get maintenance statistics
    pending_requests = MaintenanceRequest.objects.filter(status='pending').count()
    in_progress_requests = MaintenanceRequest.objects.filter(status='in_progress').count()
    completed_today = MaintenanceRequest.objects.filter(
        status='completed',
        actual_completion__date=timezone.now().date()
    ).count()
    
    # Get requests assigned to this staff member (if any)
    assigned_requests = []
    if maintenance_staff:
        assigned_requests = MaintenanceRequest.objects.filter(
            assigned_to=maintenance_staff,
            status__in=['assigned', 'in_progress']
        ).select_related('student').order_by('-created_at')
    
    # Get all pending maintenance requests
    all_pending_requests = MaintenanceRequest.objects.filter(
        status='pending'
    ).select_related('student').order_by('-created_at')[:20]
    
    # Get high priority requests
    high_priority_requests = MaintenanceRequest.objects.filter(
        priority__in=['high', 'emergency'],
        status__in=['pending', 'assigned', 'in_progress']
    ).select_related('student').order_by('-created_at')
    
    context = {
        'staff': maintenance_staff,
        'pending_requests': pending_requests,
        'in_progress_requests': in_progress_requests,
        'completed_today': completed_today,
        'assigned_requests': assigned_requests,
        'all_pending_requests': all_pending_requests,
        'high_priority_requests': high_priority_requests,
    }
    
    return render(request, 'maintenance/dashboard.html', context)


def staff_query_interface(request):
    """
    Render the staff query interface for natural language queries.
    Provides a dedicated interface for staff to ask questions about hostel data.
    """
    # Get staff member from request or use dev staff
    staff_member = get_staff_from_request_or_dev(request)
    
    context = {
        'staff': staff_member,
    }
    
    return render(request, 'staff/query_interface.html', context)


@api_view(['POST'])
@permission_classes([AllowAny])  # In production, require authentication
def activate_emergency_mode(request):
    """
    Activate emergency mode and send alerts to all wardens and security staff.
    Sends SMS (if configured) and email notifications.
    """
    try:
        from .services.notification_service import notification_service, NotificationMethod, NotificationPriority
        from .models import AuditLog
        
        # Get emergency details from request
        emergency_type = request.data.get('emergency_type', 'general_emergency')
        description = request.data.get('description', 'Emergency mode activated from security dashboard')
        activated_by = request.data.get('activated_by', 'Security Personnel')
        
        # Validate emergency type
        valid_types = ['fire', 'security_breach', 'medical', 'natural_disaster', 'lockdown', 'general_emergency']
        if emergency_type not in valid_types:
            emergency_type = 'general_emergency'
        
        # Format emergency message
        emergency_labels = {
            'fire': '🔥 FIRE EMERGENCY',
            'security_breach': ' SECURITY BREACH',
            'medical': ' MEDICAL EMERGENCY',
            'natural_disaster': 'NATURAL DISASTER',
            'lockdown': ' CAMPUS LOCKDOWN',
            'general_emergency': '🚨 EMERGENCY ALERT'
        }
        
        alert_title = emergency_labels.get(emergency_type, '🚨 EMERGENCY ALERT')
        
        message = f"""
{alert_title}

Location: Hostel Campus
Time: {timezone.now().strftime('%d %b %Y, %H:%M')}
Activated By: {activated_by}

Details: {description}

IMMEDIATE ACTION REQUIRED!
Please respond to security desk immediately or call emergency line.

This is an automated alert from the Hostel Security System.
        """.strip()
        
        # Send notifications
        delivery_results = {
            'sms': {'sent': 0, 'failed': 0, 'recipients': []},
            'email': {'sent': 0, 'failed': 0, 'recipients': []}
        }
        
        # Get all wardens and security staff
        target_staff = Staff.objects.filter(
            is_active=True,
            role__in=['warden', 'security', 'admin']
        )
        
        sms_configured = bool(getattr(settings, 'TWILIO_ACCOUNT_SID', ''))
        
        for staff_member in target_staff:
            # Try SMS first (for urgent alerts)
            if sms_configured and staff_member.phone:
                try:
                    sms_result = notification_service._send_sms(
                        recipient=staff_member,
                        subject=alert_title,
                        content=message,
                        timestamp=timezone.now()
                    )
                    if sms_result.success:
                        delivery_results['sms']['sent'] += 1
                        delivery_results['sms']['recipients'].append(staff_member.name)
                    else:
                        delivery_results['sms']['failed'] += 1
                except Exception as e:
                    logger.error(f"SMS failed to {staff_member.name}: {e}")
                    delivery_results['sms']['failed'] += 1
            
            # Always send email as backup
            if staff_member.email:
                try:
                    email_result = notification_service._send_email(
                        recipient=staff_member,
                        subject=f"🚨 URGENT: {alert_title} - Immediate Action Required",
                        content=message,
                        timestamp=timezone.now()
                    )
                    if email_result.success:
                        delivery_results['email']['sent'] += 1
                        delivery_results['email']['recipients'].append(staff_member.name)
                    else:
                        delivery_results['email']['failed'] += 1
                except Exception as e:
                    logger.error(f"Email failed to {staff_member.name}: {e}")
                    delivery_results['email']['failed'] += 1
        
        # Log the emergency activation
        try:
            AuditLog.objects.create(
                action_type='emergency_mode_activated',
                description=f"Emergency Mode ({emergency_type}) activated by {activated_by}: {description}",
                performed_by=activated_by,
                ip_address=request.META.get('REMOTE_ADDR', 'unknown')
            )
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
        
        # Prepare response
        total_sms = delivery_results['sms']['sent'] + delivery_results['sms']['failed']
        total_email = delivery_results['email']['sent'] + delivery_results['email']['failed']
        
        return Response({
            'success': True,
            'message': 'Emergency mode activated successfully',
            'emergency_type': emergency_type,
            'alert_title': alert_title,
            'notifications': {
                'sms': {
                    'configured': sms_configured,
                    'sent': delivery_results['sms']['sent'],
                    'failed': delivery_results['sms']['failed'],
                    'recipients': delivery_results['sms']['recipients']
                },
                'email': {
                    'sent': delivery_results['email']['sent'],
                    'failed': delivery_results['email']['failed'],
                    'recipients': delivery_results['email']['recipients']
                }
            },
            'summary': f"Alerts sent: {delivery_results['sms']['sent']} SMS, {delivery_results['email']['sent']} emails"
        })
        
    except Exception as e:
        logger.error(f"Error activating emergency mode: {e}")
        return Response({
            'success': False,
            'error': f'Failed to activate emergency mode: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== MAINTENANCE MANAGEMENT APIs ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def accept_maintenance_task(request):
    """
    Accept a pending maintenance task and assign it to the current staff member.
    """
    try:
        request_id = request.data.get('request_id')
        if not request_id:
            return Response({
                'success': False,
                'error': 'request_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the maintenance staff member from session
        user_object, auth_type = get_user_from_request(request)
        if not user_object or not isinstance(user_object, Staff):
            return Response({
                'success': False,
                'error': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Find the maintenance request
        try:
            maintenance_request = MaintenanceRequest.objects.get(request_id=request_id)
        except MaintenanceRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Maintenance request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if maintenance_request.status != 'pending':
            return Response({
                'success': False,
                'error': f'Cannot accept task with status: {maintenance_request.status}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Assign the task to the staff member
        maintenance_request.assigned_to = user_object
        maintenance_request.status = 'assigned'
        maintenance_request.save()
        
        # Log the action
        AuditLog.objects.create(
            action_type='maintenance_approval',
            entity_type='maintenance_request',
            entity_id=str(request_id),
            decision='processed',
            reasoning=f'Maintenance task accepted by {user_object.name}',
            confidence_score=1.0,
            rules_applied=['manual_acceptance'],
            user_id=user_object.staff_id,
            user_type='staff',
            metadata={'action': 'task_accepted', 'ip_address': request.META.get('REMOTE_ADDR', 'unknown')}
        )
        
        logger.info(f"Maintenance task {request_id} accepted by {user_object.staff_id}")
        
        return Response({
            'success': True,
            'message': 'Task accepted successfully',
            'request_id': str(request_id),
            'assigned_to': user_object.name,
            'status': 'assigned'
        })
        
    except Exception as e:
        logger.error(f"Error accepting maintenance task: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def update_maintenance_status(request):
    """
    Update the status of a maintenance request and notify warden.
    Statuses: assigned -> in_progress -> completed
    """
    try:
        request_id = request.data.get('request_id')
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')
        
        if not request_id or not new_status:
            return Response({
                'success': False,
                'error': 'request_id and status are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        valid_statuses = ['in_progress', 'completed', 'cancelled']
        if new_status not in valid_statuses:
            return Response({
                'success': False,
                'error': f'Invalid status. Valid options: {valid_statuses}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the maintenance staff member from session
        user_object, auth_type = get_user_from_request(request)
        if not user_object or not isinstance(user_object, Staff):
            return Response({
                'success': False,
                'error': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Find the maintenance request
        try:
            maintenance_request = MaintenanceRequest.objects.get(request_id=request_id)
        except MaintenanceRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Maintenance request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        old_status = maintenance_request.status
        
        # Validate status transition
        valid_transitions = {
            'pending': ['assigned', 'cancelled'],
            'assigned': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': []
        }
        
        if new_status not in valid_transitions.get(old_status, []):
            return Response({
                'success': False,
                'error': f'Cannot transition from {old_status} to {new_status}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update the request
        maintenance_request.status = new_status
        if notes:
            maintenance_request.notes = notes
        
        if new_status == 'completed':
            maintenance_request.actual_completion = timezone.now()
        
        maintenance_request.save()
        
        # Log the action
        AuditLog.objects.create(
            action_type='maintenance_approval',
            entity_type='maintenance_request',
            entity_id=str(request_id),
            decision='processed',
            reasoning=f'Status changed from {old_status} to {new_status} by {user_object.name}',
            confidence_score=1.0,
            rules_applied=['manual_status_update'],
            user_id=user_object.staff_id,
            user_type='staff',
            metadata={'action': 'status_updated', 'old_status': old_status, 'new_status': new_status, 'ip_address': request.META.get('REMOTE_ADDR', 'unknown')}
        )
        
        # Notify warden if task is completed or priority is high/emergency
        if new_status == 'completed' or maintenance_request.priority in ['high', 'emergency']:
            _notify_warden_maintenance_update(maintenance_request, old_status, new_status, user_object)
        
        logger.info(f"Maintenance task {request_id} status updated to {new_status} by {user_object.staff_id}")
        
        return Response({
            'success': True,
            'message': f'Task status updated to {new_status}',
            'request_id': str(request_id),
            'old_status': old_status,
            'new_status': new_status,
            'updated_by': user_object.name
        })
        
    except Exception as e:
        logger.error(f"Error updating maintenance status: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_maintenance_stats(request):
    """
    Get maintenance statistics for warden dashboard.
    Shows pending, in-progress, completed tasks and staff performance.
    """
    try:
        # Get date range (default last 30 days)
        days = int(request.GET.get('days', 30))
        start_date = timezone.now() - timezone.timedelta(days=days)
        
        # Overall statistics
        pending_count = MaintenanceRequest.objects.filter(status='pending').count()
        assigned_count = MaintenanceRequest.objects.filter(status='assigned').count()
        in_progress_count = MaintenanceRequest.objects.filter(status='in_progress').count()
        completed_count = MaintenanceRequest.objects.filter(
            status='completed',
            actual_completion__gte=start_date
        ).count()
        
        # Today's statistics
        today = timezone.now().date()
        completed_today = MaintenanceRequest.objects.filter(
            status='completed',
            actual_completion__date=today
        ).count()
        
        new_today = MaintenanceRequest.objects.filter(
            created_at__date=today
        ).count()
        
        # Priority breakdown
        priority_stats = {
            'emergency': MaintenanceRequest.objects.filter(
                priority='emergency',
                status__in=['pending', 'assigned', 'in_progress']
            ).count(),
            'high': MaintenanceRequest.objects.filter(
                priority='high',
                status__in=['pending', 'assigned', 'in_progress']
            ).count(),
            'medium': MaintenanceRequest.objects.filter(
                priority='medium',
                status__in=['pending', 'assigned', 'in_progress']
            ).count(),
            'low': MaintenanceRequest.objects.filter(
                priority='low',
                status__in=['pending', 'assigned', 'in_progress']
            ).count()
        }
        
        # Issue type breakdown
        issue_types = ['electrical', 'plumbing', 'hvac', 'furniture', 'cleaning', 'other']
        issue_type_stats = {}
        for issue_type in issue_types:
            issue_type_stats[issue_type] = MaintenanceRequest.objects.filter(
                issue_type=issue_type,
                status__in=['pending', 'assigned', 'in_progress']
            ).count()
        
        # Staff performance (completed tasks in date range)
        staff_performance = []
        maintenance_staff = Staff.objects.filter(role='maintenance', is_active=True)
        for staff in maintenance_staff:
            completed_by_staff = MaintenanceRequest.objects.filter(
                assigned_to=staff,
                status='completed',
                actual_completion__gte=start_date
            ).count()
            
            in_progress_by_staff = MaintenanceRequest.objects.filter(
                assigned_to=staff,
                status__in=['assigned', 'in_progress']
            ).count()
            
            staff_performance.append({
                'staff_id': staff.staff_id,
                'name': staff.name,
                'completed': completed_by_staff,
                'in_progress': in_progress_by_staff
            })
        
        # Average resolution time (for completed tasks)
        from django.db.models import Avg, F
        completed_requests = MaintenanceRequest.objects.filter(
            status='completed',
            actual_completion__isnull=False,
            actual_completion__gte=start_date
        )
        
        avg_resolution_hours = 0
        if completed_requests.exists():
            total_hours = 0
            count = 0
            for req in completed_requests:
                delta = req.actual_completion - req.created_at
                total_hours += delta.total_seconds() / 3600
                count += 1
            if count > 0:
                avg_resolution_hours = round(total_hours / count, 1)
        
        return Response({
            'success': True,
            'period_days': days,
            'overview': {
                'pending': pending_count,
                'assigned': assigned_count,
                'in_progress': in_progress_count,
                'completed': completed_count,
                'total_active': pending_count + assigned_count + in_progress_count
            },
            'today': {
                'new_requests': new_today,
                'completed': completed_today
            },
            'priority_breakdown': priority_stats,
            'issue_type_breakdown': issue_type_stats,
            'staff_performance': staff_performance,
            'average_resolution_hours': avg_resolution_hours
        })
        
    except Exception as e:
        logger.error(f"Error getting maintenance stats: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_maintenance_history(request):
    """
    Get maintenance request history with filtering options.
    """
    try:
        # Get query parameters
        status_filter = request.GET.get('status', None)
        priority_filter = request.GET.get('priority', None)
        issue_type_filter = request.GET.get('issue_type', None)
        days = int(request.GET.get('days', 30))
        limit = int(request.GET.get('limit', 50))
        
        start_date = timezone.now() - timezone.timedelta(days=days)
        
        # Build query
        queryset = MaintenanceRequest.objects.filter(
            created_at__gte=start_date
        ).select_related('student', 'assigned_to').order_by('-created_at')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if issue_type_filter:
            queryset = queryset.filter(issue_type=issue_type_filter)
        
        queryset = queryset[:limit]
        
        # Format response
        requests_list = []
        for req in queryset:
            requests_list.append({
                'request_id': str(req.request_id),
                'room_number': req.room_number,
                'issue_type': req.issue_type,
                'priority': req.priority,
                'status': req.status,
                'description': req.description,
                'student': {
                    'name': req.student.name,
                    'student_id': req.student.student_id,
                    'block': req.student.block
                },
                'assigned_to': req.assigned_to.name if req.assigned_to else None,
                'created_at': req.created_at.isoformat(),
                'actual_completion': req.actual_completion.isoformat() if req.actual_completion else None,
                'notes': req.notes,
                'is_overdue': req.is_overdue,
                'days_pending': req.days_pending
            })
        
        return Response({
            'success': True,
            'count': len(requests_list),
            'requests': requests_list
        })
        
    except Exception as e:
        logger.error(f"Error getting maintenance history: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _notify_warden_maintenance_update(maintenance_request, old_status, new_status, updated_by):
    """
    Send notification to warden about maintenance task status update.
    """
    try:
        from .services.notification_service import notification_service, NotificationPriority
        
        # Determine priority based on task priority
        if maintenance_request.priority in ['emergency', 'high']:
            notification_priority = NotificationPriority.HIGH
        else:
            notification_priority = NotificationPriority.MEDIUM
        
        # Build notification message
        status_emoji = {
            'in_progress': '🔧',
            'completed': '✅',
            'cancelled': '❌'
        }
        
        emoji = status_emoji.get(new_status, '📋')
        
        message_parts = [
            f"{emoji} MAINTENANCE STATUS UPDATE",
            f"=" * 50,
            f"",
            f"Task ID: {maintenance_request.request_id}",
            f"Room: {maintenance_request.room_number} (Block {maintenance_request.student.block})",
            f"Issue Type: {maintenance_request.issue_type.title()}",
            f"Priority: {maintenance_request.priority.upper()}",
            f"",
            f"Status Change: {old_status.upper()} → {new_status.upper()}",
            f"Updated By: {updated_by.name}",
            f"Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"",
            f"Description: {maintenance_request.description[:100]}...",
        ]
        
        if maintenance_request.notes:
            message_parts.extend([
                f"",
                f"Staff Notes: {maintenance_request.notes}"
            ])
        
        if new_status == 'completed':
            # Calculate resolution time
            if maintenance_request.actual_completion:
                delta = maintenance_request.actual_completion - maintenance_request.created_at
                hours = delta.total_seconds() / 3600
                message_parts.extend([
                    f"",
                    f"Resolution Time: {hours:.1f} hours"
                ])
        
        message = "\n".join(message_parts)
        
        # Send to wardens
        notification_service.deliver_urgent_alert(
            alert_type=f"maintenance_{new_status}",
            message=message,
            priority=notification_priority,
            target_roles=['warden', 'admin']
        )
        
        logger.info(f"Warden notified about maintenance task {maintenance_request.request_id} status update")
        
    except Exception as e:
        logger.error(f"Failed to notify warden about maintenance update: {e}")