"""
AI Engine Service for natural language processing and intent extraction.
Orchestrates the AI pipeline for message processing in the hostel coordination system.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import re

from .gemini_service import gemini_service

logger = logging.getLogger(__name__)


class IntentResult:
    """Data class for intent extraction results."""
    
    def __init__(self, intent: str, entities: Dict[str, Any], confidence: float, 
                 requires_clarification: bool = False, missing_info: List[str] = None):
        self.intent = intent
        self.entities = entities
        self.confidence = confidence
        self.requires_clarification = requires_clarification
        self.missing_info = missing_info or []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            'intent': self.intent,
            'entities': self.entities,
            'confidence': self.confidence,
            'requires_clarification': self.requires_clarification,
            'missing_info': self.missing_info
        }


class AIEngineService:
    """
    Core AI Engine Service for natural language processing.
    Handles message parsing, intent extraction, and confidence scoring.
    """
    
    # Confidence thresholds
    HIGH_CONFIDENCE_THRESHOLD = 0.8
    MEDIUM_CONFIDENCE_THRESHOLD = 0.6
    LOW_CONFIDENCE_THRESHOLD = 0.4
    
    # Intent types
    VALID_INTENTS = {
        'guest_request', 'leave_request', 'maintenance_request', 
        'room_cleaning', 'rule_inquiry', 'general_query'
    }
    
    def __init__(self):
        """Initialize the AI Engine Service."""
        self.gemini_service = gemini_service
        logger.info("AI Engine Service initialized")
    
    def is_configured(self) -> bool:
        """Check if the AI engine is properly configured."""
        return self.gemini_service and self.gemini_service.is_configured()
    
    def extract_intent(self, message: str, user_context: Dict[str, Any] = None) -> IntentResult:
        """
        Extract intent and entities from a natural language message.
        
        Args:
            message: The user's natural language message
            user_context: Additional context about the user
            
        Returns:
            IntentResult containing extracted information
        """
        if not self.is_configured():
            logger.error("AI Engine not properly configured")
            return IntentResult(
                intent="unknown",
                entities={},
                confidence=0.0,
                requires_clarification=True,
                missing_info=["AI service unavailable"]
            )
        
        try:
            # Pre-process the message
            processed_message = self._preprocess_message(message)
            
            # Extract intent using Gemini
            gemini_result = self.gemini_service.extract_intent(processed_message, user_context)
            
            if 'error' in gemini_result:
                logger.error(f"Gemini extraction failed: {gemini_result['error']}")
                return self._create_fallback_result(processed_message, user_context)
            
            # Validate and enhance the result
            validated_result = self._validate_and_enhance_result(gemini_result, processed_message)
            
            # Apply confidence scoring
            final_confidence = self._calculate_confidence_score(validated_result, processed_message)
            
            # Determine if clarification is needed
            requires_clarification = self._requires_clarification(validated_result, final_confidence)
            
            # Identify missing information
            missing_info = self._identify_missing_info(validated_result)
            
            result = IntentResult(
                intent=validated_result['intent'],
                entities=validated_result['entities'],
                confidence=final_confidence,
                requires_clarification=requires_clarification,
                missing_info=missing_info
            )
            
            logger.info(f"Intent extraction completed: {result.intent} (confidence: {result.confidence:.2f})")
            return result
            
        except Exception as e:
            logger.error(f"Error in intent extraction: {e}")
            return self._create_error_result(str(e))
    
    def validate_confidence(self, result: IntentResult) -> bool:
        """
        Validate if the confidence score meets the threshold for processing.
        
        Args:
            result: The intent extraction result
            
        Returns:
            True if confidence is sufficient, False otherwise
        """
        return result.confidence >= self.HIGH_CONFIDENCE_THRESHOLD
    
    def request_clarification(self, incomplete_data: Dict[str, Any]) -> str:
        """
        Generate a clarification question for incomplete data.
        
        Args:
            incomplete_data: The incomplete intent data
            
        Returns:
            A natural language clarification question
        """
        if not self.is_configured():
            return "I need more information to process your request. Could you please provide more details?"
        
        try:
            return self.gemini_service.generate_clarification_question(incomplete_data)
        except Exception as e:
            logger.error(f"Error generating clarification: {e}")
            return "Could you please provide more details about your request?"
    
    def format_structured_output(self, intent_result: IntentResult) -> Dict[str, Any]:
        """
        Format the intent result into structured output for downstream processing.
        
        Args:
            intent_result: The intent extraction result
            
        Returns:
            Structured data dictionary
        """
        structured_data = {
            'intent': intent_result.intent,
            'entities': intent_result.entities,
            'confidence': intent_result.confidence,
            'requires_clarification': intent_result.requires_clarification,
            'missing_info': intent_result.missing_info,
            'processed_at': datetime.utcnow().isoformat(),
            'processing_metadata': {
                'ai_engine_version': '1.0',
                'confidence_threshold': self.HIGH_CONFIDENCE_THRESHOLD,
                'validation_passed': self.validate_confidence(intent_result)
            }
        }
        
        # Add intent-specific structured fields
        if intent_result.intent == 'guest_request':
            structured_data['request_type'] = 'guest_permission'
            structured_data['auto_processable'] = self._is_guest_request_auto_processable(intent_result)
        elif intent_result.intent == 'leave_request':
            structured_data['request_type'] = 'absence_request'
            structured_data['auto_processable'] = self._is_leave_request_auto_processable(intent_result)
        elif intent_result.intent in ['maintenance_request', 'room_cleaning']:
            structured_data['request_type'] = 'service_request'
            structured_data['auto_processable'] = True
        else:
            structured_data['request_type'] = 'information_request'
            structured_data['auto_processable'] = False
        
        return structured_data
    
    def _preprocess_message(self, message: str) -> str:
        """
        Pre-process the message for better intent extraction.
        
        Args:
            message: Raw message text
            
        Returns:
            Processed message text
        """
        # Basic text cleaning
        processed = message.strip()
        
        # Remove excessive whitespace
        processed = re.sub(r'\s+', ' ', processed)
        
        # Normalize common abbreviations
        abbreviations = {
            'tmrw': 'tomorrow',
            'tonite': 'tonight',
            'u': 'you',
            'ur': 'your',
            'pls': 'please',
            'thx': 'thanks',
            'ty': 'thank you'
        }
        
        for abbrev, full in abbreviations.items():
            processed = re.sub(r'\b' + abbrev + r'\b', full, processed, flags=re.IGNORECASE)
        
        return processed
    
    def _validate_and_enhance_result(self, gemini_result: Dict[str, Any], message: str) -> Dict[str, Any]:
        """
        Validate and enhance the Gemini extraction result.
        
        Args:
            gemini_result: Raw result from Gemini
            message: Original message text
            
        Returns:
            Validated and enhanced result
        """
        result = gemini_result.copy()
        
        # Validate intent
        if result.get('intent') not in self.VALID_INTENTS:
            result['intent'] = self._classify_intent_fallback(message)
        
        # Ensure entities is a dictionary
        if not isinstance(result.get('entities'), dict):
            result['entities'] = {}
        
        # Enhance entities with pattern matching
        enhanced_entities = self._enhance_entities_with_patterns(result['entities'], message)
        result['entities'].update(enhanced_entities)
        
        # Validate confidence score
        confidence = result.get('confidence', 0.0)
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            result['confidence'] = 0.5  # Default to medium confidence
        
        return result
    
    def _calculate_confidence_score(self, result: Dict[str, Any], message: str) -> float:
        """
        Calculate a refined confidence score based on multiple factors.
        
        Args:
            result: Validated extraction result
            message: Original message text
            
        Returns:
            Refined confidence score
        """
        base_confidence = result.get('confidence', 0.5)
        
        # Confidence adjustments
        adjustments = 0.0
        
        # Boost confidence for clear intent keywords
        intent_keywords = {
            'guest_request': ['guest', 'friend', 'visitor', 'stay', 'overnight'],
            'leave_request': ['leave', 'going home', 'absent', 'away', 'vacation'],
            'maintenance_request': ['broken', 'repair', 'fix', 'maintenance', 'not working'],
            'room_cleaning': ['clean', 'cleaning', 'housekeeping', 'tidy'],
            'rule_inquiry': ['rule', 'policy', 'allowed', 'can i', 'is it ok']
        }
        
        intent = result.get('intent', 'unknown')
        if intent in intent_keywords:
            keywords = intent_keywords[intent]
            message_lower = message.lower()
            keyword_matches = sum(1 for keyword in keywords if keyword in message_lower)
            if keyword_matches > 0:
                adjustments += min(0.2, keyword_matches * 0.1)
        
        # Reduce confidence for very short messages
        if len(message.split()) < 3:
            adjustments -= 0.2
        
        # Reduce confidence for unclear or ambiguous messages
        ambiguous_indicators = ['maybe', 'not sure', 'i think', 'possibly', 'might']
        if any(indicator in message.lower() for indicator in ambiguous_indicators):
            adjustments -= 0.15
        
        # Boost confidence for complete entity extraction
        entities = result.get('entities', {})
        if intent == 'guest_request':
            if entities.get('guest_name') and entities.get('start_date'):
                adjustments += 0.1
        elif intent == 'leave_request':
            if entities.get('start_date') and entities.get('end_date'):
                adjustments += 0.1
        
        final_confidence = max(0.0, min(1.0, base_confidence + adjustments))
        return round(final_confidence, 2)
    
    def _requires_clarification(self, result: Dict[str, Any], confidence: float) -> bool:
        """
        Determine if clarification is required based on confidence and completeness.
        
        Args:
            result: Extraction result
            confidence: Calculated confidence score
            
        Returns:
            True if clarification is needed
        """
        # If AI service is not configured, don't require clarification to avoid loops
        if not self.is_configured():
            return False
        
        # Only require clarification for very low confidence (be more lenient)
        if confidence < self.LOW_CONFIDENCE_THRESHOLD:
            return True
        
        # For medium to high confidence, try to process with available information
        # Only require clarification if absolutely critical information is missing
        intent = result.get('intent')
        entities = result.get('entities', {})
        
        if intent == 'guest_request':
            # Only require clarification if we have NO useful information at all
            has_guest_info = bool(entities.get('guest_name'))
            has_date_info = bool(entities.get('start_date') or entities.get('visit_date') or 
                               entities.get('duration') or entities.get('duration_days'))
            
            # If we have at least guest name OR date info, try to process
            # The conversational flow will ask for missing details
            if has_guest_info or has_date_info:
                return False
            
            # Only require clarification if we have absolutely nothing
            return True
                
        elif intent == 'leave_request':
            # Only require clarification if we have NO date information at all
            has_date_info = bool(entities.get('start_date') or entities.get('leave_from') or
                               entities.get('end_date') or entities.get('leave_to') or
                               entities.get('duration') or entities.get('duration_days'))
            
            # If we have any date information, try to process
            if has_date_info:
                return False
            
            # Only require clarification if we have no date info
            return True
                
        elif intent == 'maintenance_request':
            # Only require clarification if we have NO problem description
            has_problem_info = bool(entities.get('issue_description') or 
                                  entities.get('problem_description'))
            
            # If we have problem description, we can process (location can be inferred)
            if has_problem_info:
                return False
            
            # Only require clarification if we have no problem description
            return True
        
        # For other intents, don't require clarification
        return False
    
    def _identify_missing_info(self, result: Dict[str, Any]) -> List[str]:
        """
        Identify what information is missing for complete processing.
        Only flag truly critical missing information.
        
        Args:
            result: Extraction result
            
        Returns:
            List of missing information items
        """
        missing = []
        intent = result.get('intent')
        entities = result.get('entities', {})
        
        if intent == 'guest_request':
            # Only flag as missing if we have absolutely no information
            if not entities.get('guest_name') and not entities.get('start_date') and not entities.get('visit_date'):
                missing.append('guest_name_or_date')
                
        elif intent == 'leave_request':
            # Only flag as missing if we have no date information at all
            if (not entities.get('start_date') and not entities.get('leave_from') and 
                not entities.get('end_date') and not entities.get('leave_to') and 
                not entities.get('duration') and not entities.get('duration_days')):
                missing.append('date_information')
                
        elif intent == 'maintenance_request':
            # Only flag as missing if we have no problem description
            if not entities.get('issue_description') and not entities.get('problem_description'):
                missing.append('problem_description')
        
        return missing
    
    def _enhance_entities_with_patterns(self, entities: Dict[str, Any], message: str) -> Dict[str, Any]:
        """
        Enhanced entity extraction using advanced pattern matching and context understanding.
        
        Args:
            entities: Current entities
            message: Original message
            
        Returns:
            Additional entities found through patterns
        """
        enhanced = {}
        message_lower = message.lower()
        
        # Advanced date processing with context
        enhanced.update(self._extract_smart_dates(message_lower, entities))
        
        # Room number patterns (enhanced)
        room_pattern = r'room\s*(\d+[a-z]?)|(\d+[a-z]?)\s*room|my\s+room|room\s+no\.?\s*(\d+)'
        room_matches = re.findall(room_pattern, message_lower)
        if room_matches and not entities.get('room_number'):
            for match_group in room_matches:
                room_num = next((match for match in match_group if match), None)
                if room_num:
                    enhanced['room_number'] = room_num
                    break
        
        # Enhanced name extraction for guests
        enhanced.update(self._extract_guest_names(message, message_lower, entities))
        
        # Duration extraction
        enhanced.update(self._extract_duration(message_lower, entities))
        
        # Urgency detection
        enhanced.update(self._detect_urgency(message_lower, entities))
        
        # Contact information extraction
        enhanced.update(self._extract_contact_info(message, entities))
        
        return enhanced
    
    def _extract_smart_dates(self, message_lower: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Extract dates with smart context understanding."""
        from datetime import datetime, timedelta
        
        enhanced = {}
        today = datetime.now()
        
        # Relative date patterns with context
        relative_dates = {
            'today': today,
            'tonight': today,
            'tomorrow': today + timedelta(days=1),
            'tmrw': today + timedelta(days=1),
            'day after tomorrow': today + timedelta(days=2),
            'next week': today + timedelta(days=7),
            'this weekend': today + timedelta(days=(5 - today.weekday()) % 7),
            'next weekend': today + timedelta(days=(5 - today.weekday()) % 7 + 7)
        }
        
        for phrase, date_obj in relative_dates.items():
            if phrase in message_lower and not entities.get('start_date'):
                enhanced['start_date'] = date_obj.strftime('%Y-%m-%d')
                
                # Smart end date inference
                if phrase in ['tonight', 'today']:
                    enhanced['end_date'] = (date_obj + timedelta(hours=12)).strftime('%Y-%m-%d')
                    enhanced['duration_days'] = 1
                elif phrase in ['tomorrow', 'tmrw']:
                    enhanced['end_date'] = (date_obj + timedelta(days=1)).strftime('%Y-%m-%d')
                    enhanced['duration_days'] = 1
                break
        
        # Specific date patterns
        date_patterns = [
            (r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', 'full_date'),
            (r'(\d{1,2})[/-](\d{1,2})', 'month_day'),
            (r'(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', 'day_month'),
            (r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)', 'weekday')
        ]
        
        for pattern, pattern_type in date_patterns:
            matches = re.findall(pattern, message_lower)
            if matches and not enhanced.get('start_date'):
                match = matches[0]
                try:
                    if pattern_type == 'full_date':
                        day, month, year = match
                        if len(year) == 2:
                            year = '20' + year
                        date_obj = datetime(int(year), int(month), int(day))
                    elif pattern_type == 'month_day':
                        month, day = match
                        year = today.year
                        date_obj = datetime(year, int(month), int(day))
                        if date_obj < today:
                            date_obj = datetime(year + 1, int(month), int(day))
                    elif pattern_type == 'day_month':
                        day, month_name = match
                        month_map = {
                            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
                        }
                        month = month_map.get(month_name[:3])
                        if month:
                            year = today.year
                            date_obj = datetime(year, month, int(day))
                            if date_obj < today:
                                date_obj = datetime(year + 1, month, int(day))
                    elif pattern_type == 'weekday':
                        weekday_name = match
                        weekday_map = {
                            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
                            'friday': 4, 'saturday': 5, 'sunday': 6
                        }
                        target_weekday = weekday_map.get(weekday_name)
                        if target_weekday is not None:
                            days_ahead = target_weekday - today.weekday()
                            if days_ahead <= 0:
                                days_ahead += 7
                            date_obj = today + timedelta(days=days_ahead)
                    
                    enhanced['start_date'] = date_obj.strftime('%Y-%m-%d')
                    break
                except (ValueError, TypeError):
                    continue
        
        # Duration-based end date calculation
        if enhanced.get('start_date') and not enhanced.get('end_date'):
            duration_patterns = [
                (r'for (\d+) days?', 'days'),
                (r'(\d+) days?', 'days'),
                (r'for (\d+) nights?', 'nights'),
                (r'(\d+) nights?', 'nights'),
                (r'for a week', 'week'),
                (r'one week', 'week')
            ]
            
            for pattern, unit in duration_patterns:
                matches = re.findall(pattern, message_lower)
                if matches:
                    try:
                        if unit in ['days', 'nights']:
                            duration = int(matches[0])
                        elif unit == 'week':
                            duration = 7
                        
                        start_date = datetime.strptime(enhanced['start_date'], '%Y-%m-%d')
                        end_date = start_date + timedelta(days=duration)
                        enhanced['end_date'] = end_date.strftime('%Y-%m-%d')
                        enhanced['duration_days'] = duration
                        break
                    except (ValueError, TypeError):
                        continue
        
        return enhanced
    
    def _extract_guest_names(self, message: str, message_lower: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Enhanced guest name extraction."""
        enhanced = {}
        
        if any(word in message_lower for word in ['friend', 'guest', 'visitor', 'cousin', 'brother', 'sister']):
            name_patterns = [
                r'my friend (\w+)',
                r'(\w+) will stay',
                r'(\w+) is coming',
                r'(\w+) wants to stay',
                r'guest (?:named? )?(\w+)',
                r'visitor (?:named? )?(\w+)',
                r'my (?:friend|cousin|brother|sister) (\w+)'
            ]
            
            for pattern in name_patterns:
                matches = re.findall(pattern, message, re.IGNORECASE)
                if matches and not entities.get('guest_name'):
                    enhanced['guest_name'] = matches[0].title()
                    break
            
            # If no specific name found, try to extract from context
            if not enhanced.get('guest_name') and not entities.get('guest_name'):
                # Look for capitalized words that might be names
                words = message.split()
                for i, word in enumerate(words):
                    if (word[0].isupper() and len(word) > 2 and 
                        word.lower() not in ['my', 'friend', 'guest', 'will', 'stay', 'coming', 'tonight', 'tomorrow']):
                        enhanced['guest_name'] = word
                        break
        
        return enhanced
    
    def _extract_duration(self, message_lower: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Extract duration information."""
        enhanced = {}
        
        duration_patterns = [
            (r'for (\d+) days?', int),
            (r'(\d+) days?', int),
            (r'for (\d+) nights?', int),
            (r'(\d+) nights?', int),
            (r'one day', lambda x: 1),
            (r'one night', lambda x: 1),
            (r'a day', lambda x: 1),
            (r'a night', lambda x: 1),
            (r'overnight', lambda x: 1),
            (r'for a week', lambda x: 7),
            (r'one week', lambda x: 7)
        ]
        
        for pattern, converter in duration_patterns:
            matches = re.findall(pattern, message_lower)
            if matches and not entities.get('duration_days'):
                try:
                    if callable(converter):
                        if converter.__name__ == '<lambda>':
                            enhanced['duration_days'] = converter(None)
                        else:
                            enhanced['duration_days'] = converter(matches[0])
                    break
                except (ValueError, TypeError):
                    continue
        
        return enhanced
    
    def _detect_urgency(self, message_lower: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Detect urgency level from message content."""
        enhanced = {}
        
        urgency_indicators = {
            'high': ['urgent', 'emergency', 'asap', 'immediately', 'broken', 'not working', 'help'],
            'medium': ['soon', 'quickly', 'problem', 'issue', 'need'],
            'low': ['when possible', 'sometime', 'eventually', 'later']
        }
        
        for level, indicators in urgency_indicators.items():
            if any(indicator in message_lower for indicator in indicators):
                enhanced['urgency'] = level
                break
        
        # Default urgency based on intent context
        if not enhanced.get('urgency') and not entities.get('urgency'):
            if any(word in message_lower for word in ['broken', 'not working', 'emergency']):
                enhanced['urgency'] = 'high'
            elif any(word in message_lower for word in ['maintenance', 'repair', 'fix']):
                enhanced['urgency'] = 'medium'
            else:
                enhanced['urgency'] = 'low'
        
        return enhanced
    
    def _extract_contact_info(self, message: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Extract contact information."""
        enhanced = {}
        
        # Phone number patterns
        phone_patterns = [
            r'(\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})',
            r'(\d{10})',
            r'(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})'
        ]
        
        for pattern in phone_patterns:
            matches = re.findall(pattern, message)
            if matches and not entities.get('phone'):
                enhanced['phone'] = matches[0]
                break
        
        # Email patterns
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_matches = re.findall(email_pattern, message)
        if email_matches and not entities.get('email'):
            enhanced['email'] = email_matches[0]
        
        return enhanced
    
    def _classify_intent_fallback(self, message: str) -> str:
        """
        Fallback intent classification using keyword matching.
        
        Args:
            message: Message text
            
        Returns:
            Classified intent
        """
        message_lower = message.lower()
        
        # Rule inquiry keywords (check first as they're more specific)
        if any(keyword in message_lower for keyword in ['rule', 'policy', 'allowed', 'can i', 'what are the']):
            return 'rule_inquiry'
        
        # Guest request keywords
        if any(keyword in message_lower for keyword in ['guest', 'friend', 'visitor', 'stay', 'overnight']):
            return 'guest_request'
        
        # Leave request keywords
        if any(keyword in message_lower for keyword in ['leave', 'going home', 'go home', 'home', 'absent', 'away', 'vacation']):
            return 'leave_request'
        
        # Maintenance keywords
        if any(keyword in message_lower for keyword in ['broken', 'repair', 'fix', 'maintenance', 'not working']):
            return 'maintenance_request'
        
        # Cleaning keywords
        if any(keyword in message_lower for keyword in ['clean', 'cleaning', 'housekeeping']):
            return 'room_cleaning'
        
        return 'general_query'
    
    def _is_guest_request_auto_processable(self, result: IntentResult) -> bool:
        """Check if a guest request can be auto-processed."""
        entities = result.entities
        return (
            result.confidence >= self.HIGH_CONFIDENCE_THRESHOLD and
            entities.get('guest_name') and
            entities.get('start_date') and
            entities.get('duration_days', 0) <= 1
        )
    
    def _is_leave_request_auto_processable(self, result: IntentResult) -> bool:
        """Check if a leave request can be auto-processed."""
        entities = result.entities
        return (
            result.confidence >= self.HIGH_CONFIDENCE_THRESHOLD and
            entities.get('start_date') and
            entities.get('end_date') and
            entities.get('duration_days', 0) <= 2
        )
    
    def _create_fallback_result(self, message: str, user_context: Dict[str, Any] = None) -> IntentResult:
        """
        Create a fallback result when Gemini is unavailable.
        Uses pattern matching to extract as much information as possible.
        
        Args:
            message: Original message
            user_context: User context
            
        Returns:
            Fallback IntentResult
        """
        intent = self._classify_intent_fallback(message)
        entities = self._enhance_entities_with_patterns({}, message)
        
        # For fallback, be more lenient and try to process with available information
        # Only require clarification if we have absolutely no useful information
        requires_clarification = False
        missing_info = []
        
        if intent == 'guest_request':
            # Only require clarification if we have no guest name AND no date info
            has_guest_info = bool(entities.get('guest_name'))
            has_date_info = bool(entities.get('start_date') or entities.get('visit_date') or 
                               entities.get('duration') or entities.get('duration_days'))
            
            if not has_guest_info and not has_date_info:
                requires_clarification = True
                missing_info = ['guest_name_or_date']
        
        elif intent == 'leave_request':
            # Only require clarification if we have no date information at all
            has_date_info = bool(entities.get('start_date') or entities.get('leave_from') or
                               entities.get('end_date') or entities.get('leave_to') or
                               entities.get('duration') or entities.get('duration_days'))
            
            if not has_date_info:
                requires_clarification = True
                missing_info = ['date_information']
        
        elif intent == 'maintenance_request':
            # Only require clarification if we have no problem description
            has_problem_info = bool(entities.get('issue_description') or 
                                  entities.get('problem_description'))
            
            if not has_problem_info:
                requires_clarification = True
                missing_info = ['problem_description']
        
        return IntentResult(
            intent=intent,
            entities=entities,
            confidence=0.7,  # Higher confidence for fallback to avoid unnecessary clarification
            requires_clarification=requires_clarification,
            missing_info=missing_info
        )
    
    def _create_error_result(self, error_message: str) -> IntentResult:
        """
        Create an error result for failed processing.
        
        Args:
            error_message: Error description
            
        Returns:
            Error IntentResult
        """
        return IntentResult(
            intent="general_query",  # Use general_query instead of unknown
            entities={},
            confidence=0.5,  # Medium confidence to avoid clarification
            requires_clarification=False,  # Don't require clarification for errors
            missing_info=[]  # Empty to avoid clarification loops
        )


# Global instance
ai_engine_service = AIEngineService()