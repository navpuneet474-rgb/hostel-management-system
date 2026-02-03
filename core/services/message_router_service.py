"""
Message Router Service for request routing and conversation management.
Handles message classification, routing logic, and conversation context management.
"""

import logging
import re
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from django.utils import timezone
from dateutil import parser as date_parser
from ..models import Student, Staff, Message, AuditLog, GuestRequest, AbsenceRecord, MaintenanceRequest, ConversationContext as DBConversationContext
from .ai_engine_service import ai_engine_service, IntentResult
from .auto_approval_service import auto_approval_engine, AutoApprovalResult
from .dashboard_service import dashboard_service
from .followup_bot_service import followup_bot_service
from .gemini_service import gemini_service

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """Types of messages that can be processed."""
    STUDENT_REQUEST = "student_request"
    STAFF_QUERY = "staff_query"
    FOLLOW_UP = "follow_up"
    CLARIFICATION = "clarification"
    SYSTEM_NOTIFICATION = "system_notification"


class ProcessingStatus(Enum):
    """Status of message processing."""
    SUCCESS = "success"
    REQUIRES_CLARIFICATION = "requires_clarification"
    ESCALATED = "escalated"
    FAILED = "failed"
    REJECTED = "rejected"


@dataclass
class ConversationContext:
    """Context information for ongoing conversations."""
    user_id: str
    user_type: str  # 'student' or 'staff'
    conversation_id: str
    last_message_id: str
    intent_history: List[Dict[str, Any]]
    pending_clarifications: List[str]
    context_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'user_id': self.user_id,
            'user_type': self.user_type,
            'conversation_id': self.conversation_id,
            'last_message_id': self.last_message_id,
            'intent_history': self.intent_history,
            'pending_clarifications': self.pending_clarifications,
            'context_data': self.context_data,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


@dataclass
class ProcessingResult:
    """Result of message processing."""
    status: ProcessingStatus
    response_message: str
    confidence: float
    intent_result: Optional[IntentResult]
    approval_result: Optional[AutoApprovalResult]
    conversation_context: Optional[ConversationContext]
    requires_follow_up: bool
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'status': self.status.value,
            'response_message': self.response_message,
            'confidence': self.confidence,
            'intent_result': self.intent_result.to_dict() if self.intent_result else None,
            'approval_result': self.approval_result.to_dict() if self.approval_result else None,
            'conversation_context': self.conversation_context.to_dict() if self.conversation_context else None,
            'requires_follow_up': self.requires_follow_up,
            'metadata': self.metadata
        }


@dataclass
class Response:
    """Response to be sent back to the user."""
    message: str
    message_type: str  # 'confirmation', 'clarification', 'error', 'information'
    requires_action: bool
    action_type: Optional[str]  # 'provide_info', 'contact_staff', 'wait_for_approval'
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'message': self.message,
            'message_type': self.message_type,
            'requires_action': self.requires_action,
            'action_type': self.action_type,
            'metadata': self.metadata
        }


