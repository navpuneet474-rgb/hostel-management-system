"""
Auto-Approval Service for automated decision making on routine requests.
Handles auto-approval logic and escalation routing for complex cases.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from django.utils import timezone
from ..models import Student, GuestRequest, AbsenceRecord, AuditLog
from .rule_engine_service import rule_engine, ApprovalDecision, ValidationResult

logger = logging.getLogger(__name__)


class EscalationReason(Enum):
    """Reasons for escalating requests to manual review."""
    POLICY_VIOLATION = "policy_violation"
    COMPLEX_REQUEST = "complex_request"
    STUDENT_VIOLATIONS = "student_violations"
    INSUFFICIENT_INFORMATION = "insufficient_information"
    SYSTEM_ERROR = "system_error"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"


@dataclass
class EscalationRoute:
    """Escalation routing information."""
    staff_role: str
    priority: str  # 'low', 'medium', 'high', 'urgent'
    reason: EscalationReason
    additional_info: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'staff_role': self.staff_role,
            'priority': self.priority,
            'reason': self.reason.value,
            'additional_info': self.additional_info
        }


@dataclass
class AutoApprovalResult:
    """Result of auto-approval evaluation."""
    approved: bool
    decision_type: str  # 'auto_approved', 'escalated', 'rejected'
    reasoning: str
    confidence: float
    rules_applied: List[str]
    escalation_route: Optional[EscalationRoute]
    audit_data: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'approved': self.approved,
            'decision_type': self.decision_type,
            'reasoning': self.reasoning,
            'confidence': self.confidence,
            'rules_applied': self.rules_applied,
            'escalation_route': self.escalation_route.to_dict() if self.escalation_route else None,
            'audit_data': self.audit_data
        }


class AutoApprovalEngine:
    """
    Auto-Approval Engine for processing routine requests automatically.
    Implements auto-approval logic and escalation routing for complex cases.
    """
    
    # Auto-approval thresholds
    MIN_CONFIDENCE_THRESHOLD = 0.8
    AUTO_APPROVAL_ENABLED = True
    
    # Escalation routing rules
    ESCALATION_ROUTES = {
        'guest_request': {
            'default': {'role': 'warden', 'priority': 'medium'},
            'violations': {'role': 'warden', 'priority': 'high'},
            'emergency': {'role': 'security', 'priority': 'urgent'}
        },
        'leave_request': {
            'default': {'role': 'warden', 'priority': 'low'},
            'extended': {'role': 'warden', 'priority': 'medium'},
            'emergency': {'role': 'warden', 'priority': 'urgent'}
        },
        'maintenance_request': {
            'default': {'role': 'maintenance', 'priority': 'medium'},
            'emergency': {'role': 'maintenance', 'priority': 'urgent'},
            'complex': {'role': 'admin', 'priority': 'medium'}
        },
        'room_cleaning': {
            'default': {'role': 'maintenance', 'priority': 'low'},
            'special': {'role': 'maintenance', 'priority': 'medium'}
        }
    }
    
    def __init__(self):
        """Initialize the Auto-Approval Engine."""
        self.rule_engine = rule_engine
        logger.info("Auto-Approval Engine initialized")
    
    def evaluate_request(self, request_data: Dict[str, Any], request_type: str, student: Student) -> AutoApprovalResult:
        """
        Evaluate a request for auto-approval.
        
        Args:
            request_data: Request data dictionary
            request_type: Type of request ('guest_request', 'leave_request', etc.)
            student: Student making the request
            
        Returns:
            AutoApprovalResult with decision and routing information
        """
        try:
            # Get rule engine decision
            approval_decision = self.rule_engine.evaluate_auto_approval_criteria(
                request_data, request_type, student
            )
            
            # Check if auto-approval is enabled and confidence is sufficient
            if not self.AUTO_APPROVAL_ENABLED:
                return self._create_escalation_result(
                    approval_decision, 
                    EscalationReason.MANUAL_REVIEW_REQUIRED,
                    "Auto-approval is currently disabled",
                    request_type,
                    request_data
                )
            
            # SMART CONFIDENCE CHECK: Skip confidence threshold if all required fields are present
            # This allows requests that were confirmed via conversational flow to proceed
            # even if Gemini AI gives them lower confidence scores
            all_fields_present = self._check_all_required_fields_present(request_type, request_data)
            
            logger.info(f"[AUTO-APPROVAL] request_type={request_type}")
            logger.info(f"[AUTO-APPROVAL] request_data keys: {list(request_data.keys())}")
            logger.info(f"[AUTO-APPROVAL] confidence={approval_decision.confidence}, threshold={self.MIN_CONFIDENCE_THRESHOLD}, all_fields_present={all_fields_present}")
            
            if approval_decision.confidence < self.MIN_CONFIDENCE_THRESHOLD and not all_fields_present:
                logger.warning(f"[AUTO-APPROVAL] Escalating due to low confidence ({approval_decision.confidence}) AND missing fields")
                return self._create_escalation_result(
                    approval_decision,
                    EscalationReason.INSUFFICIENT_INFORMATION,
                    f"Confidence score ({approval_decision.confidence}) below threshold ({self.MIN_CONFIDENCE_THRESHOLD})",
                    request_type,
                    request_data
                )
            elif approval_decision.confidence < self.MIN_CONFIDENCE_THRESHOLD:
                logger.info(f"[AUTO-APPROVAL] Proceeding despite low confidence because all required fields ARE PRESENT")
            
            # Process based on decision type
            if approval_decision.decision_type == 'auto_approved':
                return self._create_auto_approval_result(approval_decision, request_type, student, request_data)
            elif approval_decision.decision_type == 'rejected':
                return self._create_rejection_result(approval_decision, request_type, request_data)
            else:  # escalated
                return self._create_escalation_result(
                    approval_decision,
                    EscalationReason.COMPLEX_REQUEST,
                    approval_decision.reasoning,
                    request_type,
                    request_data
                )
                
        except Exception as e:
            logger.error(f"Error evaluating request for auto-approval: {e}")
            return self._create_error_result(str(e), request_type, request_data)
    
    def create_guest_record(self, approved_request: Dict[str, Any], student: Student) -> Dict[str, Any]:
        """
        Create a guest record for an approved guest request.
        
        Args:
            approved_request: Approved guest request data
            student: Student who made the request
            
        Returns:
            Created guest record data
        """
        try:
            guest_request = GuestRequest.objects.create(
                student=student,
                guest_name=approved_request['guest_name'],
                guest_phone=approved_request.get('guest_phone', ''),
                start_date=self._parse_datetime(approved_request['start_date']),
                end_date=self._parse_datetime(approved_request['end_date']),
                purpose=approved_request.get('purpose', ''),
                status='approved',
                auto_approved=True,
                approval_reason='Auto-approved: meets all policy criteria'
            )
            
            # Log the creation
            self._log_guest_record_creation(guest_request, approved_request)
            
            return {
                'request_id': str(guest_request.request_id),
                'guest_name': guest_request.guest_name,
                'start_date': guest_request.start_date.isoformat(),
                'end_date': guest_request.end_date.isoformat(),
                'status': guest_request.status,
                'auto_approved': guest_request.auto_approved,
                'created_at': guest_request.created_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error creating guest record: {e}")
            raise
    
    def schedule_maintenance(self, maintenance_request: Dict[str, Any], student: Student) -> Dict[str, Any]:
        """
        Schedule a maintenance work order for an approved request.
        
        Args:
            maintenance_request: Approved maintenance request data
            student: Student who made the request
            
        Returns:
            Work order information
        """
        try:
            # Determine priority and scheduling
            urgency = maintenance_request.get('urgency', 'normal').lower()
            issue_type = maintenance_request.get('issue_type', 'general')
            
            if urgency == 'emergency':
                scheduled_date = timezone.now()
                priority = 'urgent'
            else:
                # Schedule for next business day
                scheduled_date = timezone.now() + timedelta(days=1)
                priority = 'medium'
            
            work_order = {
                'work_order_id': f"WO-{timezone.now().strftime('%Y%m%d')}-{student.student_id}",
                'student_id': student.student_id,
                'room_number': student.room_number,
                'issue_type': issue_type,
                'description': maintenance_request.get('description', ''),
                'urgency': urgency,
                'priority': priority,
                'scheduled_date': scheduled_date.isoformat(),
                'status': 'scheduled',
                'auto_scheduled': True,
                'created_at': timezone.now().isoformat()
            }
            
            # Log the work order creation
            self._log_maintenance_scheduling(work_order, maintenance_request)
            
            return work_order
            
        except Exception as e:
            logger.error(f"Error scheduling maintenance: {e}")
            raise
    
    def log_decision(self, decision: AutoApprovalResult, request_data: Dict[str, Any], student: Student) -> str:
        """
        Log the auto-approval decision to audit trail.
        
        Args:
            decision: Auto-approval decision result
            request_data: Original request data
            student: Student who made the request
            
        Returns:
            Audit log ID
        """
        try:
            audit_log = AuditLog.objects.create(
                action_type='auto_approval_decision',
                entity_type=decision.audit_data.get('entity_type', 'request'),
                entity_id=decision.audit_data.get('entity_id', 'unknown'),
                decision=decision.decision_type,
                reasoning=decision.reasoning,
                confidence_score=decision.confidence,
                rules_applied=decision.rules_applied,
                user_id=student.student_id,
                user_type='student',
                metadata={
                    'request_data': request_data,
                    'escalation_route': decision.escalation_route.to_dict() if decision.escalation_route else None,
                    'auto_approval_engine_version': '1.0'
                }
            )
            
            logger.info(f"Auto-approval decision logged: {audit_log.log_id}")
            return str(audit_log.log_id)
            
        except Exception as e:
            logger.error(f"Error logging auto-approval decision: {e}")
            return "logging_failed"
    
    def get_escalation_route(self, request_type: str, escalation_reason: EscalationReason, 
                           request_data: Dict[str, Any] = None) -> EscalationRoute:
        """
        Determine the appropriate escalation route for a request.
        
        Args:
            request_type: Type of request
            escalation_reason: Reason for escalation
            request_data: Additional request data for routing decisions
            
        Returns:
            EscalationRoute with routing information
        """
        try:
            routes = self.ESCALATION_ROUTES.get(request_type, {})
            
            # Determine specific route based on reason and request data
            if escalation_reason == EscalationReason.STUDENT_VIOLATIONS:
                route_key = 'violations'
            elif request_data and request_data.get('urgency') == 'emergency':
                route_key = 'emergency'
            elif request_type == 'leave_request' and request_data:
                duration = request_data.get('duration_days', 0)
                route_key = 'extended' if duration > 7 else 'default'
            elif request_type == 'maintenance_request' and request_data:
                complexity = request_data.get('complexity', 'simple')
                route_key = 'complex' if complexity == 'complex' else 'default'
            elif request_type == 'room_cleaning' and request_data:
                cleaning_type = request_data.get('cleaning_type', 'regular')
                route_key = 'special' if cleaning_type != 'regular' else 'default'
            else:
                route_key = 'default'
            
            route_config = routes.get(route_key, routes.get('default', {'role': 'warden', 'priority': 'medium'}))
            
            return EscalationRoute(
                staff_role=route_config['role'],
                priority=route_config['priority'],
                reason=escalation_reason,
                additional_info={
                    'request_type': request_type,
                    'route_key': route_key,
                    'timestamp': timezone.now().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Error determining escalation route: {e}")
            return EscalationRoute(
                staff_role='warden',
                priority='medium',
                reason=EscalationReason.SYSTEM_ERROR,
                additional_info={'error': str(e)}
            )
    
    @staticmethod
    def _check_all_required_fields_present(request_type: str, request_data: Dict[str, Any]) -> bool:
        """
        Check if all required fields for a request type are present.
        This is used to bypass confidence threshold checks when all required info is confirmed.
        
        Args:
            request_type: Type of request ('guest_request', 'leave_request', etc.)
            request_data: Request data dictionary
            
        Returns:
            True if all required fields are present, False otherwise
        """
        required_fields = {
            'guest_request': ['guest_name', 'start_date', 'end_date'],
            'leave_request': ['start_date', 'end_date', 'reason'],
            'maintenance_request': ['problem_description', 'location'],
            'room_cleaning': ['room_number']
        }
        
        # Get required fields for this request type
        if request_type not in required_fields:
            return False
        
        fields = required_fields[request_type]
        
        # Check if all required fields are present and non-empty
        for field in fields:
            value = request_data.get(field)
            # Accept if field exists and is not None/empty
            if not value or (isinstance(value, str) and not value.strip()):
                logger.debug(f"Missing required field '{field}' for {request_type}: {value}")
                return False
        
        logger.debug(f"All required fields present for {request_type}: {fields}")
        return True
    
    def _create_auto_approval_result(self, approval_decision: ApprovalDecision, request_type: str, 
                                   student: Student, request_data: Dict[str, Any]) -> AutoApprovalResult:
        """Create result for auto-approved requests."""
        return AutoApprovalResult(
            approved=True,
            decision_type='auto_approved',
            reasoning=approval_decision.reasoning,
            confidence=approval_decision.confidence,
            rules_applied=approval_decision.rules_applied,
            escalation_route=None,
            audit_data={
                'entity_type': request_type,
                'entity_id': f"{student.student_id}-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                'auto_approved': True,
                'processing_time': timezone.now().isoformat()
            }
        )
    
    def _create_rejection_result(self, approval_decision: ApprovalDecision, request_type: str, 
                               request_data: Dict[str, Any]) -> AutoApprovalResult:
        """Create result for rejected requests."""
        return AutoApprovalResult(
            approved=False,
            decision_type='rejected',
            reasoning=approval_decision.reasoning,
            confidence=approval_decision.confidence,
            rules_applied=approval_decision.rules_applied,
            escalation_route=None,
            audit_data={
                'entity_type': request_type,
                'entity_id': f"rejected-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                'rejected': True,
                'processing_time': timezone.now().isoformat()
            }
        )
    
    def _create_escalation_result(self, approval_decision: ApprovalDecision, escalation_reason: EscalationReason,
                                reason_detail: str, request_type: str, request_data: Dict[str, Any]) -> AutoApprovalResult:
        """Create result for escalated requests."""
        escalation_route = self.get_escalation_route(request_type, escalation_reason, request_data)
        
        # Send email notification to wardens for escalated requests
        try:
            from .notification_service import notification_service
            
            # Extract student information from request data
            student_info = {
                'name': request_data.get('student_name', 'Unknown'),
                'student_id': request_data.get('student_id', 'Unknown'),
                'room_number': request_data.get('room_number', 'Unknown'),
                'block': request_data.get('block', 'Unknown'),
                'phone': request_data.get('phone', 'Not provided')
            }
            
            # Send escalation notification
            notification_service.send_escalated_request_notification(
                request_type=request_type,
                request_details=request_data,
                student_info=student_info
            )
            
            logger.info(f"Escalation notification sent for {request_type} request from student {student_info['student_id']}")
            
        except Exception as e:
            logger.error(f"Failed to send escalation notification: {str(e)}")
            # Don't fail the escalation if notification fails
        
        return AutoApprovalResult(
            approved=False,
            decision_type='escalated',
            reasoning=f"{reason_detail}. Escalated to {escalation_route.staff_role}",
            confidence=approval_decision.confidence,
            rules_applied=approval_decision.rules_applied,
            escalation_route=escalation_route,
            audit_data={
                'entity_type': request_type,
                'entity_id': f"escalated-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                'escalated': True,
                'escalation_reason': escalation_reason.value,
                'processing_time': timezone.now().isoformat()
            }
        )
    
    def _create_error_result(self, error_message: str, request_type: str, request_data: Dict[str, Any]) -> AutoApprovalResult:
        """Create result for processing errors."""
        escalation_route = self.get_escalation_route(request_type, EscalationReason.SYSTEM_ERROR, request_data)
        
        return AutoApprovalResult(
            approved=False,
            decision_type='escalated',
            reasoning=f"Processing error: {error_message}. Escalated for manual review",
            confidence=0.0,
            rules_applied=['system_error'],
            escalation_route=escalation_route,
            audit_data={
                'entity_type': request_type,
                'entity_id': f"error-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                'error': True,
                'error_message': error_message,
                'processing_time': timezone.now().isoformat()
            }
        )
    
    def _parse_datetime(self, date_input: Any) -> datetime:
        """Parse datetime input with error handling."""
        if isinstance(date_input, datetime):
            return date_input
        elif isinstance(date_input, str):
            formats = [
                '%Y-%m-%dT%H:%M:%S.%f%z',  # ISO with microseconds and timezone
                '%Y-%m-%dT%H:%M:%S%z',     # ISO with timezone
                '%Y-%m-%dT%H:%M:%S.%f',    # ISO with microseconds
                '%Y-%m-%dT%H:%M:%S',       # ISO basic
                '%Y-%m-%d %H:%M:%S', 
                '%Y-%m-%d'
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_input, fmt)
                except ValueError:
                    continue
            
            # Try parsing ISO format with timezone info
            try:
                from dateutil import parser
                return parser.parse(date_input)
            except:
                pass
                
        raise ValueError(f"Unable to parse datetime: {date_input}")
    
    def _log_guest_record_creation(self, guest_request: GuestRequest, request_data: Dict[str, Any]):
        """Log guest record creation for audit trail."""
        try:
            AuditLog.objects.create(
                action_type='guest_approval',
                entity_type='guest_request',
                entity_id=str(guest_request.request_id),
                decision='approved',
                reasoning='Auto-approved guest request - meets all policy criteria',
                confidence_score=1.0,
                rules_applied=['guest_duration_limit', 'student_record_check', 'advance_notice_requirement'],
                user_id=guest_request.student.student_id,
                user_type='student',
                metadata={
                    'guest_name': guest_request.guest_name,
                    'duration_days': guest_request.duration_days,
                    'auto_approved': True,
                    'original_request': request_data
                }
            )
        except Exception as e:
            logger.error(f"Error logging guest record creation: {e}")
    
    def _log_maintenance_scheduling(self, work_order: Dict[str, Any], request_data: Dict[str, Any]):
        """Log maintenance scheduling for audit trail."""
        try:
            AuditLog.objects.create(
                action_type='system_action',
                entity_type='maintenance_request',
                entity_id=work_order['work_order_id'],
                decision='processed',
                reasoning='Auto-scheduled maintenance request',
                confidence_score=1.0,
                rules_applied=['basic_maintenance_auto_schedule'],
                user_id=work_order['student_id'],
                user_type='student',
                metadata={
                    'work_order': work_order,
                    'auto_scheduled': True,
                    'original_request': request_data
                }
            )
        except Exception as e:
            logger.error(f"Error logging maintenance scheduling: {e}")


# Global instance
auto_approval_engine = AutoApprovalEngine()