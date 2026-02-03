"""
Gemini AI integration service for natural language processing.
Handles API communication with Google's Gemini AI for intent extraction and text generation.
"""

import logging
import json
import time
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

try:
    from django.conf import settings
    DJANGO_AVAILABLE = True
except ImportError:
    DJANGO_AVAILABLE = False
    settings = None

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
    from google.api_core import exceptions as google_exceptions
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None
    google_exceptions = None


class GeminiService:
    """
    Service class for integrating with Google's Gemini AI API.
    Provides natural language processing capabilities for the hostel coordination system.
    """
    
    # Retry configuration
    MAX_RETRIES = 3
    RETRY_DELAY = 1.0  # Base delay in seconds
    BACKOFF_MULTIPLIER = 2.0
    
    # Simple in-memory cache for responses (production: use Redis)
    _response_cache = {}
    CACHE_MAX_SIZE = 100
    CACHE_ENABLED = True
    
    def __init__(self):
        """Initialize Gemini AI client with API key from settings."""
        if not DJANGO_AVAILABLE or not GEMINI_AVAILABLE:
            logger.warning("Django or Gemini AI not available. Service will be disabled.")
            self.model = None
            return
            
        try:
            self.api_key = getattr(settings, 'GEMINI_API_KEY', '')
        except Exception:
            logger.warning("Django settings not configured. Service will be disabled.")
            self.model = None
            return
        
        if not self.api_key or self.api_key == 'your-gemini-api-key':
            logger.warning("Gemini API key not configured. AI features will not work.")
            self.model = None
            return
            
        try:
            genai.configure(api_key=self.api_key)
            
            # Configure the model with safety settings
            self.model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                safety_settings={
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            )
            
            logger.info("Gemini AI service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Gemini AI service: {e}")
            self.model = None
    
    def is_configured(self) -> bool:
        """Check if Gemini AI is properly configured."""
        return self.model is not None
    
    def _get_cache_key(self, prompt: str) -> str:
        """Generate a cache key from the prompt."""
        import hashlib
        return hashlib.md5(prompt.encode()).hexdigest()
    
    def _get_cached_response(self, prompt: str) -> Optional[str]:
        """Get cached response if available."""
        if not self.CACHE_ENABLED:
            return None
        
        cache_key = self._get_cache_key(prompt)
        cached = self._response_cache.get(cache_key)
        
        if cached:
            logger.info("Using cached Gemini response")
            return cached
        
        return None
    
    def _cache_response(self, prompt: str, response: str):
        """Cache a response."""
        if not self.CACHE_ENABLED:
            return
        
        # Simple LRU: if cache is full, remove oldest entry
        if len(self._response_cache) >= self.CACHE_MAX_SIZE:
            # Remove first (oldest) entry
            first_key = next(iter(self._response_cache))
            del self._response_cache[first_key]
        
        cache_key = self._get_cache_key(prompt)
        self._response_cache[cache_key] = response
        logger.debug(f"Cached Gemini response (cache size: {len(self._response_cache)})")
    
    def _call_gemini_with_retry(self, prompt: str) -> Optional[str]:
        """
        Call Gemini API with exponential backoff retry logic and caching.
        
        Args:
            prompt: The prompt to send to Gemini
            
        Returns:
            Response text if successful, None otherwise
        """
        if not self.model:
            logger.error("Gemini AI not configured")
            return None
        
        # Check cache first
        cached_response = self._get_cached_response(prompt)
        if cached_response:
            return cached_response
        
        last_exception = None
        delay = self.RETRY_DELAY
        
        for attempt in range(self.MAX_RETRIES):
            try:
                logger.debug(f"Gemini API call attempt {attempt + 1}/{self.MAX_RETRIES}")
                
                response = self.model.generate_content(prompt)
                
                if response.text:
                    logger.debug("Gemini API call successful")
                    return response.text.strip()
                else:
                    logger.warning(f"Empty response from Gemini API on attempt {attempt + 1}")
                    if attempt < self.MAX_RETRIES - 1:
                        time.sleep(delay)
                        delay *= self.BACKOFF_MULTIPLIER
                    continue
                    
            except Exception as e:
                last_exception = e
                logger.warning(f"Gemini API call failed on attempt {attempt + 1}: {e}")
                
                # Check if it's a retryable error
                if self._is_retryable_error(e):
                    if attempt < self.MAX_RETRIES - 1:
                        logger.info(f"Retrying in {delay} seconds...")
                        time.sleep(delay)
                        delay *= self.BACKOFF_MULTIPLIER
                    continue
                else:
                    # Non-retryable error, fail immediately
                    logger.error(f"Non-retryable error: {e}")
                    break
        
        # All retries exhausted
        logger.error(f"Gemini API call failed after {self.MAX_RETRIES} attempts. Last error: {last_exception}")
        return None
    
    def _is_retryable_error(self, error: Exception) -> bool:
        """
        Determine if an error is retryable.
        
        Args:
            error: The exception that occurred
            
        Returns:
            True if the error is retryable, False otherwise
        """
        if not GEMINI_AVAILABLE or not google_exceptions:
            # If we can't import google exceptions, assume all errors are retryable
            return True
        
        # Rate limiting and temporary server errors are retryable
        retryable_exceptions = (
            google_exceptions.ResourceExhausted,  # Rate limiting
            google_exceptions.DeadlineExceeded,   # Timeout
            google_exceptions.ServiceUnavailable, # Server temporarily unavailable
            google_exceptions.InternalServerError, # Server error
        )
        
        # Network-related errors are also retryable
        if isinstance(error, (ConnectionError, TimeoutError)):
            return True
        
        # Check if it's a Google API retryable exception
        return isinstance(error, retryable_exceptions)
    
    def extract_intent(self, message: str, user_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Extract intent and entities from a natural language message.
        
        Args:
            message: The user's natural language message
            user_context: Additional context about the user (room, history, etc.)
            
        Returns:
            Dictionary containing extracted intent, entities, and confidence score
        """
        if not self.model:
            logger.error("Gemini AI not configured")
            return {
                "intent": "unknown",
                "entities": {},
                "confidence": 0.0,
                "error": "AI service not available"
            }
        
        try:
            # Construct the prompt for intent extraction
            prompt = self._build_intent_extraction_prompt(message, user_context)
            
            # Generate response from Gemini with retry logic
            response_text = self._call_gemini_with_retry(prompt)
            
            if response_text:
                # Clean up the response - remove markdown code blocks if present
                cleaned_response = response_text.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response[7:]  # Remove ```json
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:-3]  # Remove ```
                cleaned_response = cleaned_response.strip()
                
                # Parse the JSON response
                result = json.loads(cleaned_response)
                
                # Validate and normalize the response
                normalized_result = self._normalize_intent_result(result)
                
                logger.info(f"Intent extracted successfully: {normalized_result['intent']}")
                return normalized_result
            else:
                logger.error("Failed to get response from Gemini AI after retries")
                return self._create_error_response("AI service temporarily unavailable")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            return self._create_error_response("Invalid AI response format")
        except Exception as e:
            logger.error(f"Error extracting intent: {e}")
            return self._create_error_response(str(e))
    
    def extract_staff_query_intent(self, message: str, user_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Extract specific staff query intent - NO hardcoding, AI-driven routing.
        This replaces keyword-based matching with intelligent intent detection.
        
        Args:
            message: The staff's natural language query
            user_context: Staff context (role, permissions, etc.)
            
        Returns:
            Dictionary with staff_query_intent, parameters, and confidence
        """
        if not self.model:
            logger.error("Gemini AI not configured for staff query intent extraction")
            return {
                "staff_query_intent": "unknown",
                "parameters": {},
                "confidence": 0.0,
                "error": "AI service not available"
            }
        
        try:
            # Build staff-specific intent extraction prompt
            prompt = self._build_staff_query_intent_prompt(message, user_context)
            
            # Generate response from Gemini
            response_text = self._call_gemini_with_retry(prompt)
            
            if response_text:
                # Clean up the response
                cleaned_response = response_text.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response[7:]
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:-3]
                cleaned_response = cleaned_response.strip()
                
                # Parse the JSON response
                result = json.loads(cleaned_response)
                logger.info(f"Staff query intent extracted: {result.get('staff_query_intent', 'unknown')}")
                return result
            else:
                logger.error("Failed to get response from Gemini for staff query intent")
                return self._create_error_response("AI service temporarily unavailable")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse staff query intent response as JSON: {e}")
            return self._create_error_response("Invalid AI response format")
        except Exception as e:
            logger.error(f"Error extracting staff query intent: {e}")
            return self._create_error_response(str(e))
    
    def generate_clarification_question(self, incomplete_data: Dict[str, Any]) -> str:
        """
        Generate a clarification question for incomplete requests.
        
        Args:
            incomplete_data: The incomplete intent data
            
        Returns:
            A natural language clarification question
        """
        if not self.model:
            return "I need more information to process your request. Could you please provide more details?"
        
        try:
            prompt = self._build_clarification_prompt(incomplete_data)
            response_text = self._call_gemini_with_retry(prompt)
            
            if response_text:
                return response_text
            else:
                return "Could you please provide more details about your request?"
                
        except Exception as e:
            logger.error(f"Error generating clarification question: {e}")
            return "I need more information to help you. Could you please be more specific?"
    
    def explain_rule(self, rule_query: str, context: Dict[str, Any] = None) -> str:
        """
        Generate a natural language explanation of hostel rules.
        
        Args:
            rule_query: The user's question about rules
            context: Additional context for the explanation
            
        Returns:
            A clear explanation of the relevant rules
        """
        if not self.model:
            return "I'm unable to explain rules at the moment. Please contact staff for assistance."
        
        try:
            prompt = self._build_rule_explanation_prompt(rule_query, context)
            response_text = self._call_gemini_with_retry(prompt)
            
            if response_text:
                return response_text
            else:
                return "I couldn't find information about that rule. Please contact staff for clarification."
                
        except Exception as e:
            logger.error(f"Error explaining rule: {e}")
            return "I'm having trouble accessing rule information. Please contact staff for assistance."
    
    def extract_followup_information(self, extraction_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract information from a follow-up response in an ongoing conversation.
        
        Args:
            extraction_context: Context including original intent, missing info, and response
            
        Returns:
            Dictionary with extracted information
        """
        if not self.model:
            return {}
        
        try:
            prompt = self._build_followup_extraction_prompt(extraction_context)
            response_text = self._call_gemini_with_retry(prompt)
            
            if response_text:
                try:
                    result = json.loads(response_text)
                    return result.get('extracted_info', {})
                except json.JSONDecodeError:
                    logger.error("Failed to parse follow-up extraction response as JSON")
                    return {}
            else:
                return {}
                
        except Exception as e:
            logger.error(f"Error extracting follow-up information: {e}")
            return {}
    
    def _build_intent_extraction_prompt(self, message: str, user_context: Dict[str, Any] = None) -> str:
        """Build the conversational form collection engine prompt for intent extraction."""
        
        # Build user display information based on role - EXACT format as specified
        user_display = "Unknown User"
        if user_context:
            name = user_context.get('name', 'Unknown')
            role = user_context.get('role', 'guest')
            room_number = user_context.get('room_number', '')
            designation = user_context.get('designation', '')
            
            if role == 'student' and room_number:
                user_display = f"{name} (Room {room_number})"
            elif role in ['staff', 'warden'] and designation:
                user_display = f"{name} ({designation})"
            else:
                user_display = name
        
        return f"""✅ MASTER PROMPT (Conversational Form Collection Engine)

You are an AI Hostel Management Assistant.
Your goal is to collect required information through natural conversation instead of asking everything at once.

Current User: {user_display}

🔹 Intent Handling
When user sends a message:
1. Detect intent (leave, guest, maintenance, rules, view status)
2. Load required fields for that intent
3. Check which fields are missing
4. Ask ONLY ONE missing field at a time
5. Store user answers
6. Repeat until all fields are collected
7. Show summary
8. Ask confirmation
9. Submit request

🔹 Conversational Questioning Rule
Never say: "Provide A, B, C"
Always say:
- Ask one short question
- Friendly and natural

Example: 
User: "I want to go home" 
Assistant: "From which date are you leaving?"
Next: "When will you return?" 
Next: "What is the reason for leave?"

🔹 Required Fields Mapping

LEAVE REQUEST:
- leave_from
- leave_to  
- reason

GUEST PERMISSION:
- guest_name
- visit_date
- duration

MAINTENANCE:
- problem_description
- location

🔹 CRITICAL EXTRACTION RULES (MUST FOLLOW STRICTLY!)

⚠️  GUEST_NAME EXTRACTION PROTOCOL:
Step 1: IDENTIFY if message is a guest request
Step 2: SEARCH for a PERSON NAME (proper noun, person's actual name)
Step 3: FILTER OUT these words - DO NOT use as guest_name:
   BLACKLIST: "permission", "request", "guest", "friend", "visitors", "visitor", "allow", "allowed", 
   "visit", "visiting", "stay", "staying", "approve", "approved", "approval", "want", "need", "have", 
   "coming", "please", "can", "will", "someone", "person", "name", "people", "anyone"
Step 4: VALIDATE - Is it a real person name? (Should sound like a person's name like "Rahul", "Priya", "Rohan")
Step 5: If NO valid person name found → guest_name = null, require_clarification = true

⚠️  EXAMPLES (MUST FOLLOW THIS PATTERN):
Input: "I need a guest permission"
  → Search: "permission" is in BLACKLIST
  → Result: guest_name = null, require_clarification = true ✓
  
Input: "I want Rahul to stay overnight"
  → Search: "Rahul" is a PERSON NAME, not in blacklist
  → Result: guest_name = "Rahul" ✓
  
Input: "Can my friend Priya visit?"
  → Search: "friend" in BLACKLIST, "Priya" is PERSON NAME
  → Result: guest_name = "Priya" ✓
  
Input: "My guest is coming"
  → Search: "guest" in BLACKLIST, no person name found
  → Result: guest_name = null, require_clarification = true ✓

For DATE extraction:
- "today" = current date
- "tomorrow" = current date + 1 day
- "this weekend" = next Saturday-Sunday
- If no date mentioned, set start_date=null and ask user for date

🔹 Missing Field Logic
- If field missing: Ask it.
- If user gives multiple values in one sentence: Extract and store all.
- If user gives unrelated answer: Repeat question politely.
- Always validate extracted names follow PERSON NAME rules above

🔹 Example Flow (Leave)
User: I want to go home
Bot: From which date are you leaving?
User: Tomorrow
Bot: When will you return?
User: Sunday
Bot: Reason for leave?
User: Family function

Then:
Please confirm:
Leave From: Tomorrow
Leave To: Sunday
Reason: Family function
Reply YES or NO.

🔹 Example Flow (Guest)
User: I want guest permission
Bot: What is the guest name?
User: Rahul
Bot: When will Rahul visit?
User: Today
Bot: For how many hours or days?
User: 3 hours

🔹 Smart Behavior
If visit duration ≤ same day → Auto approve
Else → Send to warden

🔹 Tone
- Short
- Professional
- Clear
- No emojis

🔹 Error Handling
If system fails: "Unable to process request. Please try again."

User Message: "{message}"

Context Information:
- user_id: {user_context.get('user_id', 'unknown') if user_context else 'unknown'}
- name: {user_context.get('name', 'Unknown') if user_context else 'Unknown'}
- role: {user_context.get('role', 'guest') if user_context else 'guest'}
- room_number: {user_context.get('room_number', 'N/A') if user_context and user_context.get('role') == 'student' else 'N/A'}
- designation: {user_context.get('designation', 'N/A') if user_context and user_context.get('role') in ['staff', 'warden'] else 'N/A'}

Return a JSON response with this EXACT structure:
{{
    "intent": "guest_request|leave_request|maintenance_request|rule_inquiry|general_query",
    "entities": {{
        "guest_name": "string or null",
        "start_date": "YYYY-MM-DD or null",
        "end_date": "YYYY-MM-DD or null", 
        "duration_days": "number or null",
        "room_number": "string or null",
        "problem_description": "string or null",
        "location": "string or null",
        "leave_from": "YYYY-MM-DD or null",
        "leave_to": "YYYY-MM-DD or null",
        "reason": "string or null"
    }},
    "confidence": 0.0-1.0,
    "requires_clarification": true/false,
    "missing_info": ["list of missing required information"]
}}

Return ONLY valid JSON, no additional text or formatting.
"""
    
    def _build_clarification_prompt(self, incomplete_data: Dict[str, Any]) -> str:
        """Build the prompt for generating clarification questions."""
        return f"""
You are a helpful hostel coordination assistant. A student has made a request but some information is missing.

Request Details:
Intent: {incomplete_data.get('intent', 'unknown')}
Current Information: {json.dumps(incomplete_data.get('entities', {}), indent=2)}
Missing Information: {incomplete_data.get('missing_info', [])}

Generate a friendly, specific clarification question to get the missing information. 
Keep it conversational and helpful. Ask for only the most critical missing piece of information.

Return only the question text, no additional formatting.
"""
    
    def _build_rule_explanation_prompt(self, rule_query: str, context: Dict[str, Any] = None) -> str:
        """Build an enhanced prompt for rule explanations."""
        
        context_info = ""
        if context:
            context_info = f"""
Student Context:
- Student: {context.get('student', 'Unknown')}
- Room: {context.get('room', 'Unknown')}
"""
        
        return f"""
You are a helpful hostel coordination assistant explaining hostel rules and policies to students.

{context_info}

Student Question: "{rule_query}"

COMPREHENSIVE HOSTEL RULES DATABASE:

**GUEST POLICY:**
- Auto-approved: 1 night stays for students with clean records
- Manual approval required: Stays longer than 1 night
- Check-in required: All guests must register at reception with ID
- Timing: Guests allowed 6 AM - 11 PM only
- Maximum: 2 guests per room at any time
- Host responsibility: Student responsible for guest behavior
- Violations: Affect future guest request approvals

**LEAVE/ABSENCE POLICY:**
- Auto-approved: Up to 2 days with 24+ hours advance notice
- Manual approval: Leaves longer than 2 days or short notice
- Security notification: Must inform security before leaving and upon return
- Room security: Keep room locked, don't leave valuables
- Emergency contact: Provide emergency contact for long absences
- Plan changes: Contact warden immediately if plans change

**MAINTENANCE POLICY:**
- Immediate reporting: Report all issues via chat or directly to warden
- Emergency issues: Water leaks, electrical problems, security issues - call warden directly
- Access provision: Be available to provide room access for repairs
- Damage liability: Students charged for intentional or negligent damage
- Timeline: Emergency repairs within 4 hours, routine repairs within 2-3 days
- Follow-up: Report if issue persists after attempted repair

**CLEANING POLICY:**
- Weekly service: Professional cleaning available weekly
- Scheduling: Request via chat system or warden's office
- Preparation: Remove valuables, personal items before cleaning
- Access: Provide room access during scheduled cleaning time
- Basic maintenance: Students responsible for daily tidiness
- Deep cleaning: Available on special request with advance notice

**QUIET HOURS & NOISE:**
- Quiet hours: 10 PM - 6 AM in all areas (strictly enforced)
- Common areas: Considerate noise levels at all times
- Music/TV: Headphones required during quiet hours
- Guest responsibility: Host responsible for guest noise compliance
- Violations: Progressive warnings, potential guest privilege suspension
- Complaints: Contact security immediately for noise issues

**INTERNET & FACILITIES:**
- WiFi: Free access, network 'HostelWiFi', password from reception
- Usage: Fair usage policy, no illegal downloads or streaming abuse
- Common areas: Shared kitchen, study rooms, laundry facilities
- Kitchen: Clean after use, label food items, no overnight dishes
- Laundry: Book time slots, remove clothes promptly

**SECURITY & SAFETY:**
- Room keys: Don't duplicate or lend to others
- Visitors: All non-residents must be registered
- Emergency: Fire exits clearly marked, don't block
- Valuables: Use provided lockers, hostel not liable for theft
- Suspicious activity: Report immediately to security or warden

RESPONSE GUIDELINES:
1. Directly answer their specific question with relevant policy details
2. Provide clear, actionable information
3. Include any important exceptions or special cases
4. Offer to help create relevant requests if applicable
5. Use friendly, helpful tone - you're here to help, not enforce
6. If policy seems restrictive, explain the reasoning (safety, fairness, etc.)
7. Suggest alternatives when possible

Keep response concise but complete. Use bullet points for clarity. End with an offer to help with related requests or questions.
"""
    
    def _build_staff_query_intent_prompt(self, message: str, user_context: Dict[str, Any] = None) -> str:
        """
        Build a prompt for extracting staff query intent - NO HARDCODING!
        Uses AI to determine what the staff member is asking for.
        """
        staff_name = "Unknown Staff"
        staff_role = "staff"
        
        if user_context:
            staff_name = user_context.get('staff_id', 'Unknown')
            staff_role = user_context.get('staff_role', 'staff')
        
        return f"""You are an AI Hostel Management Assistant processing a staff query.
Your job is to extract the INTENT of what the staff member wants, NOT to hardcode keyword matching.

Staff User: {staff_name} ({staff_role})
Query: "{message}"

STAFF QUERY INTENTS (Determine which one matches):
1. count_present_students - Staff wants to know HOW MANY students are currently present
2. list_present_students - Staff wants a LIST of all present students with details
3. count_absent_students - Staff wants to know HOW MANY students are currently absent
4. list_absent_students - Staff wants a LIST of all absent students with details
5. count_pending_requests - Staff wants to know HOW MANY pending requests there are
6. list_pending_requests - Staff wants a LIST of pending requests (guest/leave/maintenance)
7. count_active_guests - Staff wants to know HOW MANY guests are currently staying
8. list_active_guests - Staff wants a LIST of all active guests with details
9. room_status - Staff wants STATUS of a specific room (student presence, guests, issues)
10. delete_request - Staff wants to DELETE a pending request
11. daily_summary - Staff wants TODAY'S SUMMARY or REPORT
12. general_query - Other staff queries that don't fit above categories

INTELLIGENCE RULES (Not Keyword Matching):
- "How many" OR "count" OR "total" → Usually COUNT intent
- "Name", "List", "Show", "Display", "Tell me who", "Enumerate" → Usually LIST intent  
- "Status", "What about", "Tell me about" + room/student → room_status intent
- "Delete", "Remove", "Wipe", "Clear" + (student/data/record) → DELETE_REQUEST intent (PRIORITY!)
- "Summary", "Report", "Today" → daily_summary intent

CONTEXT-AWARE UNDERSTANDING:
- "Name all the students which are present" → list_present_students (not hardcoded)
- "Show me who is absent" → list_absent_students  
- "How many guests staying?" → count_active_guests
- "What's happening in room 101?" → room_status with room_number=101
- "What about the guest requests?" → list_pending_requests with type=guest

Extract parameters from the query:
- room_number: If staff mentions a specific room
- request_type: If they're asking about specific types (guest, absence, maintenance)
- status_filter: What they want to see (pending, approved, etc.)

Return ONLY this JSON (no explanation, no extra text):
{{
    "staff_query_intent": "one of the intents listed above",
    "parameters": {{
        "room_number": "extracted room number or null",
        "request_type": "guest|absence|maintenance or null",
        "status_filter": "pending|approved|all or null"
    }},
    "confidence": 0.0 to 1.0,
    "explanation": "Brief explanation of why this intent was chosen"
}}
"""
    
    def _build_followup_extraction_prompt(self, extraction_context: Dict[str, Any]) -> str:
        """Build the prompt for extracting information from follow-up responses."""
        return f"""
You are processing a follow-up response in an ongoing conversation about a hostel request.

Original Intent: {extraction_context.get('original_intent', 'unknown')}
Missing Information: {extraction_context.get('missing_information', [])}
Already Collected: {json.dumps(extraction_context.get('collected_information', {}), indent=2)}
Last Question Asked: "{extraction_context.get('last_question', '')}"
Student Response: "{extraction_context.get('response_text', '')}"

Extract any relevant information from the student's response that fills in the missing information.

Return a JSON response with this structure:
{{
    "extracted_info": {{
        "field_name": "extracted_value",
        // Only include fields that you can confidently extract from the response
    }}
}}

Common field mappings:
- Names: guest_name, emergency_contact_name
- Dates: arrival_date, departure_date, start_date, end_date, return_date
- Times: arrival_time, departure_time
- Descriptions: problem_description, reason_for_leave, issue_description
- Numbers: room_number, guest_phone, emergency_contact
- Types: issue_type, urgency_level

Only extract information you are confident about. If the response is unclear or doesn't contain the requested information, return an empty extracted_info object.

Return only valid JSON, no additional text.
"""
    
    def _normalize_intent_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize and validate the intent extraction result."""
        normalized = {
            "intent": result.get("intent", "unknown"),
            "entities": result.get("entities", {}),
            "confidence": float(result.get("confidence", 0.0)),
            "requires_clarification": result.get("requires_clarification", False),
            "missing_info": result.get("missing_info", [])
        }
        
        # Ensure confidence is between 0 and 1
        normalized["confidence"] = max(0.0, min(1.0, normalized["confidence"]))
        
        return normalized
    
    def generate_intelligent_response(self, intent: str, current_entities: Dict[str, Any], 
                                     missing_fields: List[str], user_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Generate an intelligent, context-aware response based on collected information.
        Asks follow-up questions for missing information dynamically using Gemini.
        
        Args:
            intent: The detected intent (leave_request, maintenance_request, etc.)
            current_entities: Currently collected entity data
            missing_fields: List of missing required fields
            user_context: User context information
            
        Returns:
            Dictionary with follow-up question or confirmation message
        """
        if not self.model:
            return {
                "status": "error",
                "message": "AI service not available",
                "action": "error"
            }
        
        try:
            # If all info is collected, return confirmation
            if not missing_fields:
                return {
                    "status": "complete",
                    "message": self._build_confirmation_message(intent, current_entities),
                    "action": "confirm",
                    "entities": current_entities
                }
            
            # Otherwise, ask for the next missing field dynamically
            prompt = self._build_dynamic_followup_prompt(
                intent, 
                current_entities, 
                missing_fields[0],  # Ask for one field at a time
                user_context
            )
            
            response_text = self._call_gemini_with_retry(prompt)
            
            if response_text:
                return {
                    "status": "requires_info",
                    "message": response_text.strip(),
                    "action": "ask",
                    "current_entities": current_entities,
                    "next_field": missing_fields[0],
                    "remaining_fields": missing_fields[1:]
                }
            else:
                return {
                    "status": "error",
                    "message": "Unable to generate follow-up question",
                    "action": "error"
                }
                
        except Exception as e:
            logger.error(f"Error generating intelligent response: {e}")
            return {
                "status": "error",
                "message": f"An error occurred: {str(e)}",
                "action": "error"
            }
    
    def _build_dynamic_followup_prompt(self, intent: str, collected_entities: Dict[str, Any],
                                      next_missing_field: str, user_context: Dict[str, Any] = None) -> str:
        """Build a prompt for dynamically asking the next required field."""
        
        # Map intent to user-friendly labels
        intent_labels = {
            "maintenance_request": "Maintenance Request",
            "leave_request": "Leave Request",
            "guest_request": "Guest Permission",
            "rule_inquiry": "Hostel Rules Query"
        }
        
        intent_label = intent_labels.get(intent, intent.replace("_", " ").title())
        
        # Get user display name
        user_name = "User"
        if user_context:
            user_name = user_context.get('name', 'User')
        
        return f"""You are a helpful Hostel Assistant having a natural conversation with {user_name}.

Current Request Type: {intent_label}

Information Already Collected:
{json.dumps(collected_entities, indent=2)}

Next Required Information: {next_missing_field.replace('_', ' ').title()}

Your task: Ask a natural, conversational question to get the missing information about "{next_missing_field.replace('_', ' ')}".

Rules:
1. Be friendly and concise (one short sentence)
2. Reference what they've already told you to show you're listening
3. Ask only one thing at a time
4. No technical jargon
5. No emojis
6. Make it feel like a natural conversation

Example good questions:
- "What area or room is the problem in?"
- "Which dates are you planning to be away?"
- "Can you describe what's broken?"

Return ONLY the question text, nothing else. No JSON, no preamble."""

    
    def _build_confirmation_message(self, intent: str, entities: Dict[str, Any]) -> str:
        """Build a confirmation message summarizing the collected information."""
        
        intent_details = {
            "maintenance_request": self._format_maintenance_summary(entities),
            "leave_request": self._format_leave_summary(entities),
            "guest_request": self._format_guest_summary(entities)
        }
        
        summary = intent_details.get(intent, "Here's what I've collected:")
        
        return f"""Perfect! I have all the information needed. Please confirm:

{summary}

Reply with YES to submit or NO to make changes."""

    
    def _format_maintenance_summary(self, entities: Dict[str, Any]) -> str:
        """Format maintenance request summary."""
        problem = entities.get('problem_description', 'Not specified')
        location = entities.get('location', 'Not specified')
        
        return f"""Maintenance Request:
• Problem: {problem}
• Location: {location}"""

    
    def _format_leave_summary(self, entities: Dict[str, Any]) -> str:
        """Format leave request summary."""
        from_date = entities.get('leave_from', 'Not specified')
        to_date = entities.get('leave_to', 'Not specified')
        reason = entities.get('reason', 'Not specified')
        
        return f"""Leave Request:
• From: {from_date}
• To: {to_date}
• Reason: {reason}"""

    
    def _format_guest_summary(self, entities: Dict[str, Any]) -> str:
        """Format guest request summary."""
        guest_name = entities.get('guest_name', 'Not specified')
        visit_date = entities.get('start_date', 'Not specified')
        duration = entities.get('duration_days', 'Not specified')
        
        return f"""Guest Permission:
• Guest Name: {guest_name}
• Visit Date: {visit_date}
• Duration: {duration} days"""
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create a standardized error response."""
        return {
            "intent": "unknown",
            "entities": {},
            "confidence": 0.0,
            "requires_clarification": True,
            "missing_info": ["Unable to process request"],
            "error": error_message
        }


# Global instance - only create if Django is available
if DJANGO_AVAILABLE:
    gemini_service = GeminiService()
else:
    gemini_service = None