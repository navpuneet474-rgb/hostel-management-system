"""
End-to-End Chat Workflow Tests
Tests the complete chat workflow from student message to AI response.
"""

import pytest
import json
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from django.utils import timezone

from ..models import Student, Staff, Message, GuestRequest, AbsenceRecord, MaintenanceRequest, AuditLog
from ..authentication import SupabaseUser
from ..services.ai_engine_service import IntentResult
from ..services.auto_approval_service import AutoApprovalResult, EscalationRoute, EscalationReason
from ..services.message_router_service import ProcessingStatus


class EndToEndChatWorkflowTest(TransactionTestCase):
    """Test complete end-to-end chat workflow scenarios."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test student
        self.student = Student.objects.create(
            student_id="E2E001",
            name="End-to-End Test Student",
            room_number="201A",
            block="B",
            phone="1234567890"
        )
        
        # Create test staff
        self.staff = Staff.objects.create(
            staff_id="E2E_STAFF",
            name="End-to-End Test Staff",
            role="warden",
            permissions={"approve_guests": True},
            phone="0987654321",
            email="wardenSITARE@gmail.com"
        )
        
        # Create authenticated users
        self.student_user = SupabaseUser(
            {'id': 'e2e-student-001', 'email': 'e2e001@hostel.edu', 'user_metadata': {'role': 'student'}},
            'student',
            self.student
        )
        
        self.staff_user = SupabaseUser(
            {'id': 'e2e-staff-001', 'email': 'e2estaff@hostel.edu', 'user_metadata': {'role': 'staff'}},
            'staff',
            self.staff
        )
    
    def test_simple_guest_request_auto_approval_workflow(self):
        """Test complete workflow for a simple guest request that gets auto-approved."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to return guest request intent
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='guest_request',
                confidence=0.95,
                entities={
                    'guest_name': 'John Doe',
                    'start_date': '2024-01-15T18:00:00Z',
                    'end_date': '2024-01-16T10:00:00Z',
                    'duration_hours': 16
                },
                requires_clarification=False,
                missing_info=[]
            )
            
            # Mock auto-approval engine to approve the request
            with patch('core.services.auto_approval_service.auto_approval_engine.evaluate_request') as mock_approval:
                mock_approval.return_value = AutoApprovalResult(
                    approved=True,
                    decision_type='auto_approved',
                    reasoning='Guest stay is 1 night or less with clean student record',
                    confidence=0.95,
                    rules_applied=['guest_duration_rule', 'student_record_rule'],
                    escalation_route=None,
                    audit_data={'auto_approval': True}
                )
                
                # Send message
                url = reverse('core:message-list')
                data = {
                    'content': 'My friend John Doe will stay tonight from 6 PM to 10 AM tomorrow'
                }
                
                response = self.client.post(url, data, format='json')
                
                # Verify response
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response.data['success'])
                self.assertIn('message_id', response.data)
                self.assertIn('ai_response', response.data)
                self.assertIn('approved', response.data['ai_response'].lower())
                self.assertEqual(response.data['status'], 'success')
                self.assertFalse(response.data['needs_clarification'])
                
                # Verify message was created and processed
                message = Message.objects.get(message_id=response.data['message_id'])
                self.assertEqual(message.sender, self.student)
                self.assertEqual(message.status, 'processed')
                self.assertTrue(message.processed)
                self.assertIsNotNone(message.extracted_intent)
                
                # Verify audit log was created
                audit_logs = AuditLog.objects.filter(
                    entity_type='message',
                    entity_id=str(message.message_id)
                )
                self.assertTrue(audit_logs.exists())
    
    def test_complex_request_escalation_workflow(self):
        """Test workflow for a complex request that gets escalated to staff."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to return complex guest request
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='guest_request',
                confidence=0.88,
                entities={
                    'guest_name': 'Multiple Guests',
                    'start_date': '2024-01-15T18:00:00Z',
                    'end_date': '2024-01-18T10:00:00Z',  # 3 days - exceeds auto-approval
                    'duration_hours': 64
                },
                requires_clarification=False,
                missing_info=[]
            )
            
            # Mock auto-approval engine to escalate the request
            with patch('core.services.auto_approval_service.auto_approval_engine.evaluate_request') as mock_approval:
                mock_approval.return_value = AutoApprovalResult(
                    approved=False,
                    decision_type='escalated',
                    reasoning='Guest stay exceeds 1 night limit, requires warden approval',
                    confidence=0.88,
                    rules_applied=['guest_duration_rule'],
                    escalation_route=EscalationRoute(
                        staff_role='warden',
                        priority='normal',
                        reason=EscalationReason.COMPLEX_REQUEST,
                        additional_info={'estimated_response_time': '24 hours'}
                    ),
                    audit_data={'escalation_reason': 'duration_exceeded'}
                )
                
                # Send message
                url = reverse('core:message-list')
                data = {
                    'content': 'I need guest permission for multiple friends for 3 days starting tonight'
                }
                
                response = self.client.post(url, data, format='json')
                
                # Verify response
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response.data['success'])
                self.assertIn('forwarded', response.data['ai_response'].lower())
                self.assertEqual(response.data['status'], 'escalated')
                self.assertFalse(response.data['needs_clarification'])
                
                # Verify message was processed
                message = Message.objects.get(message_id=response.data['message_id'])
                self.assertEqual(message.status, 'processed')
                self.assertTrue(message.processed)
    
    def test_clarification_needed_workflow(self):
        """Test workflow when AI needs clarification from student."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to return incomplete intent
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='guest_request',
                confidence=0.65,  # Low confidence
                entities={
                    'guest_name': None,  # Missing guest name
                    'start_date': '2024-01-15T18:00:00Z',
                    'end_date': None,  # Missing end date
                },
                requires_clarification=True,
                missing_info=['guest_name', 'end_date']
            )
            
            # Mock followup bot to generate clarification question
            with patch('core.services.followup_bot_service.followup_bot_service.generate_clarification_question') as mock_clarification:
                mock_clarification.return_value = "I understand you want guest permission, but I need more details. What is your guest's name and when will they be leaving?"
                
                # Send message
                url = reverse('core:message-list')
                data = {
                    'content': 'I need guest permission for tonight'
                }
                
                response = self.client.post(url, data, format='json')
                
                # Verify response
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response.data['success'])
                self.assertEqual(response.data['status'], 'requires_clarification')
                self.assertTrue(response.data['needs_clarification'])
                self.assertIn('need more details', response.data['ai_response'])
                self.assertIsNotNone(response.data['clarification_question'])
                
                # Verify message was processed
                message = Message.objects.get(message_id=response.data['message_id'])
                self.assertEqual(message.status, 'processed')
                self.assertTrue(message.processed)
    
    def test_maintenance_request_workflow(self):
        """Test workflow for maintenance requests."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to return maintenance intent
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='maintenance_request',
                confidence=0.92,
                entities={
                    'issue_description': 'AC not working',
                    'urgency': 'normal',
                    'room_number': '201A'
                },
                requires_clarification=False,
                missing_info=[]
            )
            
            # Mock auto-approval engine to approve maintenance
            with patch('core.services.auto_approval_service.auto_approval_engine.evaluate_request') as mock_approval:
                mock_approval.return_value = AutoApprovalResult(
                    approved=True,
                    decision_type='auto_approved',
                    reasoning='Basic maintenance issue, automatically scheduled',
                    confidence=0.92,
                    rules_applied=['maintenance_auto_approval_rule'],
                    escalation_route=None,
                    audit_data={'auto_scheduled': True}
                )
                
                # Send message
                url = reverse('core:message-list')
                data = {
                    'content': 'My AC is not working in room 201A'
                }
                
                response = self.client.post(url, data, format='json')
                
                # Verify response
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response.data['success'])
                self.assertIn('scheduled', response.data['ai_response'].lower())
                self.assertEqual(response.data['status'], 'success')
                self.assertFalse(response.data['needs_clarification'])
    
    def test_leave_request_workflow(self):
        """Test workflow for leave requests."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to return leave request intent
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='leave_request',
                confidence=0.89,
                entities={
                    'start_date': '2024-01-20T09:00:00Z',
                    'end_date': '2024-01-21T18:00:00Z',
                    'reason': 'family visit',
                    'duration_days': 1
                },
                requires_clarification=False,
                missing_info=[]
            )
            
            # Mock auto-approval engine to approve leave
            with patch('core.services.auto_approval_service.auto_approval_engine.evaluate_request') as mock_approval:
                mock_approval.return_value = AutoApprovalResult(
                    approved=True,
                    decision_type='auto_approved',
                    reasoning='Leave request is 2 days or less with proper notice',
                    confidence=0.89,
                    rules_applied=['leave_duration_rule', 'advance_notice_rule'],
                    escalation_route=None,
                    audit_data={'auto_approved': True}
                )
                
                # Send message
                url = reverse('core:message-list')
                data = {
                    'content': 'I need leave tomorrow for a family visit, will be back by evening'
                }
                
                response = self.client.post(url, data, format='json')
                
                # Verify response
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response.data['success'])
                self.assertIn('approved', response.data['ai_response'].lower())
                self.assertEqual(response.data['status'], 'success')
    
    def test_message_history_loading(self):
        """Test loading of conversation history."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Create some historical messages
        messages = []
        for i in range(3):
            message = Message.objects.create(
                sender=self.student,
                content=f'Test message {i+1}',
                status='processed',
                processed=True,
                confidence_score=0.9
            )
            messages.append(message)
        
        # Get recent messages
        url = reverse('core:message-recent')
        response = self.client.get(url)
        
        # Verify response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(len(response.data['results']), 3)
        
        # Verify messages are in reverse chronological order (newest first)
        returned_messages = response.data['results']
        self.assertEqual(returned_messages[0]['content'], 'Test message 3')
        self.assertEqual(returned_messages[1]['content'], 'Test message 2')
        self.assertEqual(returned_messages[2]['content'], 'Test message 1')
    
    def test_error_handling_workflow(self):
        """Test error handling in the chat workflow."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to raise an exception
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.side_effect = Exception("AI service unavailable")
            
            # Send message
            url = reverse('core:message-list')
            data = {
                'content': 'This should cause an error'
            }
            
            response = self.client.post(url, data, format='json')
            
            # Verify error response
            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.assertFalse(response.data['success'])
            self.assertIn('error', response.data)
            self.assertIn('message_id', response.data)
            
            # Verify message was created but marked as failed
            message = Message.objects.get(message_id=response.data['message_id'])
            self.assertEqual(message.status, 'failed')
            self.assertFalse(message.processed)
    
    def test_conversation_context_management(self):
        """Test conversation context is properly managed across messages."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine for first message
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='guest_request',
                confidence=0.7,
                entities={'guest_name': 'John'},
                requires_clarification=True,
                missing_info=['end_date']
            )
            
            with patch('core.services.followup_bot_service.followup_bot_service.generate_clarification_question') as mock_clarification:
                mock_clarification.return_value = "When will John be leaving?"
                
                # Send first message
                url = reverse('core:message-list')
                data = {'content': 'My friend John wants to stay'}
                
                response1 = self.client.post(url, data, format='json')
                
                # Verify first response asks for clarification
                self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response1.data['needs_clarification'])
                conversation_id = response1.data['conversation_id']
                
                # Mock AI engine for follow-up message
                mock_extract.return_value = IntentResult(
                    intent='guest_request',
                    confidence=0.95,
                    entities={
                        'guest_name': 'John',
                        'end_date': '2024-01-16T10:00:00Z'
                    },
                    requires_clarification=False,
                    missing_info=[]
                )
                
                # Mock auto-approval for complete request
                with patch('core.services.auto_approval_service.auto_approval_engine.evaluate_request') as mock_approval:
                    mock_approval.return_value = AutoApprovalResult(
                        approved=True,
                        decision_type='auto_approved',
                        reasoning='Complete guest request approved',
                        confidence=0.95,
                        rules_applied=['guest_duration_rule'],
                        escalation_route=None,
                        audit_data={'follow_up_completed': True}
                    )
                    
                    # Send follow-up message
                    data = {'content': 'He will leave tomorrow morning at 10 AM'}
                    response2 = self.client.post(url, data, format='json')
                    
                    # Verify follow-up was processed successfully
                    self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
                    self.assertTrue(response2.data['success'])
                    self.assertEqual(response2.data['status'], 'success')
                    self.assertFalse(response2.data['needs_clarification'])
    
    def test_staff_escalation_notification(self):
        """Test that staff are properly notified when requests are escalated."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to return request that needs escalation
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='guest_request',
                confidence=0.85,
                entities={
                    'guest_name': 'Emergency Guest',
                    'start_date': '2024-01-15T22:00:00Z',
                    'end_date': '2024-01-20T10:00:00Z',  # 5 days
                    'urgency': 'high'
                },
                requires_clarification=False,
                missing_info=[]
            )
            
            # Mock auto-approval engine to escalate
            with patch('core.services.auto_approval_service.auto_approval_engine.evaluate_request') as mock_approval:
                mock_approval.return_value = AutoApprovalResult(
                    approved=False,
                    decision_type='escalated',
                    reasoning='Extended guest stay requires warden approval',
                    confidence=0.85,
                    rules_applied=['guest_duration_rule', 'emergency_rule'],
                    escalation_route=EscalationRoute(
                        staff_role='warden',
                        priority='high',
                        reason=EscalationReason.COMPLEX_REQUEST,
                        additional_info={'estimated_response_time': '4 hours', 'urgency': 'high'}
                    ),
                    audit_data={'escalation_reason': 'extended_duration', 'urgency': 'high'}
                )
                
                # Send message
                url = reverse('core:message-list')
                data = {
                    'content': 'Emergency: I need guest permission for 5 days starting tonight'
                }
                
                response = self.client.post(url, data, format='json')
                
                # Verify escalation response
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertTrue(response.data['success'])
                self.assertEqual(response.data['status'], 'escalated')
                self.assertIn('warden', response.data['ai_response'].lower())
                
                # Verify audit log contains escalation information
                message = Message.objects.get(message_id=response.data['message_id'])
                audit_log = AuditLog.objects.filter(
                    entity_type='message',
                    entity_id=str(message.message_id)
                ).first()
                
                self.assertIsNotNone(audit_log)
                self.assertEqual(audit_log.decision, 'escalated')
                self.assertIn('escalation_reason', audit_log.metadata)


