"""
Rule Engine Service for hostel policy validation and rule explanation.
Handles business logic validation, auto-approval criteria, and rule explanations.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from django.utils import timezone
from ..models import Student, GuestRequest, AbsenceRecord

logger = logging.getLogger(__name__)


class RuleViolationType(Enum):
    """Types of rule violations."""
    GUEST_DURATION_EXCEEDED = "guest_duration_exceeded"
    RECENT_VIOLATIONS = "recent_violations"
    LEAVE_DURATION_EXCEEDED = "leave_duration_exceeded"
    INSUFFICIENT_NOTICE = "insufficient_notice"
    ROOM_CAPACITY_EXCEEDED = "room_capacity_exceeded"
    BLACKOUT_PERIOD = "blackout_period"


@dataclass
class ValidationResult:
    """Result of rule validation."""
    is_valid: bool
    violations: List[RuleViolationType]
    reasons: List[str]
    confidence: float
    auto_approvable: bool
    escalation_required: bool
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'is_valid': self.is_valid,
            'violations': [v.value for v in self.violations],
            'reasons': self.reasons,
            'confidence': self.confidence,
            'auto_approvable': self.auto_approvable,
            'escalation_required': self.escalation_required
        }


@dataclass
class PolicyResult:
    """Result of policy check."""
    compliant: bool
    policy_sections: List[str]
    explanations: List[str]
    recommendations: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'compliant': self.compliant,
            'policy_sections': self.policy_sections,
            'explanations': self.explanations,
            'recommendations': self.recommendations
        }


@dataclass
class ApprovalDecision:
    """Auto-approval decision result."""
    approved: bool
    decision_type: str  # 'auto_approved', 'escalated', 'rejected'
    reasoning: str
    confidence: float
    rules_applied: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'approved': self.approved,
            'decision_type': self.decision_type,
            'reasoning': self.reasoning,
            'confidence': self.confidence,
            'rules_applied': self.rules_applied
        }


@dataclass
class RuleExplanation:
    """Rule explanation result."""
    rule_name: str
    explanation: str
    examples: List[str]
    policy_citations: List[str]
    related_requests: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'rule_name': self.rule_name,
            'explanation': self.explanation,
            'examples': self.examples,
            'policy_citations': self.policy_citations,
            'related_requests': self.related_requests
        }


class RuleEngine:
    """
    Core Rule Engine for hostel policy validation and enforcement.
    Handles guest stay validation, leave policy checks, and rule explanations.
    """
    
    # Policy constants
    MAX_GUEST_STAY_DAYS = 1
    MAX_AUTO_LEAVE_DAYS = 2
    MIN_ADVANCE_NOTICE_HOURS = 24
    MAX_VIOLATIONS_FOR_AUTO_APPROVAL = 0
    VIOLATION_LOOKBACK_DAYS = 30
    
    # Hostel policies database
    HOSTEL_POLICIES = {
        'guest_stay': {
            'name': 'Guest Stay Policy',
            'sections': ['Section 4.1', 'Section 4.2'],
            'rules': {
                'max_duration': 'Guest stays are limited to 1 night without prior approval',
                'advance_notice': 'Guest requests must be submitted at least 24 hours in advance',
                'student_record': 'Students with recent violations require manual approval',
                'room_capacity': 'Maximum 2 persons per room including the student'
            },
            'examples': [
                'A friend staying for one night - auto-approved if student has clean record',
                'A guest staying for weekend - requires warden approval',
                'Emergency guest arrival - contact security immediately'
            ]
        },
        'leave_policy': {
            'name': 'Student Leave Policy', 
            'sections': ['Section 3.1', 'Section 3.2'],
            'rules': {
                'short_leave': 'Leaves up to 2 days can be auto-approved',
                'advance_notice': 'Leave requests must be submitted 24 hours in advance',
                'emergency_leave': 'Emergency leaves require immediate warden notification',
                'extended_leave': 'Leaves over 2 days require warden approval'
            },
            'examples': [
                'Going home for weekend - auto-approved with advance notice',
                'Week-long vacation - requires warden approval',
                'Medical emergency - contact warden immediately'
            ]
        },
        'maintenance': {
            'name': 'Maintenance Request Policy',
            'sections': ['Section 5.1'],
            'rules': {
                'basic_issues': 'Basic maintenance issues are auto-scheduled',
                'emergency_repairs': 'Emergency repairs get immediate priority',
                'room_access': 'Students must be present or provide access arrangements'
            },
            'examples': [
                'Leaky faucet - auto-scheduled for next business day',
                'Electrical emergency - immediate response',
                'AC not working - scheduled within 24 hours'
            ]
        },
        'room_cleaning': {
            'name': 'Room Cleaning Policy',
            'sections': ['Section 6.1'],
            'rules': {
                'regular_cleaning': 'Room cleaning can be requested weekly',
                'deep_cleaning': 'Deep cleaning requires advance scheduling',
                'access_required': 'Student must provide room access'
            },
            'examples': [
                'Weekly room cleaning - auto-scheduled',
                'Pre-inspection cleaning - requires advance notice',
                'Emergency cleaning - contact housekeeping directly'
            ]
        }
    }
    
    def __init__(self):
        """Initialize the Rule Engine."""
        logger.info("Rule Engine initialized")
    
    def validate_guest_request(self, request_data: Dict[str, Any], student: Student) -> ValidationResult:
        """
        Validate a guest request against hostel rules.
        
        Args:
            request_data: Guest request data containing guest_name, start_date, end_date, etc.
            student: Student making the request
            
        Returns:
            ValidationResult with validation outcome
        """
        violations = []
        reasons = []
        
        try:
            # Extract request details
            start_date = self._parse_datetime(request_data.get('start_date'))
            end_date = self._parse_datetime(request_data.get('end_date'))
            guest_name = request_data.get('guest_name', '').strip()
            
            # If missing guest name - cannot proceed
            if not guest_name:
                return ValidationResult(
                    is_valid=False,
                    violations=[],
                    reasons=['Missing required information: guest name'],
                    confidence=1.0,
                    auto_approvable=False,
                    escalation_required=True
                )
            
            # Smart date defaults if missing (not a validation error, just use defaults)
            now = timezone.now()
            if not start_date:
                # Default to today if no start date provided
                start_date = now
                logger.info(f"No start_date provided for guest {guest_name}, defaulting to today")
            
            if not end_date:
                # If start_date is provided but end_date is not, assume same-day visit (< 24 hours)
                # Add some buffer (e.g., 12 hours) for short visits
                end_date = start_date + timedelta(hours=12)
                logger.info(f"No end_date provided for guest {guest_name}, assuming short visit (12 hours)")
            
            # Calculate duration
            duration = (end_date - start_date).days
            # If the stay is less than 24 hours but spans midnight, it should count as 1 day
            if duration == 0 and (end_date - start_date).total_seconds() > 0:
                duration = 1
            
            # Rule 1: Check guest stay duration
            if duration > self.MAX_GUEST_STAY_DAYS:
                violations.append(RuleViolationType.GUEST_DURATION_EXCEEDED)
                reasons.append(f'Guest stay duration ({duration} days) exceeds maximum allowed ({self.MAX_GUEST_STAY_DAYS} day)')
            
            # Rule 2: Check student violation history
            if student.has_recent_violations:
                violations.append(RuleViolationType.RECENT_VIOLATIONS)
                reasons.append(f'Student has recent violations (last violation: {student.last_violation_date})')
            
            # Rule 3: Check advance notice (but be lenient for short/same-day visits)
            notice_hours = (start_date - timezone.now()).total_seconds() / 3600
            
            # Only require advance notice for multi-day visits or future visits > 24 hours away
            # Same-day or imminent visits (< 24 hours) can be approved if they meet other criteria
            is_imminent_visit = notice_hours < self.MIN_ADVANCE_NOTICE_HOURS and notice_hours >= -1
            is_same_day_visit = duration == 0 or (duration == 1 and notice_hours < 0)
            
            if notice_hours < self.MIN_ADVANCE_NOTICE_HOURS and not is_imminent_visit:
                # Past request or very late notice for future visit
                violations.append(RuleViolationType.INSUFFICIENT_NOTICE)
                reasons.append(f'Insufficient advance notice ({notice_hours:.1f} hours, minimum {self.MIN_ADVANCE_NOTICE_HOURS} hours required)')
            elif is_imminent_visit and not is_same_day_visit:
                # Imminent but still okay for short same-day visits
                logger.info(f"Guest request with imminent notice ({notice_hours:.1f} hours), but acceptable for short visit")

            
            # Rule 4: Check for conflicting guest requests
            conflicting_requests = self._check_conflicting_guest_requests(student, start_date, end_date)
            if conflicting_requests:
                violations.append(RuleViolationType.ROOM_CAPACITY_EXCEEDED)
                reasons.append('Conflicting guest requests found for the same period')
            
            # Determine validation result
            is_valid = len(violations) == 0
            auto_approvable = is_valid and duration <= self.MAX_GUEST_STAY_DAYS and not student.has_recent_violations
            escalation_required = not auto_approvable
            
            # Calculate confidence based on data completeness and rule clarity
            confidence = self._calculate_validation_confidence(request_data, violations)
            
            return ValidationResult(
                is_valid=is_valid,
                violations=violations,
                reasons=reasons,
                confidence=confidence,
                auto_approvable=auto_approvable,
                escalation_required=escalation_required
            )
            
        except Exception as e:
            logger.error(f"Error validating guest request: {e}")
            return ValidationResult(
                is_valid=False,
                violations=[],
                reasons=[f'Validation error: {str(e)}'],
                confidence=0.0,
                auto_approvable=False,
                escalation_required=True
            )
    
    def check_leave_policy(self, leave_data: Dict[str, Any], student: Student) -> PolicyResult:
        """
        Check leave request against hostel leave policy.
        
        Args:
            leave_data: Leave request data containing start_date, end_date, reason, etc.
            student: Student making the request
            
        Returns:
            PolicyResult with policy compliance information
        """
        try:
            start_date = self._parse_datetime(leave_data.get('start_date'))
            end_date = self._parse_datetime(leave_data.get('end_date'))
            reason = leave_data.get('reason', '').strip()
            
            if not start_date or not end_date:
                return PolicyResult(
                    compliant=False,
                    policy_sections=['Section 3.1'],
                    explanations=['Missing required dates for leave request'],
                    recommendations=['Provide both start and end dates for your leave']
                )
            
            duration = (end_date - start_date).days
            # If the leave is less than 24 hours but spans midnight, it should count as 1 day  
            if duration == 0 and (end_date - start_date).total_seconds() > 0:
                duration = 1
            
            policy_sections = ['Section 3.1', 'Section 3.2']
            explanations = []
            recommendations = []
            
            # Check leave duration policy
            if duration <= self.MAX_AUTO_LEAVE_DAYS:
                explanations.append(f'Leave duration ({duration} days) is within auto-approval limit ({self.MAX_AUTO_LEAVE_DAYS} days)')
                recommendations.append('This leave can be auto-approved if submitted with proper notice')
            else:
                explanations.append(f'Leave duration ({duration} days) exceeds auto-approval limit and requires warden approval')
                recommendations.append('Submit request to warden for manual review')
            
            # Check advance notice
            notice_hours = (start_date - timezone.now()).total_seconds() / 3600
            if notice_hours >= self.MIN_ADVANCE_NOTICE_HOURS:
                explanations.append(f'Advance notice ({notice_hours:.1f} hours) meets minimum requirement')
            else:
                explanations.append(f'Insufficient advance notice ({notice_hours:.1f} hours, minimum {self.MIN_ADVANCE_NOTICE_HOURS} hours required)')
                recommendations.append('Emergency leaves require immediate warden notification')
            
            # Check student record
            if student.has_recent_violations:
                explanations.append('Student has recent violations requiring manual approval')
                recommendations.append('Contact warden due to recent policy violations')
            
            # Determine overall compliance
            compliant = (
                duration <= self.MAX_AUTO_LEAVE_DAYS and 
                notice_hours >= self.MIN_ADVANCE_NOTICE_HOURS and 
                not student.has_recent_violations
            )
            
            return PolicyResult(
                compliant=compliant,
                policy_sections=policy_sections,
                explanations=explanations,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Error checking leave policy: {e}")
            return PolicyResult(
                compliant=False,
                policy_sections=['Section 3.1'],
                explanations=[f'Policy check error: {str(e)}'],
                recommendations=['Contact warden for assistance']
            )
    
    def evaluate_auto_approval_criteria(self, request_data: Dict[str, Any], request_type: str, student: Student) -> ApprovalDecision:
        """
        Evaluate if a request meets auto-approval criteria.
        
        Args:
            request_data: Request data dictionary
            request_type: Type of request ('guest_request', 'leave_request', 'maintenance_request', 'room_cleaning')
            student: Student making the request
            
        Returns:
            ApprovalDecision with approval outcome
        """
        try:
            if request_type == 'guest_request':
                return self._evaluate_guest_auto_approval(request_data, student)
            elif request_type == 'leave_request':
                return self._evaluate_leave_auto_approval(request_data, student)
            elif request_type == 'maintenance_request':
                return self._evaluate_maintenance_auto_approval(request_data, student)
            elif request_type == 'room_cleaning':
                return self._evaluate_cleaning_auto_approval(request_data, student)
            else:
                return ApprovalDecision(
                    approved=False,
                    decision_type='escalated',
                    reasoning=f'Unknown request type: {request_type}',
                    confidence=1.0,
                    rules_applied=['unknown_request_type']
                )
                
        except Exception as e:
            logger.error(f"Error evaluating auto-approval criteria: {e}")
            return ApprovalDecision(
                approved=False,
                decision_type='escalated',
                reasoning=f'Evaluation error: {str(e)}',
                confidence=0.0,
                rules_applied=['evaluation_error']
            )
    
    def explain_rule(self, rule_query: str, context: Dict[str, Any] = None) -> RuleExplanation:
        """
        Provide explanation for hostel rules based on query.
        
        Args:
            rule_query: Natural language query about rules
            context: Additional context for the explanation
            
        Returns:
            RuleExplanation with detailed rule information
        """
        try:
            # Normalize query
            query_lower = rule_query.lower().strip()
            
            # Determine which policy area the query relates to
            if any(keyword in query_lower for keyword in ['guest', 'friend', 'visitor', 'stay', 'overnight']):
                policy_key = 'guest_stay'
            elif any(keyword in query_lower for keyword in ['leave', 'absent', 'away', 'vacation', 'home']):
                policy_key = 'leave_policy'
            elif any(keyword in query_lower for keyword in ['maintenance', 'repair', 'broken', 'fix']):
                policy_key = 'maintenance'
            elif any(keyword in query_lower for keyword in ['clean', 'cleaning', 'housekeeping']):
                policy_key = 'room_cleaning'
            else:
                # General rule inquiry - provide overview
                return self._provide_general_rule_overview()
            
            policy = self.HOSTEL_POLICIES[policy_key]
            
            # Generate specific explanation based on query
            explanation = self._generate_specific_explanation(query_lower, policy)
            
            # Determine related request types
            related_requests = self._get_related_request_types(policy_key)
            
            return RuleExplanation(
                rule_name=policy['name'],
                explanation=explanation,
                examples=policy['examples'],
                policy_citations=policy['sections'],
                related_requests=related_requests
            )
            
        except Exception as e:
            logger.error(f"Error explaining rule: {e}")
            return RuleExplanation(
                rule_name='Rule Explanation Error',
                explanation=f'Unable to process rule query: {str(e)}',
                examples=['Contact warden for rule clarification'],
                policy_citations=['General Policy'],
                related_requests=[]
            )
    
    def _parse_datetime(self, date_input: Any) -> Optional[datetime]:
        """Parse various datetime input formats."""
        if isinstance(date_input, datetime):
            return date_input
        elif isinstance(date_input, str):
            # Try common formats including ISO format
            formats = [
                '%Y-%m-%dT%H:%M:%S.%f%z',  # ISO with microseconds and timezone
                '%Y-%m-%dT%H:%M:%S%z',     # ISO with timezone
                '%Y-%m-%dT%H:%M:%S.%f',    # ISO with microseconds
                '%Y-%m-%dT%H:%M:%S',       # ISO basic
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d',
                '%d/%m/%Y',
                '%m/%d/%Y',
                '%d-%m-%Y'
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
                
        return None
    
    def _check_conflicting_guest_requests(self, student: Student, start_date: datetime, end_date: datetime) -> bool:
        """Check for conflicting guest requests in the same time period."""
        try:
            conflicting = GuestRequest.objects.filter(
                student=student,
                status='approved',
                start_date__lt=end_date,
                end_date__gt=start_date
            ).exists()
            return conflicting
        except Exception:
            return False
    
    def _calculate_validation_confidence(self, request_data: Dict[str, Any], violations: List[RuleViolationType]) -> float:
        """Calculate confidence score for validation result."""
        base_confidence = 0.9
        
        # Reduce confidence for missing data
        required_fields = ['guest_name', 'start_date', 'end_date']
        missing_fields = sum(1 for field in required_fields if not request_data.get(field))
        confidence_reduction = missing_fields * 0.2
        
        # Reduce confidence for violations (indicates edge cases)
        violation_reduction = len(violations) * 0.1
        
        final_confidence = max(0.1, base_confidence - confidence_reduction - violation_reduction)
        return round(final_confidence, 2)
    
    def _evaluate_guest_auto_approval(self, request_data: Dict[str, Any], student: Student) -> ApprovalDecision:
        """Evaluate guest request for auto-approval."""
        validation_result = self.validate_guest_request(request_data, student)
        
        if validation_result.auto_approvable:
            return ApprovalDecision(
                approved=True,
                decision_type='auto_approved',
                reasoning='Guest stay meets all auto-approval criteria: duration ≤1 day, clean student record, sufficient notice',
                confidence=validation_result.confidence,
                rules_applied=['guest_duration_limit', 'student_record_check', 'advance_notice_requirement']
            )
        elif validation_result.is_valid:
            return ApprovalDecision(
                approved=False,
                decision_type='escalated',
                reasoning='Request is valid but requires manual approval due to policy constraints',
                confidence=validation_result.confidence,
                rules_applied=['manual_approval_required']
            )
        else:
            # Build more helpful rejection message
            violation_messages = []
            for reason in validation_result.reasons:
                if 'exceeds maximum' in reason.lower():
                    violation_messages.append('Guest stay is longer than allowed. Try requesting a shorter stay.')
                elif 'recent violations' in reason.lower():
                    violation_messages.append('Your student record shows recent violations. Contact warden to resolve these first.')
                elif 'advance notice' in reason.lower():
                    violation_messages.append('Guest request needs at least 24 hours advance notice. Plan ahead next time.')
                elif 'conflicting' in reason.lower():
                    violation_messages.append('You already have a guest request for this time period.')
                else:
                    violation_messages.append(reason)
            
            final_reasoning = ' '.join(violation_messages) if violation_messages else '; '.join(validation_result.reasons)
            
            return ApprovalDecision(
                approved=False,
                decision_type='rejected',
                reasoning=final_reasoning,
                confidence=validation_result.confidence,
                rules_applied=[v.value for v in validation_result.violations]
            )
    
    def _evaluate_leave_auto_approval(self, request_data: Dict[str, Any], student: Student) -> ApprovalDecision:
        """Evaluate leave request for auto-approval."""
        policy_result = self.check_leave_policy(request_data, student)
        
        if policy_result.compliant:
            return ApprovalDecision(
                approved=True,
                decision_type='auto_approved',
                reasoning='Leave request meets all auto-approval criteria: duration ≤2 days, sufficient notice, clean record',
                confidence=0.9,
                rules_applied=['leave_duration_limit', 'advance_notice_requirement', 'student_record_check']
            )
        else:
            return ApprovalDecision(
                approved=False,
                decision_type='escalated',
                reasoning=f'Leave requires manual approval: {"; ".join(policy_result.explanations)}',
                confidence=0.8,
                rules_applied=['manual_approval_required']
            )
    
    def _evaluate_maintenance_auto_approval(self, request_data: Dict[str, Any], student: Student) -> ApprovalDecision:
        """Evaluate maintenance request for auto-approval."""
        issue_type = request_data.get('issue_type', '').lower()
        urgency = request_data.get('urgency', 'normal').lower()
        
        # Basic maintenance issues are auto-approved
        basic_issues = ['plumbing', 'electrical_minor', 'furniture', 'cleaning', 'ac_repair']
        
        if urgency == 'emergency':
            return ApprovalDecision(
                approved=True,
                decision_type='auto_approved',
                reasoning='Emergency maintenance requests are automatically prioritized',
                confidence=1.0,
                rules_applied=['emergency_maintenance_priority']
            )
        elif any(basic in issue_type for basic in basic_issues):
            return ApprovalDecision(
                approved=True,
                decision_type='auto_approved',
                reasoning='Basic maintenance issue scheduled for next available slot',
                confidence=0.9,
                rules_applied=['basic_maintenance_auto_schedule']
            )
        else:
            return ApprovalDecision(
                approved=False,
                decision_type='escalated',
                reasoning='Complex maintenance issue requires manual assessment',
                confidence=0.8,
                rules_applied=['complex_maintenance_manual_review']
            )
    
    def _evaluate_cleaning_auto_approval(self, request_data: Dict[str, Any], student: Student) -> ApprovalDecision:
        """Evaluate room cleaning request for auto-approval."""
        cleaning_type = request_data.get('cleaning_type', 'regular').lower()
        
        if cleaning_type in ['regular', 'weekly', 'standard']:
            return ApprovalDecision(
                approved=True,
                decision_type='auto_approved',
                reasoning='Regular room cleaning request auto-scheduled',
                confidence=1.0,
                rules_applied=['regular_cleaning_auto_schedule']
            )
        else:
            return ApprovalDecision(
                approved=False,
                decision_type='escalated',
                reasoning='Special cleaning requests require advance scheduling',
                confidence=0.9,
                rules_applied=['special_cleaning_manual_schedule']
            )
    
    def _generate_specific_explanation(self, query: str, policy: Dict[str, Any]) -> str:
        """Generate specific explanation based on query and policy."""
        rules = policy['rules']
        
        if 'duration' in query or 'how long' in query:
            if 'guest' in query:
                return f"Guest stays are limited to {self.MAX_GUEST_STAY_DAYS} night without prior approval. {rules['max_duration']}"
            elif 'leave' in query:
                return f"Leaves up to {self.MAX_AUTO_LEAVE_DAYS} days can be auto-approved. {rules['short_leave']}"
        
        elif 'advance' in query or 'notice' in query:
            return f"All requests must be submitted at least {self.MIN_ADVANCE_NOTICE_HOURS} hours in advance. {rules['advance_notice']}"
        
        elif 'violation' in query or 'record' in query:
            return f"Students with violations in the last {self.VIOLATION_LOOKBACK_DAYS} days require manual approval. {rules.get('student_record', '')}"
        
        else:
            # General explanation
            return f"{policy['name']} includes the following key rules: " + "; ".join(rules.values())
    
    def _get_related_request_types(self, policy_key: str) -> List[str]:
        """Get related request types for a policy area."""
        mapping = {
            'guest_stay': ['guest_request'],
            'leave_policy': ['leave_request', 'absence_request'],
            'maintenance': ['maintenance_request'],
            'room_cleaning': ['room_cleaning', 'housekeeping_request']
        }
        return mapping.get(policy_key, [])
    
    def _provide_general_rule_overview(self) -> RuleExplanation:
        """Provide general overview of all hostel rules."""
        overview = """
        Hostel rules cover four main areas:
        1. Guest Stay Policy - Visitors and overnight guests
        2. Leave Policy - Student absences and vacations  
        3. Maintenance Policy - Room repairs and issues
        4. Cleaning Policy - Room cleaning and housekeeping
        
        Most simple requests can be auto-approved if they meet basic criteria.
        """
        
        all_examples = []
        all_sections = []
        for policy in self.HOSTEL_POLICIES.values():
            all_examples.extend(policy['examples'][:1])  # One example per policy
            all_sections.extend(policy['sections'])
        
        return RuleExplanation(
            rule_name='General Hostel Rules',
            explanation=overview.strip(),
            examples=all_examples,
            policy_citations=list(set(all_sections)),
            related_requests=['guest_request', 'leave_request', 'maintenance_request', 'room_cleaning']
        )


# Global instance
rule_engine = RuleEngine()