class MessageRouter:
    """
    Core Message Router for request routing and conversation management.
    Handles message classification, routing logic, and conversation context.
    """
    
    # Conversation context storage (in production, use Redis or database)
    _conversation_contexts: Dict[str, ConversationContext] = {}
    
    # Context timeout (24 hours)
    CONTEXT_TIMEOUT_HOURS = 24
    
    def __init__(self):
        """Initialize the Message Router."""
        self.ai_engine = ai_engine_service
        self.gemini_service = gemini_service
        self.auto_approval_engine = auto_approval_engine
        self.followup_bot = followup_bot_service
        logger.info("Message Router initialized")
    
    def route_message(self, message: Message) -> ProcessingResult:
        """
        Route a message through the appropriate processing pipeline.
        
        Args:
            message: Message object to process
            
        Returns:
            ProcessingResult with processing outcome
        """
        try:
            # Update message status
            message.status = 'processing'
            message.save()
            
            # Determine message type and get context
            message_type = self._classify_message_type(message)
            context = self.manage_conversation_context(message.sender.student_id)
            
            # Route based on message type
            if message_type == MessageType.STUDENT_REQUEST:
                result = self.handle_student_message(message, context)
            elif message_type == MessageType.FOLLOW_UP:
                result = self._handle_follow_up_message(message, context)
            elif message_type == MessageType.CLARIFICATION:
                result = self._handle_clarification_message(message, context)
            else:
                result = self._handle_unknown_message(message, context)
            
            # Update message with results
            message.processed = True
            message.confidence_score = result.confidence
            message.extracted_intent = result.intent_result.to_dict() if result.intent_result else None
            
            # Set message status based on processing result
            if result.status in [ProcessingStatus.SUCCESS, ProcessingStatus.ESCALATED, ProcessingStatus.REQUIRES_CLARIFICATION]:
                message.status = 'processed'
            else:
                message.status = 'failed'
            
            message.save()
            
            # Persist conversation context to database
            if context:
                self._persist_conversation_context(context)
            
            # Log the processing
            self._log_message_processing(message, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error routing message {message.message_id}: {e}")
            message.status = 'failed'
            message.save()
            
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I'm sorry, there was an error processing your message. Please try again or contact staff for assistance.",
                confidence=0.0,
                intent_result=None,
                approval_result=None,
                conversation_context=None,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    @staticmethod
    def _validate_guest_name(guest_name: str) -> bool:
        """
        Validate that guest_name is not a blacklisted word.
        Filters out common request words that should not be extracted as names.
        
        Args:
            guest_name: The extracted guest name to validate
            
        Returns:
            True if valid person name, False if blacklisted word
        """
        if not guest_name:
            return True  # None/empty is valid, will trigger clarification
        
        # Blacklist of words that should NOT be guest names
        blacklist = {
            'permission', 'request', 'guest', 'friend', 'visitor', 'visitors',
            'allow', 'allowed', 'visit', 'visiting', 'stay', 'staying',
            'approve', 'approved', 'approval', 'want', 'need', 'have',
            'coming', 'please', 'can', 'will', 'someone', 'person', 'name',
            'people', 'anyone', 'anybody', 'person', 'human'
        }
        
        # Check if guest_name (case-insensitive) is in blacklist
        if guest_name.lower() in blacklist:
            logger.warning(f"Guest name '{guest_name}' is a blacklisted word, treating as invalid")
            return False
        
        return True
    
    @staticmethod
    def _parse_natural_date(date_str: str) -> Optional[str]:
        """
        Parse natural language date strings (e.g., "tomorrow", "this weekend") to YYYY-MM-DD format.
        
        Args:
            date_str: Date string (can be natural language or ISO format)
            
        Returns:
            Date in YYYY-MM-DD format, or None if parsing fails
        """
        if not date_str:
            return None
        
        from datetime import datetime, timedelta
        
        date_lower = date_str.lower().strip()
        today = datetime.now().date()
        
        try:
            # Check for common natural language dates
            if date_lower == 'today':
                return today.isoformat()
            elif date_lower == 'tomorrow':
                return (today + timedelta(days=1)).isoformat()
            elif date_lower == 'next monday':
                days_ahead = 0 - today.weekday()  # Monday is 0
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next tuesday':
                days_ahead = 1 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next wednesday':
                days_ahead = 2 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next thursday':
                days_ahead = 3 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next friday':
                days_ahead = 4 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next saturday' or date_lower == 'this saturday':
                days_ahead = 5 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next sunday' or date_lower == 'this sunday':
                days_ahead = 6 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'this weekend':
                # Default to Saturday of this weekend
                days_ahead = 5 - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).isoformat()
            elif date_lower == 'next week':
                return (today + timedelta(days=7)).isoformat()
            elif date_lower == 'in 2 days' or date_lower == 'after tomorrow':
                return (today + timedelta(days=2)).isoformat()
            elif date_lower == 'in 3 days':
                return (today + timedelta(days=3)).isoformat()
            
            # Try to parse using dateutil for standard formats
            from dateutil import parser as date_parser
            parsed = date_parser.parse(date_str)
            return parsed.strftime('%Y-%m-%d')
            
        except Exception as e:
            logger.debug(f"Could not parse natural date '{date_str}': {e}")
            return None

    
    def handle_student_message(self, message: Message, context: ConversationContext = None) -> ProcessingResult:
        """
        Handle a message from a student.
        
        Args:
            message: Student message to process
            context: Existing conversation context
            
        Returns:
            ProcessingResult with processing outcome
        """
        try:
            # Extract intent using AI engine
            user_context = self._build_user_context(message.sender, context)
            intent_result = self.ai_engine.extract_intent(message.content, user_context)
            
            # Update conversation context
            if context:
                context.intent_history.append(intent_result.to_dict())
                context.last_message_id = str(message.message_id)
                context.updated_at = timezone.now()
            
            # Check if clarification is needed
            if intent_result.requires_clarification:
                return self._handle_clarification_needed(intent_result, message, context)
            
            # Process the request based on intent
            if intent_result.intent in ['guest_request', 'leave_request', 'maintenance_request', 'room_cleaning']:
                return self._process_actionable_request(intent_result, message, context)
            elif intent_result.intent == 'rule_inquiry':
                return self._process_rule_inquiry(intent_result, message, context)
            elif intent_result.intent == 'general_query':
                return self._process_general_query(intent_result, message, context)
            else:
                return self._handle_unknown_intent(intent_result, message, context)
                
        except Exception as e:
            logger.error(f"Error handling student message: {e}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I encountered an error processing your request. Please try again.",
                confidence=0.0,
                intent_result=None,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    def handle_staff_query(self, query: str, staff: Staff) -> Dict[str, Any]:
        """
        Handle a query from staff members using AI-driven intent routing (NO HARDCODING).
        
        Args:
            query: Natural language query from staff
            staff: Staff member making the query
            
        Returns:
            QueryResult with response information
        """
        try:
            # Process the query using AI engine to understand intent
            user_context = {
                'staff_id': staff.staff_id,
                'staff_role': staff.role,
                'permissions': staff.permissions
            }
            
            # Extract staff query intent using Gemini AI (NOT keyword matching!)
            staff_intent_result = self.gemini_service.extract_staff_query_intent(query, user_context)
            
            # Get the detected intent
            staff_query_intent = staff_intent_result.get('staff_query_intent', 'unknown')
            confidence = staff_intent_result.get('confidence', 0.0)
            parameters = staff_intent_result.get('parameters', {})
            
            logger.info(f"Staff query intent detected: {staff_query_intent} (confidence: {confidence:.2f})")
            
            # Define handler mapping - maps AI-detected intents to handler methods
            handler_map = {
                'count_present_students': self._handle_count_present_students,
                'list_present_students': self._handle_list_present_students,
                'count_absent_students': self._handle_count_absent_students,
                'list_absent_students': self._handle_list_absent_students,
                'count_pending_requests': self._handle_count_pending_requests,
                'list_pending_requests': self._handle_list_pending_requests,
                'count_active_guests': self._handle_count_active_guests,
                'list_active_guests': self._handle_list_active_guests,
                'room_status': self._handle_room_status_query,
                'delete_request': self._handle_delete_query,
                'daily_summary': self._handle_summary_query,
                'general_query': self._handle_general_staff_query,
            }
            
            # Special handling for cancel/confirm delete (exact match, not intent-based)
            query_lower = query.lower().strip()
            if query_lower == 'cancel' or len(query_lower) < 20 and 'cancel' in query_lower:
                return self._handle_delete_cancellation(query, staff, None)
            elif 'confirm delete' in query_lower:
                return self._handle_delete_confirmation(query, staff, None)
            
            # Get the appropriate handler based on intent
            handler = handler_map.get(staff_query_intent, self._handle_general_staff_query)
            
            # Call the handler with intent parameters
            return handler(query, staff, parameters)
            
        except Exception as e:
            logger.error(f"Error handling staff query: {e}")
            return {
                'status': 'error',
                'response': f"I encountered an error processing your query. Please try rephrasing or contact technical support.",
                'query_type': 'error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    # NEW: Intent-based handler methods (replaces keyword matching)
    
    # REMOVED: Duplicate handlers (kept newer versions below)
    
    def _handle_count_present_students(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'count present students' intent."""
        try:
            stats = dashboard_service.get_statistics(force_refresh=True)
            count = stats['present_students']
            return {
                'status': 'success',
                'response': f"Currently {count} students are present in the hostel.",
                'query_type': 'count_present_students',
                'results': [{'count': count, 'type': 'present_students'}],
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error counting present students: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while counting present students. Please try again.",
                'query_type': 'count_present_students',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_list_present_students(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'list present students' intent."""
        try:
            # Get absent students via ForeignKey relationship (not direct student_id)
            absent_students = AbsenceRecord.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).values_list('student__student_id', flat=True)
            
            present_students = Student.objects.exclude(
                student_id__in=absent_students
            ).order_by('room_number')[:100]
            
            if present_students.exists():
                student_list = [f"{student.name} (Room {student.room_number})" for student in present_students]
                response = f"Currently present students ({present_students.count()} total): {', '.join(student_list)}"
                results = [{
                    'student_name': student.name,
                    'student_id': student.student_id,
                    'room_number': student.room_number
                } for student in present_students]
            else:
                response = "No students are currently present in the hostel."
                results = []
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'list_present_students',
                'results': results,
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error listing present students: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while retrieving present students. Please try again.",
                'query_type': 'list_present_students',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_count_absent_students(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'count absent students' intent."""
        try:
            count = AbsenceRecord.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).count()
            return {
                'status': 'success',
                'response': f"Currently {count} students are absent from the hostel.",
                'query_type': 'count_absent_students',
                'results': [{'count': count, 'type': 'absent_students'}],
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error counting absent students: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while counting absent students. Please try again.",
                'query_type': 'count_absent_students',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_list_absent_students(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'list absent students' intent."""
        try:
            absent_students = AbsenceRecord.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).select_related('student')[:20]
            
            if absent_students.exists():
                student_list = [f"{abs_rec.student.name} (Room {abs_rec.student.room_number}, until {abs_rec.end_date.strftime('%m/%d')})" 
                              for abs_rec in absent_students]
                response = f"Currently absent students: {', '.join(student_list)}"
                results = [{
                    'student_name': abs_rec.student.name,
                    'room_number': abs_rec.student.room_number,
                    'return_date': abs_rec.end_date.isoformat()
                } for abs_rec in absent_students]
            else:
                response = "No students are currently absent."
                results = []
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'list_absent_students',
                'results': results,
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error listing absent students: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while retrieving absent students. Please try again.",
                'query_type': 'list_absent_students',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_count_pending_requests(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'count pending requests' intent."""
        try:
            guest_count = GuestRequest.objects.filter(status='pending').count()
            absence_count = AbsenceRecord.objects.filter(status='pending').count()
            maintenance_count = MaintenanceRequest.objects.filter(status='pending').count()
            total_count = guest_count + absence_count + maintenance_count
            
            return {
                'status': 'success',
                'response': f"There are {total_count} pending requests: {guest_count} guest requests, {absence_count} leave requests, and {maintenance_count} maintenance requests.",
                'query_type': 'count_pending_requests',
                'results': [
                    {'count': guest_count, 'type': 'pending_guest_requests'},
                    {'count': absence_count, 'type': 'pending_absence_requests'},
                    {'count': maintenance_count, 'type': 'pending_maintenance_requests'},
                    {'count': total_count, 'type': 'total_pending'}
                ],
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error counting pending requests: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while counting pending requests. Please try again.",
                'query_type': 'count_pending_requests',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_list_pending_requests(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'list pending requests' intent."""
        try:
            guest_requests = GuestRequest.objects.filter(status='pending').order_by('-created_at')[:10]
            absence_requests = AbsenceRecord.objects.filter(status='pending').order_by('-created_at')[:10]
            maintenance_requests = MaintenanceRequest.objects.filter(status='pending').order_by('-created_at')[:10]
            
            response_parts = []
            results = []
            
            if guest_requests.exists():
                guest_list = [f"{req.guest_name} (Student: {req.student.name})" for req in guest_requests]
                response_parts.append(f"Pending guest requests: {', '.join(guest_list)}")
                results.extend([{
                    'type': 'guest_request',
                    'guest_name': req.guest_name,
                    'student_name': req.student.name,
                    'created_at': req.created_at.isoformat()
                } for req in guest_requests])
            
            if absence_requests.exists():
                absence_list = [f"{req.student.name} ({req.start_date.strftime('%m/%d')} - {req.end_date.strftime('%m/%d')})" for req in absence_requests]
                response_parts.append(f"Pending leave requests: {', '.join(absence_list)}")
                results.extend([{
                    'type': 'absence_request',
                    'student_name': req.student.name,
                    'start_date': req.start_date.isoformat(),
                    'end_date': req.end_date.isoformat()
                } for req in absence_requests])
            
            if maintenance_requests.exists():
                maintenance_list = [f"Room {req.room_number} ({req.issue_type})" for req in maintenance_requests]
                response_parts.append(f"Pending maintenance: {', '.join(maintenance_list)}")
                results.extend([{
                    'type': 'maintenance_request',
                    'room_number': req.room_number,
                    'issue_type': req.issue_type,
                    'priority': req.priority
                } for req in maintenance_requests])
            
            response = ". ".join(response_parts) if response_parts else "No pending requests found."
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'list_pending_requests',
                'results': results,
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error listing pending requests: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while retrieving pending requests. Please try again.",
                'query_type': 'list_pending_requests',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_count_active_guests(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'count active guests' intent."""
        try:
            count = GuestRequest.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).count()
            return {
                'status': 'success',
                'response': f"Currently {count} guests are staying in the hostel.",
                'query_type': 'count_active_guests',
                'results': [{'count': count, 'type': 'active_guests'}],
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error counting active guests: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while counting active guests. Please try again.",
                'query_type': 'count_active_guests',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_list_active_guests(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'list active guests' intent."""
        try:
            active_guests = GuestRequest.objects.filter(
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).select_related('student')[:20]
            
            if active_guests.exists():
                guest_list = [f"{guest.guest_name} (Host: {guest.student.name}, Room {guest.student.room_number})" 
                            for guest in active_guests]
                response = f"Currently active guests: {', '.join(guest_list)}"
                results = [{
                    'guest_name': guest.guest_name,
                    'host_name': guest.student.name,
                    'room_number': guest.student.room_number,
                    'checkout_date': guest.end_date.isoformat()
                } for guest in active_guests]
            else:
                response = "No guests are currently staying in the hostel."
                results = []
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'list_active_guests',
                'results': results,
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
        except Exception as e:
            logger.error(f"Error listing active guests: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while retrieving active guests. Please try again.",
                'query_type': 'list_active_guests',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_room_status_query(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle 'room status' intent."""
        try:
            room_number = parameters.get('room_number')
            
            if not room_number:
                return {
                    'status': 'success',
                    'response': "Please specify which room you'd like to check the status for.",
                    'query_type': 'room_status',
                    'results': [],
                    'metadata': {'staff_id': staff.staff_id}
                }
            
            try:
                student = Student.objects.get(room_number=room_number)
                
                absent = AbsenceRecord.objects.filter(
                    student=student,
                    status='approved',
                    start_date__lte=timezone.now(),
                    end_date__gte=timezone.now()
                ).exists()
                
                guests = GuestRequest.objects.filter(
                    student=student,
                    status='approved',
                    start_date__lte=timezone.now(),
                    end_date__gte=timezone.now()
                )
                
                maintenance = MaintenanceRequest.objects.filter(
                    room_number=room_number,
                    status__in=['pending', 'assigned', 'in_progress']
                )
                
                status_parts = []
                if absent:
                    status_parts.append("Student is currently absent")
                else:
                    status_parts.append("Student is present")
                
                if guests.exists():
                    guest_names = [g.guest_name for g in guests]
                    status_parts.append(f"Active guests: {', '.join(guest_names)}")
                
                if maintenance.exists():
                    status_parts.append(f"{maintenance.count()} pending maintenance issues")
                
                response = f"Room {room_number} ({student.name}): {'; '.join(status_parts)}"
                
                return {
                    'status': 'success',
                    'response': response,
                    'query_type': 'room_status',
                    'results': [{
                        'room_number': room_number,
                        'student_name': student.name,
                        'is_absent': absent,
                        'guest_count': guests.count(),
                        'maintenance_issues': maintenance.count()
                    }],
                    'metadata': {'staff_id': staff.staff_id, 'room_queried': room_number}
                }
                
            except Student.DoesNotExist:
                return {
                    'status': 'success',
                    'response': f"Room {room_number} is not assigned to any student.",
                    'query_type': 'room_status',
                    'results': [],
                    'metadata': {'staff_id': staff.staff_id, 'room_queried': room_number}
                }
        except Exception as e:
            logger.error(f"Error checking room status: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while checking room status. Please try again.",
                'query_type': 'room_status',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    # REMOVED: Old hardcoded _handle_count_query method
    # Now using intent-based routing with specific handlers:
    # _handle_count_present_students, _handle_count_absent_students, etc.
    
    # REMOVED: Old hardcoded _handle_status_query method
    # Now using intent-based routing with _handle_room_status_query
    
    # REMOVED: Old hardcoded _handle_list_query method
    # Now using intent-based routing with specific handlers:
    # _handle_list_present_students, _handle_list_absent_students, 
    # _handle_list_pending_requests, _handle_list_active_guests
    
    def _handle_summary_query(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle summary queries like 'Give me today's summary'"""
        try:
            from dataclasses import asdict
            from .daily_summary_service import daily_summary_generator
            
            # Generate daily summary
            summary_data = daily_summary_generator.generate_morning_summary(datetime.now())
            
            # Format response using correct attribute names
            response = f"Today's Summary: {summary_data.total_absent} students absent, " \
                      f"{summary_data.active_guests} active guests, " \
                      f"{summary_data.pending_maintenance} pending maintenance requests"
            
            if summary_data.urgent_items:
                response += f". Urgent items: {', '.join(summary_data.urgent_items)}"
            else:
                response += ". No urgent items."
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'daily_summary',
                'results': [asdict(summary_data)],
                'metadata': {'staff_id': staff.staff_id, 'timestamp': timezone.now().isoformat()}
            }
            
        except Exception as e:
            logger.error(f"Error in summary query: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while generating the summary. Please try again.",
                'query_type': 'summary_error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_delete_query(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle delete queries with conversational follow-up questions"""
        try:
            query_lower = query.lower()
            
            # Check if staff has permission to delete data
            if staff.role not in ['warden', 'admin']:
                return {
                    'status': 'error',
                    'response': "Access denied. Only wardens and administrators can delete student data.",
                    'query_type': 'delete_permission_denied',
                    'results': [],
                    'metadata': {'staff_id': staff.staff_id, 'permission_required': 'warden_or_admin'}
                }
            
            # Check if specific student ID or room number is mentioned
            import re
            student_id_match = re.search(r'(?:student\s+|id\s+)([A-Z0-9]+)', query_lower.upper())
            room_match = re.search(r'room\s+(\d+)', query_lower)
            
            if student_id_match or room_match:
                # Student specified, show details and ask for confirmation
                return self._handle_delete_with_student_details(query, staff, student_id_match, room_match)
            
            # No student specified, ask for student identification
            if 'student' in query_lower:
                response = "I can help you delete student data. What is the student's name or student ID?"
                
                return {
                    'status': 'success',
                    'response': response,
                    'query_type': 'delete_ask_student_id',
                    'results': [],
                    'metadata': {
                        'staff_id': staff.staff_id,
                        'next_step': 'collect_student_id',
                        'delete_type': 'student_data'
                    }
                }
            
            elif 'request' in query_lower or 'record' in query_lower:
                response = "Which type of request would you like to delete? (guest request, leave request, or maintenance request)"
                
                return {
                    'status': 'success',
                    'response': response,
                    'query_type': 'delete_ask_request_type',
                    'results': [],
                    'metadata': {
                        'staff_id': staff.staff_id,
                        'next_step': 'collect_request_type',
                        'delete_type': 'request_data'
                    }
                }
            
            else:
                # General delete query - ask what they want to delete
                response = "What would you like to delete? Student data or specific requests?"
                
                return {
                    'status': 'success',
                    'response': response,
                    'query_type': 'delete_ask_type',
                    'results': [],
                    'metadata': {
                        'staff_id': staff.staff_id,
                        'next_step': 'collect_delete_type'
                    }
                }
                
        except Exception as e:
            logger.error(f"Error in delete query: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while processing your delete request. Please contact technical support.",
                'query_type': 'delete_error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_delete_with_student_details(self, query: str, staff: Staff, student_id_match, room_match) -> Dict[str, Any]:
        """Handle delete query when student is specified - show details and ask for confirmation"""
        try:
            from ..models import Student, GuestRequest, AbsenceRecord, MaintenanceRequest
            
            student = None
            
            # Try to find student by ID or room number
            if student_id_match:
                student_id = student_id_match.group(1)
                try:
                    student = Student.objects.get(student_id=student_id)
                except Student.DoesNotExist:
                    return {
                        'status': 'error',
                        'response': f"Student with ID '{student_id}' not found. Please check the student ID and try again.",
                        'query_type': 'delete_student_not_found',
                        'results': [],
                        'metadata': {'staff_id': staff.staff_id, 'searched_id': student_id}
                    }
            
            elif room_match:
                room_number = room_match.group(1)
                try:
                    student = Student.objects.get(room_number=room_number)
                except Student.DoesNotExist:
                    return {
                        'status': 'error',
                        'response': f"No student found in room {room_number}. Please check the room number and try again.",
                        'query_type': 'delete_student_not_found',
                        'results': [],
                        'metadata': {'staff_id': staff.staff_id, 'searched_room': room_number}
                    }
            
            if student:
                # Get student's data summary
                guest_requests = GuestRequest.objects.filter(student=student).count()
                absence_records = AbsenceRecord.objects.filter(student=student).count()
                maintenance_requests = MaintenanceRequest.objects.filter(student=student).count()
                
                # Show student details and ask for confirmation
                response = f"""Student Details:
Name: {student.name}
Student ID: {student.student_id}
Room: {student.room_number}
Block: {student.block}
Email: {student.email}

Data Summary:
- Guest requests: {guest_requests}
- Leave records: {absence_records}
- Maintenance requests: {maintenance_requests}

WARNING: This action will permanently delete ALL data for this student and cannot be undone.

Type 'CONFIRM DELETE' to proceed or 'CANCEL' to abort."""
                
                return {
                    'status': 'success',
                    'response': response,
                    'query_type': 'delete_confirm_student',
                    'results': [{
                        'student_id': student.student_id,
                        'student_name': student.name,
                        'room_number': student.room_number,
                        'guest_requests': guest_requests,
                        'absence_records': absence_records,
                        'maintenance_requests': maintenance_requests
                    }],
                    'metadata': {
                        'staff_id': staff.staff_id,
                        'student_id': student.student_id,
                        'next_step': 'await_confirmation',
                        'delete_type': 'student_data'
                    }
                }
            
        except Exception as e:
            logger.error(f"Error showing student details for deletion: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while retrieving student details. Please try again.",
                'query_type': 'delete_error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _is_delete_followup_response(self, query: str, staff: Staff) -> bool:
        """Check if this query is a follow-up response to a delete query"""
        # Simple heuristics to detect if this might be a student name/ID response
        query_lower = query.lower().strip()
        
        # Check if it looks like a student ID (alphanumeric, short)
        if len(query_lower) <= 20 and any(c.isalnum() for c in query_lower):
            # Could be student ID, name, or room number
            return True
        
        # Check if it contains common student response patterns
        student_patterns = ['student', 'room', 'name', 'id']
        if any(pattern in query_lower for pattern in student_patterns):
            return True
            
        return False
    
    def _handle_delete_followup(self, query: str, staff: Staff, intent_result: IntentResult) -> Dict[str, Any]:
        """Handle follow-up responses to delete queries (student name/ID)"""
        try:
            from ..models import Student
            
            query_clean = query.strip()
            
            # Try to find student by various methods
            student = None
            search_method = ""
            
            # Try as student ID first
            try:
                student = Student.objects.get(student_id__iexact=query_clean)
                search_method = "student ID"
            except Student.DoesNotExist:
                pass
            
            # Try as room number
            if not student and query_clean.isdigit():
                try:
                    student = Student.objects.get(room_number=query_clean)
                    search_method = "room number"
                except Student.DoesNotExist:
                    pass
            
            # Try as name (partial match)
            if not student:
                students = Student.objects.filter(name__icontains=query_clean)
                if students.count() == 1:
                    student = students.first()
                    search_method = "name"
                elif students.count() > 1:
                    # Multiple matches - ask for clarification
                    student_list = [f"{s.name} (ID: {s.student_id}, Room: {s.room_number})" for s in students[:5]]
                    response = f"Multiple students found matching '{query_clean}':\n\n" + "\n".join(f"- {s}" for s in student_list)
                    response += "\n\nPlease provide the specific student ID or room number."
                    
                    return {
                        'status': 'success',
                        'response': response,
                        'query_type': 'delete_multiple_matches',
                        'results': [{'student_id': s.student_id, 'name': s.name, 'room': s.room_number} for s in students[:5]],
                        'metadata': {'staff_id': staff.staff_id, 'search_term': query_clean}
                    }
            
            if student:
                # Found student - show details and ask for confirmation
                return self._show_student_delete_confirmation(student, staff, search_method)
            else:
                # No student found
                response = f"No student found matching '{query_clean}'. Please check the student ID, room number, or name and try again."
                
                return {
                    'status': 'error',
                    'response': response,
                    'query_type': 'delete_student_not_found',
                    'results': [],
                    'metadata': {'staff_id': staff.staff_id, 'search_term': query_clean}
                }
                
        except Exception as e:
            logger.error(f"Error in delete followup: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while searching for the student. Please try again.",
                'query_type': 'delete_error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _show_student_delete_confirmation(self, student: Student, staff: Staff, search_method: str) -> Dict[str, Any]:
        """Show student details and ask for delete confirmation"""
        try:
            from ..models import GuestRequest, AbsenceRecord, MaintenanceRequest
            
            # Get student's data summary
            guest_requests = GuestRequest.objects.filter(student=student).count()
            absence_records = AbsenceRecord.objects.filter(student=student).count()
            maintenance_requests = MaintenanceRequest.objects.filter(student=student).count()
            
            # Show student details and ask for confirmation
            response = f"""Found student by {search_method}:

Student Details:
Name: {student.name}
Student ID: {student.student_id}
Room: {student.room_number}
Block: {student.block}
Email: {student.email}

Data Summary:
- Guest requests: {guest_requests}
- Leave records: {absence_records}
- Maintenance requests: {maintenance_requests}

WARNING: This action will permanently delete ALL data for this student and cannot be undone.

Type 'CONFIRM DELETE' to proceed or 'CANCEL' to abort."""
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'delete_confirm_student',
                'results': [{
                    'student_id': student.student_id,
                    'student_name': student.name,
                    'room_number': student.room_number,
                    'guest_requests': guest_requests,
                    'absence_records': absence_records,
                    'maintenance_requests': maintenance_requests
                }],
                'metadata': {
                    'staff_id': staff.staff_id,
                    'student_id': student.student_id,
                    'next_step': 'await_confirmation',
                    'delete_type': 'student_data'
                }
            }
            
        except Exception as e:
            logger.error(f"Error showing student delete confirmation: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error while preparing the confirmation. Please try again.",
                'query_type': 'delete_error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_delete_confirmation(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle delete confirmation"""
        try:
            # In a real implementation, you would:
            # 1. Retrieve the student ID from session/context
            # 2. Perform the actual deletion
            # 3. Log the action for audit
            
            response = """DELETE OPERATION SIMULATED
            
For security reasons, actual deletion is not implemented in this demo.

In a production system, this would:
- Delete all student data
- Log the action for audit
- Send notification to administrators
- Create backup before deletion

The deletion workflow is working correctly."""
            
            return {
                'status': 'success',
                'response': response,
                'query_type': 'delete_confirmed_simulation',
                'results': [],
                'metadata': {
                    'staff_id': staff.staff_id,
                    'action': 'delete_simulation',
                    'note': 'actual_deletion_disabled_for_safety'
                }
            }
            
        except Exception as e:
            logger.error(f"Error in delete confirmation: {e}")
            return {
                'status': 'error',
                'response': "I encountered an error during confirmation. Please contact technical support.",
                'query_type': 'delete_error',
                'results': [],
                'metadata': {'error': str(e)}
            }
    
    def _handle_delete_cancellation(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle delete cancellation"""
        response = "Delete operation cancelled. No data was deleted."
        
        return {
            'status': 'success',
            'response': response,
            'query_type': 'delete_cancelled',
            'results': [],
            'metadata': {'staff_id': staff.staff_id, 'action': 'delete_cancelled'}
        }
    
    def _handle_general_staff_query(self, query: str, staff: Staff, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle general staff queries that don't fit other categories"""
        
        # Provide helpful suggestions
        suggestions = [
            "Count queries: 'How many students are absent?', 'How many pending requests?'",
            "Status queries: 'What is the status of room 101?', 'Status of student ABC123'",
            "List queries: 'Show me all pending requests', 'List absent students'",
            "Summary queries: 'Give me today's summary', 'Daily report'",
            "Delete queries: 'Delete student data for ABC123', 'Delete guest request #123'"
        ]
        
        response = f"I can help you with various queries. Here are some examples:\n" + "\n".join(f"- {s}" for s in suggestions)
        
        return {
            'status': 'success',
            'response': response,
            'query_type': 'general_help',
            'results': [],
            'metadata': {
                'staff_id': staff.staff_id,
                'original_query': query,
                'suggestions': suggestions
            }
        }
    
    def manage_conversation_context(self, user_id: str, user_type: str = 'student') -> 'ConversationContext':
        """
        Manage conversation context for a user using database persistence.
        
        Args:
            user_id: User identifier
            user_type: Type of user ('student' or 'staff')
            
        Returns:
            ConversationContext dataclass for the user
        """
        try:
            # Try to get existing context for this user from database
            try:
                # Get student if it's a student context
                student = None
                if user_type == 'student':
                    student = Student.objects.filter(student_id=user_id).first()
                
                # Try to get existing context
                db_context = None
                if student:
                    db_context = DBConversationContext.objects.filter(student=student).first()
                else:
                    db_context = DBConversationContext.objects.filter(user_id=user_id, user_type=user_type).first()
                
                # Check if context is expired
                if db_context:
                    if not db_context.is_expired(self.CONTEXT_TIMEOUT_HOURS):
                        # Valid context found - convert to dataclass
                        return ConversationContext(
                            user_id=db_context.user_id,
                            user_type=db_context.user_type,
                            conversation_id=db_context.conversation_id,
                            last_message_id=db_context.last_message_id,
                            intent_history=db_context.intent_history or [],
                            pending_clarifications=db_context.pending_clarifications or [],
                            context_data=db_context.context_data or {},
                            created_at=db_context.created_at,
                            updated_at=db_context.updated_at
                        )
                    else:
                        # Context expired, delete it
                        db_context.delete()
                        db_context = None
                
                # Create new context if not found or expired
                if not db_context:
                    db_context = DBConversationContext.objects.create(
                        user_id=user_id,
                        user_type=user_type,
                        student=student,
                        conversation_id=f"{user_type}-{user_id}-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                        last_message_id="",
                        intent_history=[],
                        pending_clarifications=[],
                        context_data={}
                    )
                    
                    # Convert to dataclass
                    return ConversationContext(
                        user_id=db_context.user_id,
                        user_type=db_context.user_type,
                        conversation_id=db_context.conversation_id,
                        last_message_id=db_context.last_message_id,
                        intent_history=[],
                        pending_clarifications=[],
                        context_data={},
                        created_at=db_context.created_at,
                        updated_at=db_context.updated_at
                    )
                
            except Exception as e:
                logger.error(f"Error getting/creating conversation context from DB: {e}")
                # Create fallback in-memory context
                return ConversationContext(
                    user_id=user_id,
                    user_type=user_type,
                    conversation_id=f"error-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                    last_message_id="",
                    intent_history=[],
                    pending_clarifications=[],
                    context_data={},
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
            
        except Exception as e:
            logger.error(f"Error managing conversation context: {e}")
            # Fallback - create in-memory context
            return ConversationContext(
                user_id=user_id,
                user_type=user_type,
                conversation_id=f"fallback-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                last_message_id="",
                intent_history=[],
                pending_clarifications=[],
                context_data={},
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
    
    def _persist_conversation_context(self, context: 'ConversationContext') -> None:
        """
        Persist conversation context to database.
        
        Args:
            context: ConversationContext dataclass to persist
        """
        try:
            # Get student if it's a student context
            student = None
            if context.user_type == 'student':
                student = Student.objects.filter(student_id=context.user_id).first()
            
            # Get or create database context
            db_context, created = DBConversationContext.objects.get_or_create(
                conversation_id=context.conversation_id,
                defaults={
                    'user_id': context.user_id,
                    'user_type': context.user_type,
                    'student': student,
                    'last_message_id': context.last_message_id,
                    'intent_history': context.intent_history,
                    'pending_clarifications': context.pending_clarifications,
                    'context_data': context.context_data
                }
            )
            
            # Update if already exists
            if not created:
                db_context.user_id = context.user_id
                db_context.user_type = context.user_type
                db_context.student = student
                db_context.last_message_id = context.last_message_id
                db_context.intent_history = context.intent_history
                db_context.pending_clarifications = context.pending_clarifications
                db_context.context_data = context.context_data
                db_context.updated_at = timezone.now()
                db_context.save()
                
        except Exception as e:
            logger.error(f"Error persisting conversation context: {e}")
            # Don't raise exception - conversation can continue without persistence
    
    def _classify_message_type(self, message: Message) -> MessageType:
        """
        Classify the type of message based on content and context.
        
        Args:
            message: Message to classify
            
        Returns:
            MessageType classification
        """
        # Check if this is a follow-up to a previous conversation
        context_key = f"student:{message.sender.student_id}"
        if context_key in self._conversation_contexts:
            context = self._conversation_contexts[context_key]
            
            # If we have pending clarifications, this is likely a clarification response
            if context.pending_clarifications:
                return MessageType.CLARIFICATION
            
            # Check if we're in the middle of a specific conversation flow
            if (context.context_data.get('leave_request_step') or 
                context.context_data.get('guest_request_step') or 
                context.context_data.get('maintenance_request_step')):
                
                # Check if this looks like a new request vs a clarification response
                message_lower = message.content.lower()
                
                # New request indicators (these suggest a new request, not a clarification)
                new_request_indicators = [
                    'i want', 'i need', 'my friend', 'guest', 'leave', 'going home', 
                    'broken', 'not working', 'maintenance', 'clean my room', 'help'
                ]
                
                # If the message contains new request indicators, treat as new request
                if any(indicator in message_lower for indicator in new_request_indicators):
                    # Clear the old context since this is a new request
                    context.context_data.clear()
                    context.intent_history.clear()
                    return MessageType.STUDENT_REQUEST
                
                # Otherwise, treat as clarification if we're in a conversation flow
                return MessageType.CLARIFICATION
            
            # If the last intent required clarification, this might be a clarification response
            if context.intent_history:
                last_intent = context.intent_history[-1] if context.intent_history else None
                if last_intent and last_intent.get('requires_clarification'):
                    # Check if this message looks like it's answering a question
                    message_lower = message.content.lower()
                    
                    # Simple clarification response indicators (short answers)
                    clarification_indicators = [
                        'today', 'tomorrow', 'next week', 'monday', 'tuesday', 'wednesday', 
                        'thursday', 'friday', 'saturday', 'sunday', 'january', 'february',
                        'march', 'april', 'may', 'june', 'july', 'august', 'september',
                        'october', 'november', 'december', 'home', 'family', 'emergency',
                        'days', 'hours', 'yes', 'no'
                    ]
                    
                    # If message is short and contains clarification indicators, it's likely a clarification
                    if (len(message.content.split()) <= 5 and 
                        any(indicator in message_lower for indicator in clarification_indicators)):
                        return MessageType.CLARIFICATION
                    
                    # If it's a longer message, it might be a new request
                    if len(message.content.split()) > 5:
                        return MessageType.STUDENT_REQUEST
                    
                    # Default to clarification for ambiguous cases
                    return MessageType.CLARIFICATION
        
        # Default to student request
        return MessageType.STUDENT_REQUEST
    
    def _build_user_context(self, student: Student, conversation_context: ConversationContext = None) -> Dict[str, Any]:
        """
        Build enhanced user context for AI processing with smart memory.
        
        Args:
            student: Student making the request
            conversation_context: Existing conversation context
            
        Returns:
            Enhanced user context dictionary
        """
        from datetime import datetime, timedelta
        
        context = {
            'student_id': student.student_id,
            'name': student.name,
            'room_number': student.room_number,
            'block': student.block,
            'has_recent_violations': student.has_recent_violations,
            'violation_count': student.violation_count,
            'current_time': timezone.now().strftime('%Y-%m-%d %H:%M'),
            'current_day': timezone.now().strftime('%A'),
            'current_date': timezone.now().strftime('%Y-%m-%d')
        }
        
        # Add recent request history for context
        try:
            from ..models import GuestRequest, AbsenceRecord, MaintenanceRequest
            
            # Recent guest requests (last 30 days)
            recent_guests = GuestRequest.objects.filter(
                student=student,
                created_at__gte=timezone.now() - timedelta(days=30)
            ).order_by('-created_at')[:3]
            
            context['recent_guest_requests'] = [
                {
                    'guest_name': req.guest_name,
                    'date': req.start_date.strftime('%Y-%m-%d'),
                    'status': req.status
                } for req in recent_guests
            ]
            
            # Recent absence requests
            recent_absences = AbsenceRecord.objects.filter(
                student=student,
                created_at__gte=timezone.now() - timedelta(days=30)
            ).order_by('-created_at')[:3]
            
            context['recent_absence_requests'] = [
                {
                    'start_date': req.start_date.strftime('%Y-%m-%d'),
                    'end_date': req.end_date.strftime('%Y-%m-%d'),
                    'reason': req.reason,
                    'status': req.status
                } for req in recent_absences
            ]
            
            # Current active requests
            active_guests = GuestRequest.objects.filter(
                student=student,
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).count()
            
            context['active_guests_count'] = active_guests
            
            # Check if student is currently absent
            current_absence = AbsenceRecord.objects.filter(
                student=student,
                status='approved',
                start_date__lte=timezone.now(),
                end_date__gte=timezone.now()
            ).first()
            
            context['currently_absent'] = bool(current_absence)
            if current_absence:
                context['absence_return_date'] = current_absence.end_date.strftime('%Y-%m-%d')
                
        except Exception as e:
            logger.warning(f"Could not fetch student history: {e}")
        
        # Add conversation context with smart memory
        if conversation_context:
            context.update({
                'conversation_id': conversation_context.conversation_id,
                'intent_history': conversation_context.intent_history[-5:],  # Last 5 intents
                'pending_clarifications': conversation_context.pending_clarifications,
                'context_data': conversation_context.context_data
            })
            
            # Smart context inference from history
            if conversation_context.intent_history:
                last_intent = conversation_context.intent_history[-1]
                context['last_intent'] = last_intent.get('intent')
                context['last_entities'] = last_intent.get('entities', {})
                
                # Infer missing information from previous interactions
                if last_intent.get('intent') == 'guest_request':
                    context['expecting_guest_info'] = True
                elif last_intent.get('intent') == 'leave_request':
                    context['expecting_leave_info'] = True
        
        return context
    
    def _handle_clarification_needed(self, intent_result: IntentResult, message: Message, 
                                   context: ConversationContext) -> ProcessingResult:
        """Handle cases where clarification is needed with intelligent conversational follow-up."""
        # Check if AI engine is configured
        if not self.ai_engine.is_configured():
            return ProcessingResult(
                status=ProcessingStatus.ESCALATED,
                response_message="Your request has been forwarded to staff for review. You will receive a response soon.",
                confidence=intent_result.confidence,
                intent_result=intent_result,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'escalation_reason': 'ai_service_unavailable'}
            )
        
        try:
            # Get previously collected data for this intent type
            intent_key = f"{intent_result.intent}_data"
            collected_data = context.context_data.get(intent_key, {}) if context else {}
            
            # Update collected data with newly extracted entities
            if intent_result.entities:
                for key, value in intent_result.entities.items():
                    if value is not None:
                        collected_data[key] = value
            
            # Get missing fields from intent result
            missing_fields = intent_result.missing_info or []
            
            # Use new intelligent response generation
            user_context = self._build_user_context(message.sender, context) if context else {}
            intelligent_response = self.ai_engine.generate_intelligent_response(
                intent=intent_result.intent,
                current_entities=collected_data,
                missing_fields=missing_fields,
                user_context=user_context
            )
            
            # Update context with collected data
            if context:
                context.context_data[intent_key] = collected_data
                context.pending_clarifications = missing_fields
                context.updated_at = timezone.now()
            
            return ProcessingResult(
                status=ProcessingStatus.REQUIRES_CLARIFICATION,
                response_message=intelligent_response.get('message', 'Could you provide more details?'),
                confidence=intent_result.confidence,
                intent_result=intent_result,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=True,
                metadata={
                    'action': intelligent_response.get('action'),
                    'collected_entities': collected_data,
                    'remaining_fields': intelligent_response.get('remaining_fields', missing_fields[1:])
                }
            )
        
        except Exception as e:
            logger.error(f"Error in intelligent clarification handling: {e}")
            # Fallback to simple clarification
            clarification_question = "Could you please provide more details about your request?"
            
            if context:
                context.pending_clarifications = intent_result.missing_info or []
                context.updated_at = timezone.now()
            
            return ProcessingResult(
                status=ProcessingStatus.REQUIRES_CLARIFICATION,
                response_message=clarification_question,
                confidence=intent_result.confidence,
                intent_result=intent_result,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=True,
                metadata={
                    'missing_info': intent_result.missing_info
                }
            )
    
    def _handle_leave_request_clarification(self, intent_result: IntentResult, message: Message, 
                                          context: ConversationContext) -> ProcessingResult:
        """Handle conversational clarification for leave requests - ONE field at a time."""
        entities = intent_result.entities
        
        # Store current entities in context for next interaction
        if not context.context_data.get('leave_request_data'):
            context.context_data['leave_request_data'] = {}
        
        # Update with any new information from this message
        for key, value in entities.items():
            if value:  # Only store non-empty values
                context.context_data['leave_request_data'][key] = value
        
        current_data = context.context_data['leave_request_data']
        
        # Check what information we still need - ask for ONLY ONE field at a time
        if not current_data.get('leave_from') and not current_data.get('start_date'):
            response = "I understand you want to request leave. From which date are you leaving? (e.g., 'tomorrow', 'February 1st', 'next Monday')"
            context.context_data['leave_request_step'] = 'asking_start_date'
        elif not current_data.get('leave_to') and not current_data.get('end_date') and not current_data.get('duration') and not current_data.get('duration_days'):
            start_date = current_data.get('leave_from') or current_data.get('start_date')
            response = f"Got it! You're leaving on {start_date}. When will you return? (e.g., 'February 5th', 'in 3 days', 'next Friday')"
            context.context_data['leave_request_step'] = 'asking_end_date'
        elif not current_data.get('reason'):
            start_date = current_data.get('leave_from') or current_data.get('start_date')
            end_date = current_data.get('leave_to') or current_data.get('end_date')
            if end_date:
                response = f"Perfect! Leave from {start_date} to {end_date}. What's the reason for your leave? (e.g., 'going home', 'family function', 'medical')"
            else:
                duration = current_data.get('duration') or f"{current_data.get('duration_days', 'few')} days"
                response = f"Perfect! Leave from {start_date} for {duration}. What's the reason for your leave? (e.g., 'going home', 'family function', 'medical')"
            context.context_data['leave_request_step'] = 'asking_reason'
        else:
            # We have all required information - process the request immediately
            # Create a complete intent result with all gathered information
            complete_entities = current_data.copy()
            complete_intent_result = IntentResult(
                intent='leave_request',
                entities=complete_entities,
                confidence=0.9,  # High confidence since we gathered all info
                requires_clarification=False,
                missing_info=[]
            )
            
            # Clear the conversation context since we're done
            context.context_data.pop('leave_request_data', None)
            context.context_data.pop('leave_request_step', None)
            
            # Process the complete request
            return self._process_actionable_request(complete_intent_result, message, context)
        
        return ProcessingResult(
            status=ProcessingStatus.REQUIRES_CLARIFICATION,
            response_message=response,
            confidence=intent_result.confidence,
            intent_result=intent_result,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=True,
            metadata={'step': context.context_data.get('leave_request_step')}
        )
    
    def _handle_guest_request_clarification(self, intent_result: IntentResult, message: Message, 
                                          context: ConversationContext) -> ProcessingResult:
        """Handle conversational clarification for guest requests - ONE field at a time."""
        entities = intent_result.entities
        
        # Store current entities in context
        if not context.context_data.get('guest_request_data'):
            context.context_data['guest_request_data'] = {}
        
        for key, value in entities.items():
            if value:
                # VALIDATION: Check if guest_name is not a blacklisted word
                if key == 'guest_name' and not self._validate_guest_name(value):
                    # If guest_name is blacklisted, skip storing it and mark as needing clarification
                    logger.warning(f"Rejected blacklisted guest_name: {value}")
                    continue
                context.context_data['guest_request_data'][key] = value
        
        current_data = context.context_data['guest_request_data']
        
        # Check what information we still need - ask for ONLY ONE field at a time
        if not current_data.get('guest_name'):
            response = "Got it! 👋 You want to request guest permission.\n\nFirst, what's your guest's name?"
            context.context_data['guest_request_step'] = 'asking_guest_name'
        elif not current_data.get('visit_date') and not current_data.get('start_date'):
            guest_name = current_data.get('guest_name')
            response = f"Cool! 😊 {guest_name} is coming over.\n\nWhen will {guest_name} visit?\n(e.g., today, tomorrow, this weekend)"
            context.context_data['guest_request_step'] = 'asking_visit_date'
        elif not current_data.get('duration') and not current_data.get('duration_days') and not current_data.get('end_date'):
            guest_name = current_data.get('guest_name')
            visit_date = current_data.get('visit_date') or current_data.get('start_date')
            response = f"Perfect! ✨ {guest_name} will be here on {visit_date}.\n\nFor how long?\n(e.g., 2 hours, overnight, 2 days)"
            context.context_data['guest_request_step'] = 'asking_duration'
        else:
            # We have all required information - process the request immediately
            # Create a complete intent result with all gathered information
            complete_entities = current_data.copy()
            
            logger.info(f"[GUEST REQUEST] Starting completion with current_data: {current_data}")
            
            # Ensure we have proper date formatting
            if complete_entities.get('visit_date') and not complete_entities.get('start_date'):
                complete_entities['start_date'] = complete_entities['visit_date']
            
            # Parse start_date if it's in natural language format (e.g., "this weekend", "tomorrow")
            if complete_entities.get('start_date'):
                parsed_start_date = self._parse_natural_date(complete_entities['start_date'])
                logger.info(f"[GUEST REQUEST] Parsed date: '{complete_entities['start_date']}' -> '{parsed_start_date}'")
                if parsed_start_date:
                    complete_entities['start_date'] = parsed_start_date
            
            # Handle duration - convert to end_date if not already set
            from datetime import datetime, timedelta
            
            # If we have duration but no end_date, calculate end_date
            if not complete_entities.get('end_date') and complete_entities.get('start_date'):
                start_date_str = complete_entities['start_date']
                logger.info(f"[GUEST REQUEST] Calculating end_date from start_date={start_date_str}, duration={complete_entities.get('duration')}")
                
                # Try to parse start_date
                try:
                    # Handle various date formats
                    if len(start_date_str) == 10 and start_date_str[4] == '-':  # YYYY-MM-DD format
                        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                    else:
                        # Try parsing with dateutil
                        from dateutil import parser as date_parser
                        start_date = date_parser.parse(start_date_str).date()
                    
                    # Check duration_days first
                    if complete_entities.get('duration_days'):
                        end_date = start_date + timedelta(days=int(complete_entities['duration_days']))
                    # Then check duration string (e.g., "2 hours", "overnight")
                    elif complete_entities.get('duration'):
                        duration_str = complete_entities['duration'].lower()
                        
                        if 'hour' in duration_str:
                            # For hours, same day visit
                            end_date = start_date
                        elif 'overnight' in duration_str or 'night' in duration_str:
                            # For overnight, add 1 day
                            end_date = start_date + timedelta(days=1)
                        elif 'day' in duration_str:
                            # Parse number of days from string like "2 days"
                            import re
                            match = re.search(r'(\d+)', duration_str)
                            if match:
                                num_days = int(match.group(1))
                                end_date = start_date + timedelta(days=num_days)
                            else:
                                end_date = start_date
                        else:
                            # Default to same day
                            end_date = start_date
                    else:
                        # No duration specified, assume same day
                        end_date = start_date
                    
                    complete_entities['end_date'] = end_date.strftime('%Y-%m-%d')
                    logger.info(f"[GUEST REQUEST] Calculated end_date: {complete_entities['end_date']}")
                    
                except Exception as e:
                    logger.error(f"[GUEST REQUEST] Error calculating end_date: {e}, start_date={start_date_str}, duration={complete_entities.get('duration')}", exc_info=True)
                    # If parsing fails, assume same day for short visits
                    complete_entities['end_date'] = complete_entities.get('start_date')
            
            logger.info(f"[GUEST REQUEST] Final complete_entities: {complete_entities}")
            
            complete_intent_result = IntentResult(
                intent='guest_request',
                entities=complete_entities,
                confidence=0.9,  # High confidence since we gathered all info
                requires_clarification=False,
                missing_info=[]
            )
            
            # Clear the conversation context since we're done
            context.context_data.pop('guest_request_data', None)
            context.context_data.pop('guest_request_step', None)
            
            # Process the complete request
            logger.info(f"[GUEST REQUEST] Processing actionable request with entities: {complete_entities}")
            return self._process_actionable_request(complete_intent_result, message, context)
        
        return ProcessingResult(
            status=ProcessingStatus.REQUIRES_CLARIFICATION,
            response_message=response,
            confidence=intent_result.confidence,
            intent_result=intent_result,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=True,
            metadata={'step': context.context_data.get('guest_request_step')}
        )
    
    def _handle_maintenance_request_clarification(self, intent_result: IntentResult, message: Message, 
                                                    context: ConversationContext) -> ProcessingResult:
        """Handle conversational clarification for maintenance requests - ONE field at a time."""
        entities = intent_result.entities
        
        # Store current entities in context
        if not context.context_data.get('maintenance_request_data'):
            context.context_data['maintenance_request_data'] = {}
        
        for key, value in entities.items():
            if value:
                context.context_data['maintenance_request_data'][key] = value
        
        current_data = context.context_data['maintenance_request_data']
        
        # Check what information we still need - ask for ONLY ONE field at a time
        if not current_data.get('problem_description') and not current_data.get('issue_description'):
            response = "I understand you need maintenance help. What problem are you experiencing? (e.g., 'AC not working', 'water leakage', 'broken door')"
            context.context_data['maintenance_request_step'] = 'asking_problem'
        elif not current_data.get('location') and not current_data.get('room_number'):
            problem = current_data.get('problem_description') or current_data.get('issue_description')
            response = f"Got it! The problem is: {problem}. Where is this located? (e.g., 'my room', 'room 101', 'bathroom', 'common area')"
            context.context_data['maintenance_request_step'] = 'asking_location'
        else:
            # We have all required information - process the request immediately
            # Create a complete intent result with all gathered information
            complete_entities = current_data.copy()
            
            # If no specific location was provided, use the student's room as default
            if not complete_entities.get('location') and not complete_entities.get('room_number'):
                complete_entities['location'] = f"Room {message.sender.room_number}"
                complete_entities['room_number'] = message.sender.room_number
            
            # Set default urgency if not specified
            if not complete_entities.get('urgency'):
                problem_desc = (complete_entities.get('problem_description') or 
                              complete_entities.get('issue_description', '')).lower()
                if any(word in problem_desc for word in ['broken', 'not working', 'emergency', 'urgent', 'leak']):
                    complete_entities['urgency'] = 'high'
                elif any(word in problem_desc for word in ['problem', 'issue', 'need']):
                    complete_entities['urgency'] = 'medium'
                else:
                    complete_entities['urgency'] = 'low'
            
            complete_intent_result = IntentResult(
                intent='maintenance_request',
                entities=complete_entities,
                confidence=0.9,  # High confidence since we gathered all info
                requires_clarification=False,
                missing_info=[]
            )
            
            # Clear the conversation context since we're done
            context.context_data.pop('maintenance_request_data', None)
            context.context_data.pop('maintenance_request_step', None)
            
            # Process the complete request
            return self._process_actionable_request(complete_intent_result, message, context)
        
        return ProcessingResult(
            status=ProcessingStatus.REQUIRES_CLARIFICATION,
            response_message=response,
            confidence=intent_result.confidence,
            intent_result=intent_result,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=True,
            metadata={'step': context.context_data.get('maintenance_request_step')}
        )
    
    def _process_complete_leave_request(self, leave_data: Dict[str, Any], message: Message, 
                                      context: ConversationContext) -> ProcessingResult:
        """Process a complete leave request with all required information."""
        try:
            # Create enhanced intent result with complete data
            enhanced_entities = {
                'intent': 'leave_request',
                'start_date': leave_data.get('start_date') or leave_data.get('leave_from'),
                'end_date': leave_data.get('end_date') or leave_data.get('leave_to'),
                'reason': leave_data.get('reason', 'Personal'),
                'room_number': message.sender.room_number
            }
            
            # Calculate duration if not provided
            if not enhanced_entities.get('end_date') and leave_data.get('duration_days'):
                from datetime import datetime, timedelta
                start_date = datetime.strptime(enhanced_entities['start_date'], '%Y-%m-%d')
                end_date = start_date + timedelta(days=int(leave_data['duration_days']))
                enhanced_entities['end_date'] = end_date.strftime('%Y-%m-%d')
            
            enhanced_intent_result = IntentResult(
                intent='leave_request',
                entities=enhanced_entities,
                confidence=0.9,  # High confidence since we collected all info
                requires_clarification=False,
                missing_info=[]
            )
            
            # Clear the context data since we're processing the request
            context.context_data.pop('leave_request_data', None)
            context.context_data.pop('leave_request_step', None)
            
            # Process the request through normal flow
            return self._process_actionable_request(enhanced_intent_result, message, context)
            
        except Exception as e:
            logger.error(f"Error processing complete leave request: {e}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I encountered an error processing your leave request. Please try again.",
                confidence=0.0,
                intent_result=None,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    def _process_complete_guest_request(self, guest_data: Dict[str, Any], message: Message, 
                                      context: ConversationContext) -> ProcessingResult:
        """Process a complete guest request with all required information."""
        try:
            # Create enhanced intent result with complete data
            enhanced_entities = {
                'intent': 'guest_request',
                'guest_name': guest_data.get('guest_name'),
                'start_date': guest_data.get('start_date'),
                'end_date': guest_data.get('end_date'),
                'room_number': message.sender.room_number
            }
            
            # Calculate end date if duration provided
            if not enhanced_entities.get('end_date') and guest_data.get('duration_days'):
                from datetime import datetime, timedelta
                start_date = datetime.strptime(enhanced_entities['start_date'], '%Y-%m-%d')
                end_date = start_date + timedelta(days=int(guest_data['duration_days']))
                enhanced_entities['end_date'] = end_date.strftime('%Y-%m-%d')
            
            enhanced_intent_result = IntentResult(
                intent='guest_request',
                entities=enhanced_entities,
                confidence=0.9,
                requires_clarification=False,
                missing_info=[]
            )
            
            # Clear the context data
            context.context_data.pop('guest_request_data', None)
            context.context_data.pop('guest_request_step', None)
            
            # Process the request
            return self._process_actionable_request(enhanced_intent_result, message, context)
            
        except Exception as e:
            logger.error(f"Error processing complete guest request: {e}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I encountered an error processing your guest request. Please try again.",
                confidence=0.0,
                intent_result=None,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    def _process_complete_maintenance_request(self, maintenance_data: Dict[str, Any], message: Message, 
                                            context: ConversationContext) -> ProcessingResult:
        """Process a complete maintenance request with all required information."""
        try:
            # Create enhanced intent result with complete data
            enhanced_entities = {
                'intent': 'maintenance_request',
                'issue_description': maintenance_data.get('issue_description'),
                'location': maintenance_data.get('location') or maintenance_data.get('room_number') or message.sender.room_number,
                'room_number': message.sender.room_number,
                'urgency': maintenance_data.get('urgency', 'medium')
            }
            
            enhanced_intent_result = IntentResult(
                intent='maintenance_request',
                entities=enhanced_entities,
                confidence=0.9,
                requires_clarification=False,
                missing_info=[]
            )
            
            # Clear the context data
            context.context_data.pop('maintenance_request_data', None)
            context.context_data.pop('maintenance_request_step', None)
            
            # Process the request
            return self._process_actionable_request(enhanced_intent_result, message, context)
            
        except Exception as e:
            logger.error(f"Error processing complete maintenance request: {e}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I encountered an error processing your maintenance request. Please try again.",
                confidence=0.0,
                intent_result=None,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    def _check_critical_missing_info(self, intent_result: IntentResult, context: ConversationContext) -> Optional[ProcessingResult]:
        """
        Check if critical information is missing and trigger conversational clarification.
        Returns ProcessingResult if clarification is needed, None if we can proceed.
        """
        intent = intent_result.intent
        entities = intent_result.entities
        
        # For guest requests, check if we have minimum required information
        if intent == 'guest_request':
            has_guest_name = bool(entities.get('guest_name'))
            has_date_info = bool(entities.get('start_date') or entities.get('visit_date'))
            has_duration = bool(entities.get('duration') or entities.get('duration_days') or entities.get('end_date'))
            
            # If missing guest name OR (missing both date and duration), ask conversationally
            if not has_guest_name or not (has_date_info or has_duration):
                # Create a modified intent result that requires clarification
                clarification_intent = IntentResult(
                    intent=intent_result.intent,
                    entities=intent_result.entities,
                    confidence=intent_result.confidence,
                    requires_clarification=True,  # Force clarification
                    missing_info=intent_result.missing_info
                )
                # Use the existing clarification handler
                return self._handle_guest_request_clarification(clarification_intent, None, context)
        
        # For leave requests, check if we have minimum required information
        elif intent == 'leave_request':
            has_start_date = bool(entities.get('start_date') or entities.get('leave_from'))
            has_end_info = bool(entities.get('end_date') or entities.get('leave_to') or 
                              entities.get('duration') or entities.get('duration_days'))
            
            # If missing start date OR end information, ask conversationally
            if not has_start_date or not has_end_info:
                clarification_intent = IntentResult(
                    intent=intent_result.intent,
                    entities=intent_result.entities,
                    confidence=intent_result.confidence,
                    requires_clarification=True,
                    missing_info=intent_result.missing_info
                )
                return self._handle_leave_request_clarification(clarification_intent, None, context)
        
        # For maintenance requests, check if we have problem description
        elif intent == 'maintenance_request':
            has_problem = bool(entities.get('issue_description') or entities.get('problem_description'))
            
            # If missing problem description, ask conversationally
            if not has_problem:
                clarification_intent = IntentResult(
                    intent=intent_result.intent,
                    entities=intent_result.entities,
                    confidence=intent_result.confidence,
                    requires_clarification=True,
                    missing_info=intent_result.missing_info
                )
                return self._handle_maintenance_request_clarification(clarification_intent, None, context)
        
        # No critical information missing, proceed with processing
        return None
    
    def _process_actionable_request(self, intent_result: IntentResult, message: Message, 
                                  context: ConversationContext) -> ProcessingResult:
        """Process actionable requests with enhanced logic and smart auto-approval."""
        try:
            # CHECK FOR MISSING CRITICAL INFORMATION FIRST - Ask conversationally instead of rejecting
            missing_info_check = self._check_critical_missing_info(intent_result, context)
            if missing_info_check:
                # Trigger conversational clarification flow
                return missing_info_check
            
            # Enhanced structured data formatting
            structured_data = self.ai_engine.format_structured_output(intent_result)
            request_type = structured_data['request_type']
            
            # Smart pre-processing based on context and history
            enhanced_entities = self._enhance_entities_with_context(intent_result.entities, message.sender, context)
            
            # Ensure intent is in entities for reference (needed by validation and enhancement)
            enhanced_entities['intent'] = intent_result.intent
            
            logger.info(f"[PROCESS_ACTIONABLE_REQUEST] intent={intent_result.intent}, request_type={request_type}")
            logger.info(f"[PROCESS_ACTIONABLE_REQUEST] enhanced_entities: {enhanced_entities}")
            
            # Create enhanced intent result with better entities
            enhanced_intent_result = IntentResult(
                intent=intent_result.intent,
                entities=enhanced_entities,
                confidence=intent_result.confidence,
                requires_clarification=intent_result.requires_clarification,
                missing_info=intent_result.missing_info
            )
            
            # Evaluate for auto-approval with enhanced logic
            approval_result = self.auto_approval_engine.evaluate_request(
                enhanced_entities, 
                intent_result.intent, 
                message.sender
            )
            
            # Smart response generation based on context
            created_record = None
            if approval_result.approved:
                created_record = self._create_database_record(enhanced_intent_result, message.sender, approval_result)
                response_message = self._generate_smart_approval_response(approval_result, enhanced_intent_result, message.sender)
                status = ProcessingStatus.SUCCESS
                
                # Send smart notifications
                self._send_smart_notifications(enhanced_intent_result, message.sender, approval_result)
                
            elif approval_result.decision_type == 'escalated':
                # Create pending record for escalated requests
                created_record = self._create_database_record(enhanced_intent_result, message.sender, approval_result, status='pending')
                response_message = self._generate_smart_escalation_response(approval_result, enhanced_intent_result, message.sender)
                status = ProcessingStatus.ESCALATED
                
                # Notify staff with context
                self._notify_staff_with_context(enhanced_intent_result, message.sender, approval_result)
                
            else:  # rejected
                response_message = self._generate_smart_rejection_response(approval_result, enhanced_intent_result, message.sender)
                status = ProcessingStatus.REJECTED
            
            # Enhanced audit logging
            audit_log_id = self.auto_approval_engine.log_decision(approval_result, enhanced_entities, message.sender)
            
            return ProcessingResult(
                status=status,
                response_message=response_message,
                confidence=enhanced_intent_result.confidence,
                intent_result=enhanced_intent_result,
                approval_result=approval_result,
                conversation_context=context,
                requires_follow_up=False,
                metadata={
                    'request_type': request_type,
                    'audit_log_id': audit_log_id,
                    'created_record': created_record,
                    'processing_time': timezone.now().isoformat(),
                    'enhanced_processing': True,
                    'context_used': bool(context and context.intent_history)
                }
            )
            
        except Exception as e:
            logger.error(f"Error processing actionable request: {e}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I encountered an error processing your request. Please contact staff for assistance.",
                confidence=intent_result.confidence,
                intent_result=intent_result,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    def _enhance_entities_with_context(self, entities: Dict[str, Any], student: Student, 
                                     context: ConversationContext) -> Dict[str, Any]:
        """Enhance entities using conversation context and student history."""
        enhanced = entities.copy()
        
        # Add room number if missing
        if not enhanced.get('room_number'):
            enhanced['room_number'] = student.room_number
        
        # Smart date enhancement for leave requests
        if enhanced.get('intent') == 'leave_request':
            # If we have duration but no dates, calculate them
            duration_days = enhanced.get('duration_days')
            if duration_days and not enhanced.get('start_date'):
                from datetime import datetime, timedelta
                today = timezone.now().date()
                enhanced['start_date'] = today.strftime('%Y-%m-%d')
                
                # Calculate end date based on duration
                if not enhanced.get('end_date'):
                    end_date = today + timedelta(days=int(duration_days))
                    enhanced['end_date'] = end_date.strftime('%Y-%m-%d')
            
            # If no reason provided, use default
            if not enhanced.get('reason'):
                enhanced['reason'] = 'Going home'
        
        # Smart date enhancement using context
        if context and context.intent_history:
            last_intent = context.intent_history[-1] if context.intent_history else {}
            last_entities = last_intent.get('entities', {})
            
            # Inherit dates from previous context if current request is vague
            if not enhanced.get('start_date') and last_entities.get('start_date'):
                enhanced['start_date'] = last_entities['start_date']
            
            # Inherit guest name if continuing conversation
            if (enhanced.get('intent') == 'guest_request' and 
                not enhanced.get('guest_name') and 
                last_entities.get('guest_name')):
                enhanced['guest_name'] = last_entities['guest_name']
        
        # Smart defaults based on intent
        if not enhanced.get('urgency'):
            if entities.get('intent') == 'maintenance_request':
                # Determine urgency from issue description
                issue_desc = enhanced.get('issue_description', '').lower()
                if any(word in issue_desc for word in ['broken', 'not working', 'emergency', 'urgent']):
                    enhanced['urgency'] = 'high'
                elif any(word in issue_desc for word in ['problem', 'issue', 'need']):
                    enhanced['urgency'] = 'medium'
                else:
                    enhanced['urgency'] = 'low'
        
        return enhanced
    
    def _generate_smart_approval_response(self, approval_result: AutoApprovalResult, 
                                        intent_result: IntentResult, student: Student) -> str:
        """Generate contextual approval responses without markdown formatting."""
        intent = intent_result.intent
        entities = intent_result.entities
        
        if intent == 'guest_request':
            guest_name = entities.get('guest_name', 'your guest')
            start_date = entities.get('start_date', 'the requested date')
            
            # Smart date formatting
            try:
                from datetime import datetime
                if start_date != 'the requested date':
                    date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                    if date_obj.date() == timezone.now().date():
                        date_str = "today"
                    elif date_obj.date() == (timezone.now().date() + timedelta(days=1)):
                        date_str = "tomorrow"
                    else:
                        date_str = date_obj.strftime('%B %d')
                else:
                    date_str = start_date
            except:
                date_str = start_date
            
            return f"Guest Approved!\n" \
                   f"─────────────────────\n" \
                   f"{guest_name} can stay {date_str}.\n\n" \
                   f"Next Steps:\n" \
                   f"  • Security has been notified\n" \
                   f"  • Guest check-in at reception\n" \
                   f"  • Follow hostel rules\n" \
                   f"  • Checkout by hostel timing\n\n" \
                   f"Have fun!"
        
        elif intent == 'leave_request':
            start_date = entities.get('start_date', 'your departure date')
            end_date = entities.get('end_date', 'your return date')
            
            return f"Leave Approved!\n" \
                   f"─────────────────────\n" \
                   f"From {start_date} to {end_date}\n\n" \
                   f"Remember:\n" \
                   f"  • Tell security before you leave\n" \
                   f"  • Lock your room properly\n" \
                   f"  • Contact warden if plans change\n" \
                   f"  • Sign in when you're back\n\n" \
                   f"Safe travels!"
        
        elif intent == 'maintenance_request':
            issue = entities.get('issue_description', 'your maintenance issue')
            urgency = entities.get('urgency', 'medium')
            
            urgency_priority = {'high': 'URGENT', 'medium': 'NORMAL', 'low': 'LOW'}
            urgency_time = {'high': '2-4 hours', 'medium': '24 hours', 'low': '2-3 days'}
            
            return f"Maintenance Scheduled!\n" \
                   f"─────────────────────\n" \
                   f"Issue: {issue}\n" \
                   f"Priority: {urgency_priority.get(urgency, 'NORMAL')}\n" \
                   f"Fix by: {urgency_time.get(urgency, '24 hours')}\n\n" \
                   f"What happens next:\n" \
                   f"  • Maintenance team notified\n" \
                   f"  • You'll get updates\n" \
                   f"  • Please keep room accessible\n\n" \
                   f"Thanks for letting us know!"
        
        elif intent == 'room_cleaning':
            return f"Cleaning Scheduled!\n" \
                   f"─────────────────────\n" \
                   f"Room {student.room_number} will get a fresh clean!\n\n" \
                   f"Details:\n" \
                   f"  • Done within 24 hours\n" \
                   f"  • Please unlock your room\n" \
                   f"  • Remove valuables\n\n" \
                   f"Your room will be sparkling!"
        
        else:
            return f"Your request has been approved! {approval_result.reasoning}"
    
    def _generate_smart_escalation_response(self, approval_result: AutoApprovalResult, 
                                          intent_result: IntentResult, student: Student) -> str:
        """Generate contextual escalation responses with enhanced formatting."""
        escalation_route = approval_result.escalation_route
        staff_role = escalation_route.staff_role if escalation_route else 'warden'
        
        intent = intent_result.intent
        
        if intent == 'guest_request':
            return f"Review Required\n" \
                   f"─────────────────────\n" \
                   f"Your guest request needs {staff_role} approval.\n\n" \
                   f"Reason:\n" \
                   f"{approval_result.reasoning}\n\n" \
                   f"Timeline:\n" \
                   f"  • {staff_role.title()} will review in 4 hours\n" \
                   f"  • SMS/Email notification\n" \
                   f"  • Contact warden if urgent\n\n" \
                   f"We'll update you soon!"
        
        elif intent == 'leave_request':
            return f"Review Required\n" \
                   f"─────────────────────\n" \
                   f"Your leave request needs {staff_role} approval.\n\n" \
                   f"Reason:\n" \
                   f"{approval_result.reasoning}\n\n" \
                   f"Timeline:\n" \
                   f"  • {staff_role.title()} will review tomorrow\n" \
                   f"  • Don't book yet (pending approval)\n" \
                   f"  • Confirmation via SMS/Email\n\n" \
                   f"Thanks for being patient!"
        
        else:
            return f"Manual Review Required - Your request has been forwarded to the {staff_role}.\n\n" \
                   f"Reason: {approval_result.reasoning}\n\n" \
                   f"You'll receive a response within 24 hours."
    
    def _generate_smart_rejection_response(self, approval_result: AutoApprovalResult, 
                                         intent_result: IntentResult, student: Student) -> str:
        """Generate contextual rejection responses with helpful guidance."""
        intent = intent_result.intent
        
        if intent == 'guest_request':
            return f"Guest Request Declined\n" \
                   f"─────────────────────\n" \
                   f"Reason:\n" \
                   f"{approval_result.reasoning}\n\n" \
                   f"Suggestions:\n" \
                   f"  • Resolve any recent violations\n" \
                   f"  • Try a shorter stay duration\n" \
                   f"  • Contact warden for alternatives\n\n" \
                   f"Need help? Visit the warden office!"
        
        elif intent == 'leave_request':
            return f"Leave Request Declined\n" \
                   f"─────────────────────\n" \
                   f"Reason:\n" \
                   f"{approval_result.reasoning}\n\n" \
                   f"Next Steps:\n" \
                   f"  • Contact warden to discuss\n" \
                   f"  • Provide additional docs if needed\n" \
                   f"  • Adjust your travel dates\n\n" \
                   f"Need help? Visit the warden office!"
        
        else:
            return f"Request Cannot Be Processed\n" \
                   f"─────────────────────\n" \
                   f"Reason:\n" \
                   f"{approval_result.reasoning}\n\n" \
                   f"Please contact the warden to discuss this decision."
    
    def _send_smart_notifications(self, intent_result: IntentResult, student: Student, 
                                approval_result: AutoApprovalResult):
        """Send smart notifications based on request type."""
        try:
            from .notification_service import notification_service
            
            intent = intent_result.intent
            entities = intent_result.entities
            
            if intent == 'guest_request':
                # Notify security about approved guest
                notification_service.notify_security_guest_approval(
                    student=student,
                    guest_name=entities.get('guest_name', 'Unknown Guest'),
                    start_date=entities.get('start_date'),
                    end_date=entities.get('end_date')
                )
            
            elif intent == 'maintenance_request':
                # Notify maintenance team
                notification_service.notify_maintenance_team(
                    student=student,
                    issue_description=entities.get('issue_description'),
                    urgency=entities.get('urgency', 'medium'),
                    room_number=entities.get('room_number', student.room_number)
                )
            
        except Exception as e:
            logger.warning(f"Failed to send smart notifications: {e}")
    
    def _notify_staff_with_context(self, intent_result: IntentResult, student: Student, 
                                 approval_result: AutoApprovalResult):
        """Notify staff with rich context information."""
        try:
            from .notification_service import notification_service
            
            context_info = {
                'student_name': student.name,
                'room_number': student.room_number,
                'intent': intent_result.intent,
                'entities': intent_result.entities,
                'escalation_reason': approval_result.reasoning,
                'confidence': intent_result.confidence,
                'timestamp': timezone.now().isoformat()
            }
            
            notification_service.notify_staff_escalation(
                staff_role=approval_result.escalation_route.staff_role if approval_result.escalation_route else 'warden',
                context_info=context_info
            )
            
        except Exception as e:
            logger.warning(f"Failed to notify staff with context: {e}")
    
    def _process_rule_inquiry(self, intent_result: IntentResult, message: Message, 
                            context: ConversationContext) -> ProcessingResult:
        """Process rule inquiry requests with smart explanations."""
        try:
            # Use Gemini to generate smart rule explanations
            if self.ai_engine.is_configured():
                rule_explanation = self.ai_engine.gemini_service.explain_rule(
                    message.content, 
                    {'student': message.sender.name, 'room': message.sender.room_number}
                )
            else:
                # Fallback rule explanations
                rule_explanation = self._get_fallback_rule_explanation(message.content.lower())
            
            # Add helpful follow-up suggestions
            follow_up_suggestions = self._get_rule_follow_up_suggestions(message.content.lower())
            
            response_message = f"📖 Hostel Rules & Policies\n\n{rule_explanation}"
            
            if follow_up_suggestions:
                response_message += f"\n\nRelated Actions:\n{follow_up_suggestions}"
            
            response_message += f"\n\nNeed More Help? Ask me about specific situations or contact the warden office."
            
            return ProcessingResult(
                status=ProcessingStatus.SUCCESS,
                response_message=response_message,
                confidence=intent_result.confidence,
                intent_result=intent_result,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'request_type': 'rule_inquiry', 'explanation_provided': True}
            )
            
        except Exception as e:
            logger.error(f"Error processing rule inquiry: {e}")
            return ProcessingResult(
                status=ProcessingStatus.SUCCESS,
                response_message="I can help explain hostel rules! Please contact the warden office for detailed policy information, or ask me about specific situations like guest policies, leave procedures, or maintenance requests.",
                confidence=intent_result.confidence,
                intent_result=intent_result,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'request_type': 'rule_inquiry', 'fallback_used': True}
            )
    
    def _get_fallback_rule_explanation(self, message_lower: str) -> str:
        """Get fallback rule explanations for common queries."""
        
        if any(word in message_lower for word in ['guest', 'friend', 'visitor', 'stay']):
            return """Guest Policy:
- Auto-Approved: 1 night stays for students with clean records
- Requires Approval: Stays longer than 1 night
- Check-in: All guests must register at reception
- Timing: Guests allowed 6 AM - 11 PM
- Responsibility: Host student is responsible for guest behavior
- Maximum: 2 guests per room at any time"""
        
        elif any(word in message_lower for word in ['leave', 'absence', 'home', 'vacation']):
            return """Leave Policy:
- Auto-Approved: Up to 2 days with advance notice
- Requires Approval: Leaves longer than 2 days
- Notice: Minimum 24 hours advance notice required
- Security: Inform security before departure and upon return
- Room: Keep room locked and secure during absence
- Emergency: Contact warden if plans change"""
        
        elif any(word in message_lower for word in ['maintenance', 'repair', 'broken', 'fix']):
            return """Maintenance Policy:
- Reporting: Report issues immediately via chat or warden
- Emergency: Call warden directly for urgent issues (water leaks, electrical)
- Access: Be available to provide room access for repairs
- Damage: Student may be charged for intentional damage
- Timeline: Non-urgent repairs completed within 2-3 days
- Follow-up: Report if issue persists after repair"""
        
        elif any(word in message_lower for word in ['clean', 'housekeeping', 'room service']):
            return """Room Cleaning Policy:
- Frequency: Weekly cleaning service available
- Scheduling: Request via chat or warden office
- Preparation: Remove valuables and personal items
- Access: Provide room access during scheduled time
- Standards: Maintain basic cleanliness between services
- Special: Deep cleaning available on request"""
        
        elif any(word in message_lower for word in ['quiet', 'noise', 'hours', 'music']):
            return """Quiet Hours & Noise Policy:
- Quiet Hours: 10 PM - 6 AM in all areas
- Common Areas: Keep noise levels considerate at all times
- Music/TV: Use headphones during quiet hours
- Guests: Host responsible for guest noise levels
- Violations: Repeated violations may result in warnings
- Emergency: Contact security for noise complaints"""
        
        elif any(word in message_lower for word in ['wifi', 'internet', 'password']):
            return """Internet & WiFi Policy:
- Access: Free WiFi available in all areas
- Network: Connect to 'HostelWiFi' network
- Password: Available at reception or from warden
- Usage: Fair usage policy applies
- Issues: Report connectivity problems to maintenance
- Security: Do not share network credentials"""
        
        else:
            return """General Hostel Policies:
- Check-in/out: Follow designated timings
- Visitors: All guests must be registered
- Quiet Hours: 10 PM - 6 AM
- Cleanliness: Maintain personal and common area hygiene
- Safety: Report security concerns immediately
- Respect: Be considerate of fellow residents

For specific questions, ask about guest policies, leave procedures, maintenance, or cleaning services."""
    
    def _get_rule_follow_up_suggestions(self, message_lower: str) -> str:
        """Get follow-up action suggestions based on rule inquiry."""
        
        if any(word in message_lower for word in ['guest', 'friend', 'visitor']):
            return "• Say 'My friend [name] will stay tonight' to request guest permission\n• Ask 'Can my friend stay for 3 days?' for longer stays"
        
        elif any(word in message_lower for word in ['leave', 'absence', 'home']):
            return "• Say 'I want to request leave from [date] to [date]' to apply\n• Ask 'I need emergency leave' for urgent situations"
        
        elif any(word in message_lower for word in ['maintenance', 'repair', 'broken']):
            return "• Say 'My [item] is not working' to report issues\n• Ask 'Emergency maintenance needed' for urgent repairs"
        
        elif any(word in message_lower for word in ['clean', 'housekeeping']):
            return "• Say 'Please clean my room' to schedule cleaning\n• Ask 'When is the next cleaning day?' for schedules"
        
        return "• Try asking about specific situations\n• Say 'I want to request...' for any hostel services"
    
    def _process_general_query(self, intent_result: IntentResult, message: Message, 
                             context: ConversationContext) -> ProcessingResult:
        """Process general queries."""
        # Try to provide a more helpful response based on the message content
        message_lower = message.content.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey']):
            response_message = "Hello! I'm your AI hostel assistant. I can help you with:\n" \
                              "• Guest permission requests\n" \
                              "• Leave applications\n" \
                              "• Maintenance issues\n" \
                              "• Room cleaning requests\n" \
                              "• Hostel rules and policies\n\n" \
                              "Just tell me what you need in natural language!"
        elif any(word in message_lower for word in ['help', 'what can you do']):
            response_message = "I can help you with various hostel requests:\n\n" \
                              "Guest Requests: \"My friend will stay tonight\"\n" \
                              "Leave Requests: \"I need leave for 2 days\"\n" \
                              "Maintenance: \"My AC is not working\"\n" \
                              "Room Cleaning: \"Please clean my room\"\n" \
                              "Rules: \"What are the guest policies?\"\n\n" \
                              "Just describe what you need!"
        else:
            response_message = "I understand you have a question. Could you please be more specific? For example:\n" \
                              "• \"My friend wants to stay tonight\" (for guest requests)\n" \
                              "• \"I need leave for 2 days\" (for absence requests)\n" \
                              "• \"My AC is broken\" (for maintenance issues)\n" \
                              "• \"Can you explain the guest policy?\" (for rule questions)"
        
        return ProcessingResult(
            status=ProcessingStatus.SUCCESS,
            response_message=response_message,
            confidence=intent_result.confidence,
            intent_result=intent_result,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=False,  # Don't require follow-up for general queries
            metadata={'request_type': 'general_query', 'helpful_response': True}
        )
    
    def _handle_follow_up_message(self, message: Message, context: ConversationContext) -> ProcessingResult:
        """Handle follow-up messages in ongoing conversations."""
        # Simplified - just treat as regular student message since followup bot is simplified
        return self.handle_student_message(message, context)
    
    def _handle_clarification_message(self, message: Message, context: ConversationContext) -> ProcessingResult:
        """Handle clarification responses from users with enhanced conversational flow."""
        try:
            # Check if we're awaiting confirmation for any request type
            user_response = message.content.strip().upper()
            
            # Handle YES/NO confirmation responses
            if context.context_data.get('leave_request_step') == 'awaiting_confirmation':
                if user_response in ['YES', 'Y', 'CONFIRM', 'OK']:
                    return self._process_complete_leave_request(
                        context.context_data.get('leave_request_data', {}), message, context
                    )
                elif user_response in ['NO', 'N', 'CANCEL']:
                    # Clear the context and ask what they'd like to change
                    context.context_data.pop('leave_request_data', None)
                    context.context_data.pop('leave_request_step', None)
                    return ProcessingResult(
                        status=ProcessingStatus.SUCCESS,
                        response_message="Leave request cancelled. Feel free to make a new request anytime.",
                        confidence=1.0,
                        intent_result=None,
                        approval_result=None,
                        conversation_context=context,
                        requires_follow_up=False,
                        metadata={'action': 'cancelled'}
                    )
            
            elif context.context_data.get('guest_request_step') == 'awaiting_confirmation':
                if user_response in ['YES', 'Y', 'CONFIRM', 'OK']:
                    return self._process_complete_guest_request(
                        context.context_data.get('guest_request_data', {}), message, context
                    )
                elif user_response in ['NO', 'N', 'CANCEL']:
                    context.context_data.pop('guest_request_data', None)
                    context.context_data.pop('guest_request_step', None)
                    return ProcessingResult(
                        status=ProcessingStatus.SUCCESS,
                        response_message="Guest request cancelled. Feel free to make a new request anytime.",
                        confidence=1.0,
                        intent_result=None,
                        approval_result=None,
                        conversation_context=context,
                        requires_follow_up=False,
                        metadata={'action': 'cancelled'}
                    )
            
            elif context.context_data.get('maintenance_request_step') == 'awaiting_confirmation':
                if user_response in ['YES', 'Y', 'CONFIRM', 'OK']:
                    return self._process_complete_maintenance_request(
                        context.context_data.get('maintenance_request_data', {}), message, context
                    )
                elif user_response in ['NO', 'N', 'CANCEL']:
                    context.context_data.pop('maintenance_request_data', None)
                    context.context_data.pop('maintenance_request_step', None)
                    return ProcessingResult(
                        status=ProcessingStatus.SUCCESS,
                        response_message="Maintenance request cancelled. Feel free to make a new request anytime.",
                        confidence=1.0,
                        intent_result=None,
                        approval_result=None,
                        conversation_context=context,
                        requires_follow_up=False,
                        metadata={'action': 'cancelled'}
                    )
            
            # Get the last intent from context to understand what we were asking about
            if context and context.intent_history:
                last_intent_data = context.intent_history[-1]
                last_intent = last_intent_data.get('intent')
                
                # Check if we're in a specific conversational flow
                if context.context_data.get('leave_request_step'):
                    return self._handle_leave_request_followup(message, context)
                elif context.context_data.get('guest_request_step'):
                    return self._handle_guest_request_followup(message, context)
                elif context.context_data.get('maintenance_request_step'):
                    return self._handle_maintenance_request_followup(message, context)
                
                # If no specific flow, try to extract what the user is responding with
                # Use AI to understand the response in context
                user_context = self._build_user_context(message.sender, context)
                
                # Add context about what we were asking for
                combined_content = f"Previous conversation context: {last_intent}. Previous entities: {last_intent_data.get('entities', {})}. User's response: {message.content}"
                
                # Extract intent with enhanced context
                intent_result = self.ai_engine.extract_intent(combined_content, user_context)
                
                # Update conversation context
                context.intent_history.append(intent_result.to_dict())
                context.last_message_id = str(message.message_id)
                context.updated_at = timezone.now()
                
                # If we now have enough information, process the request
                if not intent_result.requires_clarification:
                    # Process the complete request
                    if intent_result.intent in ['guest_request', 'leave_request', 'maintenance_request', 'room_cleaning']:
                        return self._process_actionable_request(intent_result, message, context)
                    else:
                        return self._process_general_query(intent_result, message, context)
                else:
                    # Still need more clarification
                    return self._handle_clarification_needed(intent_result, message, context)
            else:
                # No context available, treat as new message
                return self.handle_student_message(message, context)
                
        except Exception as e:
            logger.error(f"Error handling clarification message: {e}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                response_message="I encountered an error processing your response. Please try again.",
                confidence=0.0,
                intent_result=None,
                approval_result=None,
                conversation_context=context,
                requires_follow_up=False,
                metadata={'error': str(e)}
            )
    
    def _handle_leave_request_followup(self, message: Message, context: ConversationContext) -> ProcessingResult:
        """Handle follow-up responses for leave requests with improved date parsing and conversation state tracking."""
        step = context.context_data.get('leave_request_step')
        leave_data = context.context_data.get('leave_request_data', {})
        
        # Parse the user's response based on the current step
        user_response = message.content.strip()
        
        # Use the followup bot to extract data from the response
        extracted_data = followup_bot_service.extract_response_data(
            user_response, 
            'leave_request',
            step or 'unknown'
        )
        
        # Merge extracted data with existing data
        leave_data.update(extracted_data)
        context.context_data['leave_request_data'] = leave_data
        
        # Determine next step and check if we need more information
        next_step = followup_bot_service.get_next_conversation_step('leave_request', leave_data)
        context.context_data['leave_request_step'] = next_step
        
        # If we have all required information, process the request
        if next_step == 'complete':
            # Clear the conversation context since we're done
            context.context_data.pop('leave_request_data', None)
            context.context_data.pop('leave_request_step', None)
            
            # Process the complete request
            complete_intent_result = IntentResult(
                intent='leave_request',
                entities=leave_data,
                confidence=0.9,
                requires_clarification=False,
                missing_info=[]
            )
            return self._process_actionable_request(complete_intent_result, message, context)
        
        # Otherwise, ask for the next piece of information
        clarification_question = followup_bot_service.generate_clarification_question(
            IntentResult(
                intent='leave_request',
                entities=leave_data,
                confidence=0.8,
                requires_clarification=True,
                missing_info=[]
            ),
            leave_data
        )
        
        return ProcessingResult(
            status=ProcessingStatus.REQUIRES_CLARIFICATION,
            response_message=clarification_question,
            confidence=0.8,
            intent_result=None,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=True,
            metadata={'step': next_step, 'collected_data': leave_data}
        )
    
    def _handle_guest_request_followup(self, message: Message, context: ConversationContext) -> ProcessingResult:
        """Handle follow-up responses for guest requests with improved conversation state tracking."""
        step = context.context_data.get('guest_request_step')
        guest_data = context.context_data.get('guest_request_data', {})
        
        user_response = message.content.strip()
        
        # Use the followup bot to extract data from the response
        extracted_data = followup_bot_service.extract_response_data(
            user_response, 
            'guest_request',
            step or 'unknown'
        )
        
        # Merge extracted data with existing data
        guest_data.update(extracted_data)
        context.context_data['guest_request_data'] = guest_data
        
        # Determine next step
        next_step = followup_bot_service.get_next_conversation_step('guest_request', guest_data)
        context.context_data['guest_request_step'] = next_step
        
        # If we have all required information, process the request
        if next_step == 'complete':
            # Clear the conversation context since we're done
            context.context_data.pop('guest_request_data', None)
            context.context_data.pop('guest_request_step', None)
            
            # Process the complete request
            complete_intent_result = IntentResult(
                intent='guest_request',
                entities=guest_data,
                confidence=0.9,
                requires_clarification=False,
                missing_info=[]
            )
            return self._process_actionable_request(complete_intent_result, message, context)
        
        # Ask for next piece of information
        clarification_question = followup_bot_service.generate_clarification_question(
            IntentResult(
                intent='guest_request',
                entities=guest_data,
                confidence=0.8,
                requires_clarification=True,
                missing_info=[]
            ),
            guest_data
        )
        
        return ProcessingResult(
            status=ProcessingStatus.REQUIRES_CLARIFICATION,
            response_message=clarification_question,
            confidence=0.8,
            intent_result=None,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=True,
            metadata={'step': next_step, 'collected_data': guest_data}
        )
    
    def _handle_maintenance_request_followup(self, message: Message, context: ConversationContext) -> ProcessingResult:
        """Handle follow-up responses for maintenance requests with improved conversation state tracking."""
        step = context.context_data.get('maintenance_request_step')
        maintenance_data = context.context_data.get('maintenance_request_data', {})
        
        user_response = message.content.strip()
        
        # Use the followup bot to extract data from the response
        extracted_data = followup_bot_service.extract_response_data(
            user_response, 
            'maintenance_request',
            step or 'unknown'
        )
        
        # Merge extracted data with existing data
        maintenance_data.update(extracted_data)
        context.context_data['maintenance_request_data'] = maintenance_data
        
        # Determine next step
        next_step = followup_bot_service.get_next_conversation_step('maintenance_request', maintenance_data)
        context.context_data['maintenance_request_step'] = next_step
        
        # If we have all required information, process the request
        if next_step == 'complete':
            # Clear the conversation context since we're done
            context.context_data.pop('maintenance_request_data', None)
            context.context_data.pop('maintenance_request_step', None)
            
            # Process the complete request
            complete_intent_result = IntentResult(
                intent='maintenance_request',
                entities=maintenance_data,
                confidence=0.9,
                requires_clarification=False,
                missing_info=[]
            )
            return self._process_actionable_request(complete_intent_result, message, context)
        
        # Ask for next piece of information
        clarification_question = followup_bot_service.generate_clarification_question(
            IntentResult(
                intent='maintenance_request',
                entities=maintenance_data,
                confidence=0.8,
                requires_clarification=True,
                missing_info=[]
            ),
            maintenance_data
        )
        
        return ProcessingResult(
            status=ProcessingStatus.REQUIRES_CLARIFICATION,
            response_message=clarification_question,
            confidence=0.8,
            intent_result=None,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=True,
            metadata={'step': next_step, 'collected_data': maintenance_data}
        )
    
    def _parse_date_from_text(self, text: str) -> Optional[str]:
        """Parse date from natural language text with improved handling."""
        from datetime import datetime, timedelta
        import re
        
        text_lower = text.lower().strip()
        today = timezone.now().date()
        
        # Handle common date expressions
        if text_lower in ['today', 'now', 'tonight']:
            return today.strftime('%Y-%m-%d')
        elif text_lower in ['tomorrow', 'tmrw', 'tommorow', 'tomo']:
            return (today + timedelta(days=1)).strftime('%Y-%m-%d')
        elif text_lower in ['day after tomorrow', 'day after tmrw', 'overmorrow']:
            return (today + timedelta(days=2)).strftime('%Y-%m-%d')
        elif 'next week' in text_lower:
            return (today + timedelta(days=7)).strftime('%Y-%m-%d')
        elif 'this weekend' in text_lower:
            days_until_saturday = (5 - today.weekday()) % 7
            if days_until_saturday == 0:
                days_until_saturday = 7
            return (today + timedelta(days=days_until_saturday)).strftime('%Y-%m-%d')
        
        # Handle weekday names
        weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        for i, day in enumerate(weekdays):
            if day in text_lower:
                # Calculate days until next occurrence of this weekday
                target_weekday = i
                current_weekday = today.weekday()
                days_ahead = target_weekday - current_weekday
                
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                
                # Check if "next" is mentioned
                if 'next' in text_lower and days_ahead < 7:
                    days_ahead += 7
                    
                return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
        
        # Handle month + day patterns (e.g., "january 15", "feb 1st", "1 feb")
        month_names = {
            'jan': 1, 'january': 1,
            'feb': 2, 'february': 2,
            'mar': 3, 'march': 3,
            'apr': 4, 'april': 4,
            'may': 5,
            'jun': 6, 'june': 6,
            'jul': 7, 'july': 7,
            'aug': 8, 'august': 8,
            'sep': 9, 'sept': 9, 'september': 9,
            'oct': 10, 'october': 10,
            'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
        }
        
        # Pattern: "january 15" or "15 january" or "jan 15th"
        for month_name, month_num in month_names.items():
            # Month first: "january 15"
            pattern1 = rf'{month_name}\s+(\d{{1,2}})(?:st|nd|rd|th)?'
            match = re.search(pattern1, text_lower)
            if match:
                day = int(match.group(1))
                try:
                    year = today.year
                    date_obj = datetime(year, month_num, day).date()
                    # If the date is in the past, assume next year
                    if date_obj < today:
                        date_obj = datetime(year + 1, month_num, day).date()
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            # Day first: "15 january"
            pattern2 = rf'(\d{{1,2}})(?:st|nd|rd|th)?\s+{month_name}'
            match = re.search(pattern2, text_lower)
            if match:
                day = int(match.group(1))
                try:
                    year = today.year
                    date_obj = datetime(year, month_num, day).date()
                    if date_obj < today:
                        date_obj = datetime(year + 1, month_num, day).date()
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
        
        # Try to parse specific date formats
        date_patterns = [
            (r'(\d{4})-(\d{1,2})-(\d{1,2})', 'YMD'),  # 2026-01-30
            (r'(\d{1,2})-(\d{1,2})-(\d{4})', 'DMY'),  # 30-01-2026
            (r'(\d{1,2})/(\d{1,2})/(\d{4})', 'DMY'),  # 30/01/2026
            (r'(\d{1,2})/(\d{1,2})/(\d{2})', 'DMY2'), # 30/01/26
            (r'(\d{1,2})-(\d{1,2})', 'DM'),           # 30-01 or 01-30
            (r'(\d{1,2})/(\d{1,2})', 'DM'),           # 30/01 or 01/30
        ]
        
        for pattern, format_type in date_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    if format_type == 'YMD':
                        year, month, day = match.groups()
                        date_obj = datetime(int(year), int(month), int(day)).date()
                    elif format_type in ['DMY', 'DMY2']:
                        day, month, year = match.groups()
                        if format_type == 'DMY2' and len(year) == 2:
                            year = '20' + year
                        date_obj = datetime(int(year), int(month), int(day)).date()
                    elif format_type == 'DM':
                        # Ambiguous: could be DD-MM or MM-DD
                        # Try DD-MM first (more common internationally)
                        try:
                            day, month = match.groups()
                            year = today.year
                            date_obj = datetime(year, int(month), int(day)).date()
                            if date_obj < today:
                                date_obj = datetime(year + 1, int(month), int(day)).date()
                        except ValueError:
                            # Try MM-DD format
                            month, day = match.groups()
                            year = today.year
                            date_obj = datetime(year, int(month), int(day)).date()
                            if date_obj < today:
                                date_obj = datetime(year + 1, int(month), int(day)).date()
                    
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
        
        # Try parsing relative dates like "in 3 days"
        relative_match = re.search(r'in\s+(\d+)\s+days?', text_lower)
        if relative_match:
            days = int(relative_match.group(1))
            return (today + timedelta(days=days)).strftime('%Y-%m-%d')
        
        # Try "after X days"
        after_match = re.search(r'after\s+(\d+)\s+days?', text_lower)
        if after_match:
            days = int(after_match.group(1))
            return (today + timedelta(days=days)).strftime('%Y-%m-%d')
        
        return None


    def _parse_duration_from_text(self, text: str) -> Optional[int]:
        """Parse duration in days from natural language text."""
        import re
        
        text_lower = text.lower().strip()
        
        # Handle common duration expressions
        duration_patterns = [
            (r'(\d+)\s*days?', 1),
            (r'(\d+)\s*day', 1),
            (r'for\s+(\d+)\s*days?', 1),
            (r'(\d+)d', 1),
            (r'a\s+day', lambda: 1),
            (r'one\s+day', lambda: 1),
            (r'(\d+)\s*nights?', 1),
            (r'a\s+night', lambda: 1),
            (r'one\s+night', lambda: 1),
            (r'a\s+week', lambda: 7),
            (r'one\s+week', lambda: 7),
            (r'(\d+)\s*weeks?', 7),
        ]
        
        for pattern, multiplier in duration_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    if callable(multiplier):
                        return multiplier()
                    else:
                        num = int(match.group(1))
                        return num * multiplier
                except (ValueError, IndexError):
                    continue
        
        # Handle word numbers
        word_numbers = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'a': 1, 'an': 1
        }
        
        for word, num in word_numbers.items():
            if f'{word} day' in text_lower or f'{word} night' in text_lower:
                return num
            if f'{word} week' in text_lower:
                return num * 7
        
        return None

    
    def _handle_unknown_message(self, message: Message, context: ConversationContext) -> ProcessingResult:
        """Handle unknown or unclassifiable messages."""
        return ProcessingResult(
            status=ProcessingStatus.FAILED,
            response_message="I'm not sure how to help with that. Could you please rephrase your request or contact staff for assistance?",
            confidence=0.0,
            intent_result=None,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=False,
            metadata={'message_type': 'unknown'}
        )
    
    def _handle_unknown_intent(self, intent_result: IntentResult, message: Message, 
                             context: ConversationContext) -> ProcessingResult:
        """Handle messages with unknown intent."""
        return ProcessingResult(
            status=ProcessingStatus.FAILED,
            response_message="I couldn't understand your request. Please try rephrasing or contact staff for help.",
            confidence=intent_result.confidence,
            intent_result=intent_result,
            approval_result=None,
            conversation_context=context,
            requires_follow_up=False,
            metadata={'intent': intent_result.intent}
        )
    
    def _generate_approval_response(self, approval_result: AutoApprovalResult, intent_result: IntentResult) -> str:
        """Generate response message for approved requests."""
        intent = intent_result.intent
        entities = intent_result.entities
        
        if intent == 'guest_request':
            guest_name = entities.get('guest_name', 'your guest')
            start_date = entities.get('start_date', 'the requested date')
            return f"✅ Your guest request for {guest_name} on {start_date} has been approved! " \
                   f"Security has been notified. Please ensure your guest follows all hostel rules."
        
        elif intent == 'leave_request':
            start_date = entities.get('start_date', 'your departure date')
            end_date = entities.get('end_date', 'your return date')
            return f"✅ Your leave request from {start_date} to {end_date} has been approved! " \
                   f"Have a safe trip and remember to inform security before leaving."
        
        elif intent == 'maintenance_request':
            issue = entities.get('issue_description', 'your maintenance issue')
            return f"✅ Your maintenance request for '{issue}' has been scheduled! " \
                   f"Maintenance team will address this within 24 hours."
        
        elif intent == 'room_cleaning':
            return f"✅ Your room cleaning request has been scheduled! " \
                   f"Housekeeping will clean your room during the next available slot."
        
        else:
            return f"Your request has been approved! {approval_result.reasoning}"
    
    def _generate_escalation_response(self, approval_result: AutoApprovalResult, intent_result: IntentResult) -> str:
        """Generate response message for escalated requests."""
        escalation_route = approval_result.escalation_route
        staff_role = escalation_route.staff_role if escalation_route else 'staff'
        
        return f"📋 Your request has been forwarded to the {staff_role} for review. " \
               f"You will receive a response within 24 hours. " \
               f"Reason: {approval_result.reasoning}"
    
    def _generate_rejection_response(self, approval_result: AutoApprovalResult, intent_result: IntentResult) -> str:
        """Generate response message for rejected requests."""
        return f"❌ Your request cannot be processed. " \
               f"Reason: {approval_result.reasoning} " \
               f"Please contact the warden if you need to discuss this decision."
    
    def _cleanup_expired_contexts(self):
        """Clean up expired conversation contexts."""
        try:
            current_time = timezone.now()
            expired_keys = []
            
            for key, context in self._conversation_contexts.items():
                if (current_time - context.updated_at).total_seconds() > self.CONTEXT_TIMEOUT_HOURS * 3600:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._conversation_contexts[key]
                
            if expired_keys:
                logger.info(f"Cleaned up {len(expired_keys)} expired conversation contexts")
                
        except Exception as e:
            logger.error(f"Error cleaning up expired contexts: {e}")
    
    def process_completed_followup(self, conversation_id: str) -> ProcessingResult:
        """Process a completed follow-up conversation by executing the original request."""
        return ProcessingResult(
            status=ProcessingStatus.FAILED,
            response_message="Follow-up processing not available in simplified mode.",
            confidence=0.0,
            intent_result=None,
            approval_result=None,
            conversation_context=None,
            requires_follow_up=False,
            metadata={'error': 'simplified_mode'}
        )
    
    def _log_message_processing(self, message: Message, result: ProcessingResult):
        """Log message processing for audit trail."""
        try:
            decision_mapping = {
                ProcessingStatus.SUCCESS: 'processed',
                ProcessingStatus.REQUIRES_CLARIFICATION: 'processed',
                ProcessingStatus.ESCALATED: 'escalated',
                ProcessingStatus.FAILED: 'failed',
                ProcessingStatus.REJECTED: 'rejected'
            }
            
            decision = decision_mapping.get(result.status, 'processed')
            
            AuditLog.objects.create(
                action_type='message_processing',
                entity_type='message',
                entity_id=str(message.message_id),
                decision=decision,
                reasoning=f"Message processed with status: {result.status.value}",
                confidence_score=result.confidence,
                rules_applied=['message_routing'],
                user_id=message.sender.student_id,
                user_type='student',
                metadata={
                    'message_content': message.content,
                    'intent_result': result.intent_result.to_dict() if result.intent_result else None,
                    'approval_result': result.approval_result.to_dict() if result.approval_result else None,
                    'response_message': result.response_message,
                    'requires_follow_up': result.requires_follow_up,
                    'processing_status': result.status.value
                }
            )
        except Exception as e:
            logger.error(f"Error logging message processing: {e}")

    def _create_database_record(self, intent_result: IntentResult, student: Student, 
                              approval_result: AutoApprovalResult, status: str = None) -> Dict[str, Any]:
        """Create database record for approved/pending requests."""
        try:
            from dateutil.parser import parse as parse_date
            
            intent = intent_result.intent
            entities = intent_result.entities
            
            if status is None:
                status = 'approved' if approval_result.approved else 'pending'
            
            if intent == 'guest_request':
                guest_request = GuestRequest.objects.create(
                    student=student,
                    guest_name=entities.get('guest_name', 'Unknown Guest'),
                    guest_phone=entities.get('guest_phone', ''),
                    start_date=parse_date(entities.get('start_date', timezone.now().isoformat())),
                    end_date=parse_date(entities.get('end_date', (timezone.now() + timedelta(hours=12)).isoformat())),
                    purpose=entities.get('purpose', ''),
                    status=status,
                    auto_approved=approval_result.approved,
                    approval_reason=approval_result.reasoning if approval_result.approved else None
                )
                
                return {
                    'type': 'guest_request',
                    'id': str(guest_request.request_id),
                    'guest_name': guest_request.guest_name,
                    'status': guest_request.status
                }
            
            elif intent == 'leave_request':
                from datetime import timedelta
                
                absence_record = AbsenceRecord.objects.create(
                    student=student,
                    start_date=parse_date(entities.get('start_date', timezone.now().isoformat())),
                    end_date=parse_date(entities.get('end_date', (timezone.now() + timedelta(days=1)).isoformat())),
                    reason=entities.get('reason', 'Personal'),
                    emergency_contact=entities.get('emergency_contact', ''),
                    status=status,
                    auto_approved=approval_result.approved,
                    approval_reason=approval_result.reasoning if approval_result.approved else None
                )
                
                # Generate digital pass if auto-approved
                digital_pass = None
                if approval_result.approved:
                    try:
                        from .leave_request_service import leave_request_service
                        from_date = absence_record.start_date.date()
                        to_date = absence_record.end_date.date()
                        total_days = (to_date - from_date).days + 1
                        
                        logger.info(f"Generating digital pass for chatbot leave request: student={student.student_id}, dates={from_date} to {to_date}")
                        
                        digital_pass = leave_request_service._generate_digital_pass(
                            student=student,
                            absence_record=absence_record,
                            from_date=from_date,
                            to_date=to_date,
                            total_days=total_days,
                            reason=absence_record.reason,
                            approval_type='auto'
                        )
                        
                        # Update security records
                        leave_request_service._update_security_records(student, digital_pass)
                        
                        logger.info(f"Digital pass {digital_pass.pass_number} generated for auto-approved leave request, pdf_generated={digital_pass.pdf_generated}")
                    except Exception as e:
                        import traceback
                        logger.error(f"Error generating digital pass for leave request: {e}")
                        logger.error(traceback.format_exc())
                
                result = {
                    'type': 'absence_record',
                    'id': str(absence_record.absence_id),
                    'reason': absence_record.reason,
                    'status': absence_record.status
                }
                
                if digital_pass:
                    result['digital_pass'] = {
                        'pass_number': digital_pass.pass_number,
                        'verification_code': digital_pass.verification_code
                    }
                
                return result
            
            elif intent == 'maintenance_request':
                maintenance_request = MaintenanceRequest.objects.create(
                    student=student,
                    room_number=entities.get('room_number', student.room_number),
                    issue_type=entities.get('issue_type', 'other'),
                    description=entities.get('issue_description', 'Maintenance required'),
                    priority=entities.get('urgency', 'medium'),
                    status='pending' if not approval_result.approved else 'assigned',
                    auto_approved=approval_result.approved
                )
                
                return {
                    'type': 'maintenance_request',
                    'id': str(maintenance_request.request_id),
                    'issue_type': maintenance_request.issue_type,
                    'status': maintenance_request.status
                }
            
            else:
                logger.warning(f"Unknown intent for database record creation: {intent}")
                return {'type': 'unknown', 'id': None, 'status': 'failed'}
                
        except Exception as e:
            logger.error(f"Error creating database record: {e}")
            return {'type': 'error', 'id': None, 'status': 'failed', 'error': str(e)}


# Global instance
message_router = MessageRouter()