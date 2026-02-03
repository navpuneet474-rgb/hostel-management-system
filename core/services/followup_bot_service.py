"""
Simple Follow-up Bot Service for basic clarification questions.
Handles simple clarification for incomplete requests with proper conversation flow.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass, field

from django.utils import timezone
from ..models import Student, Message
from .ai_engine_service import ai_engine_service, IntentResult

logger = logging.getLogger(__name__)


@dataclass
class FollowUpResult:
    """Simple result of follow-up processing."""
    success: bool
    response_message: str
    needs_clarification: bool
    escalated: bool
    updated_entities: Dict[str, Any] = field(default_factory=dict)
    conversation_step: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'response_message': self.response_message,
            'needs_clarification': self.needs_clarification,
            'escalated': self.escalated,
            'updated_entities': self.updated_entities,
            'conversation_step': self.conversation_step
        }


class SimpleFollowUpBot:
    """
    Simple Follow-up Bot for basic clarification questions with conversation context.
    """
    
    def __init__(self):
        """Initialize the Simple Follow-up Bot."""
        self.ai_engine = ai_engine_service
        logger.info("Simple Follow-up Bot initialized")
    
    def generate_clarification_question(self, intent_result: IntentResult, 
                                       collected_data: Optional[Dict[str, Any]] = None) -> str:
        """
        Generate a simple, specific clarification question based on missing information.
        Asks ONE thing at a time in a logical sequence.
        
        Args:
            intent_result: The intent result with missing information
            collected_data: Previously collected data in the conversation
            
        Returns:
            A single clarification question
        """
        missing_info = intent_result.missing_info or []
        intent = intent_result.intent
        entities = intent_result.entities or {}
        collected_data = collected_data or {}
        
        # Simple template-based questions - ask ONE thing at a time
        if intent == 'guest_request':
            # Step 1: Guest name
            if not collected_data.get('guest_name') and ('guest_name' in missing_info or not entities.get('guest_name')):
                return "What is your guest's name?"
            
            # Step 2: Arrival/Visit date
            if not collected_data.get('visit_date') and not collected_data.get('start_date'):
                if 'arrival_date' in missing_info or 'visit_date' in missing_info or not entities.get('start_date'):
                    guest_name = collected_data.get('guest_name') or entities.get('guest_name', 'your guest')
                    return f"When will {guest_name} visit? (e.g., 'today', 'tomorrow', 'this weekend')"
            
            # Step 3: Duration or departure date
            if not collected_data.get('duration') and not collected_data.get('end_date'):
                if 'departure_date' in missing_info or 'duration' in missing_info or not entities.get('end_date'):
                    guest_name = collected_data.get('guest_name') or entities.get('guest_name', 'your guest')
                    visit_date = collected_data.get('visit_date') or collected_data.get('start_date') or 'the visit'
                    return f"For how long will {guest_name} stay? (e.g., '2 hours', 'overnight', '2 days')"
        
        elif intent == 'leave_request':
            # Step 1: Departure date
            if not collected_data.get('start_date') and not collected_data.get('leave_from'):
                if 'departure_date' in missing_info or not entities.get('start_date'):
                    return "When do you want to leave? (e.g., 'today', 'tomorrow', 'next Friday')"
            
            # Step 2: Return date or duration
            if not collected_data.get('end_date') and not collected_data.get('leave_to') and not collected_data.get('duration'):
                if 'return_date' in missing_info or 'duration' in missing_info or not entities.get('end_date'):
                    start_date = collected_data.get('start_date') or collected_data.get('leave_from') or 'then'
                    return f"When will you return? (e.g., 'in 2 days', 'next Monday', or a specific date)"
            
            # Step 3: Reason for leave
            if not collected_data.get('reason'):
                if 'reason_for_leave' in missing_info or not entities.get('reason'):
                    return "What is the reason for your leave? (e.g., 'going home', 'family emergency', 'medical', etc.)"
        
        elif intent == 'maintenance_request':
            # Step 1: Problem description
            if not collected_data.get('issue_description') and not collected_data.get('problem_description'):
                if 'problem_description' in missing_info or not entities.get('issue_description'):
                    return "Please describe the maintenance problem. What's not working?"
            
            # Step 2: Room number (if not provided)
            if not collected_data.get('room_number'):
                if 'room_number' in missing_info or not entities.get('room_number'):
                    return "Which room needs maintenance? (your room number)"
        
        return "Could you provide more details about your request?"
    
    def extract_response_data(self, user_response: str, intent: str, 
                             conversation_step: str) -> Dict[str, Any]:
        """
        Extract useful data from user's response based on the question asked.
        
        Args:
            user_response: The user's response text
            intent: The intent type (guest_request, leave_request, etc.)
            conversation_step: Which step of the conversation we're at
            
        Returns:
            Dictionary with extracted key-value pairs
        """
        extracted = {}
        response_lower = user_response.strip().lower()
        
        try:
            if intent == 'guest_request':
                if 'name' in conversation_step:
                    # Extract guest name (simple: use the response as name)
                    extracted['guest_name'] = user_response.strip()
                elif 'date' in conversation_step or 'visit' in conversation_step:
                    # Extract visit date
                    extracted['visit_date'] = user_response.strip()
                    extracted['start_date'] = user_response.strip()
                elif 'duration' in conversation_step or 'long' in conversation_step:
                    # Extract duration
                    extracted['duration'] = user_response.strip()
            
            elif intent == 'leave_request':
                if 'depart' in conversation_step or 'leaving' in conversation_step:
                    # Extract departure date
                    extracted['start_date'] = user_response.strip()
                    extracted['leave_from'] = user_response.strip()
                elif 'return' in conversation_step:
                    # Extract return date/duration
                    extracted['end_date'] = user_response.strip()
                    extracted['leave_to'] = user_response.strip()
                    # Try to extract duration in days if it's mentioned
                    if 'day' in response_lower:
                        import re
                        match = re.search(r'(\d+)\s*day', response_lower)
                        if match:
                            extracted['duration_days'] = int(match.group(1))
                elif 'reason' in conversation_step:
                    # Extract reason
                    extracted['reason'] = user_response.strip()
            
            elif intent == 'maintenance_request':
                if 'describe' in conversation_step or 'problem' in conversation_step:
                    # Extract problem description
                    extracted['issue_description'] = user_response.strip()
                    extracted['problem_description'] = user_response.strip()
                elif 'room' in conversation_step:
                    # Extract room number (try to find digits)
                    import re
                    match = re.search(r'\b(\d+)\b', user_response)
                    if match:
                        extracted['room_number'] = match.group(1)
                    else:
                        extracted['room_number'] = user_response.strip()
        
        except Exception as e:
            logger.warning(f"Error extracting response data: {e}")
        
        return extracted
    
    def should_escalate(self, intent_result: IntentResult) -> bool:
        """
        Check if request should be escalated to staff.
        
        Args:
            intent_result: The intent result to evaluate
            
        Returns:
            True if should escalate, False otherwise
        """
        # Escalate if confidence is very low
        if intent_result.confidence < 0.5:
            return True
        
        # Escalate if too many missing items (more than 3)
        if len(intent_result.missing_info or []) > 3:
            return True
        
        # Don't escalate otherwise - clarification is better
        return False
    
    def get_next_conversation_step(self, intent: str, collected_data: Dict[str, Any]) -> str:
        """
        Determine the next step in the conversation based on collected data.
        
        Args:
            intent: The intent type
            collected_data: Data collected so far
            
        Returns:
            String describing the next step
        """
        if intent == 'guest_request':
            if not collected_data.get('guest_name'):
                return 'asking_guest_name'
            elif not collected_data.get('visit_date') and not collected_data.get('start_date'):
                return 'asking_visit_date'
            elif not collected_data.get('duration') and not collected_data.get('end_date'):
                return 'asking_duration'
            else:
                return 'complete'
        
        elif intent == 'leave_request':
            if not collected_data.get('start_date') and not collected_data.get('leave_from'):
                return 'asking_departure_date'
            elif not collected_data.get('end_date') and not collected_data.get('leave_to') and not collected_data.get('duration'):
                return 'asking_return_date'
            elif not collected_data.get('reason'):
                return 'asking_reason'
            else:
                return 'complete'
        
        elif intent == 'maintenance_request':
            if not collected_data.get('issue_description') and not collected_data.get('problem_description'):
                return 'asking_problem_description'
            elif not collected_data.get('room_number'):
                return 'asking_room_number'
            else:
                return 'complete'
        
        return 'unknown'


# Global instance
followup_bot_service = SimpleFollowUpBot()