class ChatInterfaceIntegrationTest(TestCase):
    """Test chat interface integration with backend services."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test student
        self.student = Student.objects.create(
            student_id="INT001",
            name="Integration Test Student",
            room_number="301A",
            block="C"
        )
    
    def test_chat_interface_renders_correctly(self):
        """Test that chat interface renders with proper context."""
        # Test unauthenticated access (should work in development mode)
        url = reverse('chat_interface')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'AI Hostel Assistant')
        self.assertContains(response, 'Guest Permission')
        self.assertContains(response, 'Leave Request')
        self.assertContains(response, 'Maintenance')
        self.assertContains(response, 'Rules & Policies')
    
    def test_health_check_endpoint(self):
        """Test health check endpoint for chat interface monitoring."""
        url = reverse('core:health_check')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.data)
        self.assertIn('services', response.data)
        self.assertIn('django', response.data['services'])
    
    def test_system_info_endpoint(self):
        """Test system info endpoint for debugging."""
        url = reverse('core:system_info')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('project', response.data)
        self.assertIn('endpoints', response.data)
        self.assertIn('messages', response.data['endpoints'])
    
    def test_conversation_status_endpoint(self):
        """Test conversation status endpoint."""
        url = reverse('core:conversation_status')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('conversations', response.data)
        self.assertEqual(response.data['total_conversations'], 0)


class MessageProcessingPerformanceTest(TestCase):
    """Test message processing performance and reliability."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test student
        self.student = Student.objects.create(
            student_id="PERF001",
            name="Performance Test Student",
            room_number="401A",
            block="D"
        )
        
        self.student_user = SupabaseUser(
            {'id': 'perf-student-001', 'email': 'perf001@hostel.edu'},
            'student',
            self.student
        )
    
    def test_concurrent_message_processing(self):
        """Test that multiple messages can be processed concurrently."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine for consistent responses
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            mock_extract.return_value = IntentResult(
                intent='general_query',
                confidence=0.8,
                entities={},
                requires_clarification=False,
                missing_info=[]
            )
            
            # Send multiple messages
            url = reverse('core:message-list')
            messages = []
            
            for i in range(5):
                data = {'content': f'Test message {i+1}'}
                response = self.client.post(url, data, format='json')
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                messages.append(response.data['message_id'])
            
            # Verify all messages were processed
            for message_id in messages:
                message = Message.objects.get(message_id=message_id)
                self.assertEqual(message.status, 'processed')
                self.assertTrue(message.processed)
    
    def test_message_processing_timeout_handling(self):
        """Test handling of processing timeouts."""
        # Authenticate as student
        self.client.force_authenticate(user=self.student_user)
        
        # Mock AI engine to simulate slow processing
        with patch('core.services.ai_engine_service.ai_engine_service.extract_intent') as mock_extract:
            import time
            
            def slow_processing(*args, **kwargs):
                time.sleep(0.1)  # Simulate processing delay
                return IntentResult(
                    intent='general_query',
                    confidence=0.8,
                    entities={},
                    requires_clarification=False,
                    missing_info=[]
                )
            
            mock_extract.side_effect = slow_processing
            
            # Send message
            url = reverse('core:message-list')
            data = {'content': 'This message takes time to process'}
            
            response = self.client.post(url, data, format='json')
            
            # Should still succeed despite delay
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(response.data['success'])