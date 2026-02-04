"""
Authentication views for the AI-Powered Hostel Coordination System.
Handles dual role login (students and staff), password management, and profile views.
"""

import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth import logout as django_logout
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import json

from .models import Student, Staff
from .security import InputValidator, SecurityAuditLogger

logger = logging.getLogger(__name__)


def login_view(request):
    """
    Dual role login view for both students and staff.
    Displays login form and handles authentication.
    """
    if request.method == 'GET':
        # Check if user is already logged in
        if hasattr(request, 'session') and request.session.get('user_id'):
            user_type = request.session.get('user_type')
            if user_type == 'student':
                return redirect('student_dashboard')
            elif user_type == 'staff':
                return redirect('staff_dashboard')
        
        return render(request, 'auth/login.html')
    
    elif request.method == 'POST':
        return handle_login(request)


@csrf_exempt
@require_http_methods(["POST"])
def handle_login(request):
    """
    Handle login form submission for both students and staff.
    """
    try:
        # Parse request data
        if request.content_type == 'application/json':
            data = json.loads(request.body)
        else:
            data = request.POST
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        user_type = data.get('user_type', 'student')  # Default to student
        
        # Validate input
        if not email or not password:
            return JsonResponse({
                'success': False,
                'error': 'Email and password are required'
            }, status=400)
        
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({
                'success': False,
                'error': 'Please enter a valid email address'
            }, status=400)
        
        # Validate password length
        if len(password) < 6:
            return JsonResponse({
                'success': False,
                'error': 'Password must be at least 6 characters long'
            }, status=400)
        
        # Log login attempt
        SecurityAuditLogger.log_security_event(
            event_type='login_attempt',
            details={'email': email, 'user_type': user_type},
            request=request,
            severity='INFO'
        )
        
        # Authenticate based on user type
        user_object = None
        if user_type == 'student':
            try:
                user_object = Student.objects.get(email=email)
                if not user_object.check_password(password):
                    raise Student.DoesNotExist()
            except Student.DoesNotExist:
                SecurityAuditLogger.log_security_event(
                    event_type='login_failed',
                    details={'email': email, 'user_type': user_type, 'reason': 'invalid_credentials'},
                    request=request,
                    severity='WARNING'
                )
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid email or password'
                }, status=401)
        
        elif user_type == 'staff':
            try:
                user_object = Staff.objects.get(email=email, is_active=True)
                if not user_object.check_password(password):
                    raise Staff.DoesNotExist()
            except Staff.DoesNotExist:
                SecurityAuditLogger.log_security_event(
                    event_type='login_failed',
                    details={'email': email, 'user_type': user_type, 'reason': 'invalid_credentials'},
                    request=request,
                    severity='WARNING'
                )
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid email or password'
                }, status=401)
        
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid user type'
            }, status=400)
        
        # Create session
        request.session['user_id'] = user_object.student_id if user_type == 'student' else user_object.staff_id
        request.session['user_type'] = user_type
        request.session['user_email'] = email
        request.session['login_time'] = timezone.now().isoformat()
        
        # Check if first-time login for students
        is_first_login = False
        if user_type == 'student' and user_object.is_first_login:
            is_first_login = True
        
        # Log successful login
        SecurityAuditLogger.log_security_event(
            event_type='login_success',
            details={
                'email': email, 
                'user_type': user_type, 
                'user_id': user_object.student_id if user_type == 'student' else user_object.staff_id,
                'is_first_login': is_first_login
            },
            request=request,
            severity='INFO'
        )
        
        # Determine redirect URL based on user type and role
        if user_type == 'student':
            redirect_url = '/student/dashboard/'
        else:
            # Route staff based on their role
            staff_role = user_object.role if hasattr(user_object, 'role') else 'staff'
            if staff_role == 'security':
                redirect_url = '/security/dashboard/'
            elif staff_role == 'maintenance':
                redirect_url = '/maintenance/dashboard/'
            else:
                # warden, admin, or other staff roles go to staff dashboard
                redirect_url = '/staff/'
        
        return JsonResponse({
            'success': True,
            'message': 'Login successful',
            'user_type': user_type,
            'is_first_login': is_first_login,
            'redirect_url': redirect_url,
            'user': {
                'name': user_object.name,
                'email': user_object.email,
                'id': user_object.student_id if user_type == 'student' else user_object.staff_id
            }
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Login error: {e}\n{error_details}")
        SecurityAuditLogger.log_security_event(
            event_type='login_error',
            details={'error': str(e), 'traceback': error_details},
            request=request,
            severity='ERROR'
        )
        # Temporarily show detailed error for debugging
        return JsonResponse({
            'success': False,
            'error': f'Debug: {str(e)}',
            'details': error_details[:500]  # First 500 chars of traceback
        }, status=500)


def logout_view(request):
    """
    Logout view that clears session and redirects to login.
    """
    # Log logout event
    user_id = request.session.get('user_id', 'unknown')
    user_type = request.session.get('user_type', 'unknown')
    
    SecurityAuditLogger.log_security_event(
        event_type='logout',
        details={'user_id': user_id, 'user_type': user_type},
        request=request,
        severity='INFO'
    )
    
    # Clear session
    request.session.flush()
    
    messages.success(request, 'You have been logged out successfully.')
    return redirect('login')


def student_dashboard(request):
    """
    Student dashboard view with authentication check.
    """
    # Check authentication
    if not request.session.get('user_id') or request.session.get('user_type') != 'student':
        return redirect('login')
    
    try:
        student = Student.objects.get(student_id=request.session['user_id'])
        
        # Check if first-time login
        if student.is_first_login:
            return redirect('change_password')
        
        # Get student's recent activity
        recent_messages = student.messages.order_by('-created_at')[:5]
        recent_guest_requests = student.guest_requests.order_by('-created_at')[:5]
        recent_absence_records = student.absence_records.order_by('-created_at')[:5]
        recent_maintenance_requests = student.maintenance_requests.order_by('-created_at')[:5]
        
        context = {
            'student': student,
            'recent_messages': recent_messages,
            'recent_guest_requests': recent_guest_requests,
            'recent_absence_records': recent_absence_records,
            'recent_maintenance_requests': recent_maintenance_requests,
        }
        
        return render(request, 'student/dashboard.html', context)
        
    except Student.DoesNotExist:
        messages.error(request, 'Student account not found.')
        return redirect('login')


def change_password_view(request):
    """
    Password change view for first-time login and regular password changes.
    """
    # Check authentication
    if not request.session.get('user_id'):
        return redirect('login')
    
    user_type = request.session.get('user_type')
    user_id = request.session.get('user_id')
    
    if request.method == 'GET':
        try:
            if user_type == 'student':
                user_object = Student.objects.get(student_id=user_id)
            else:
                user_object = Staff.objects.get(staff_id=user_id)
            
            context = {
                'user': user_object,
                'user_type': user_type,
                'is_first_login': user_object.is_first_login if user_type == 'student' else False
            }
            
            return render(request, 'auth/change_password.html', context)
            
        except (Student.DoesNotExist, Staff.DoesNotExist):
            messages.error(request, 'User account not found.')
            return redirect('login')
    
    elif request.method == 'POST':
        return handle_password_change(request)


@csrf_exempt
@require_http_methods(["POST"])
def handle_password_change(request):
    """
    Handle password change form submission.
    """
    try:
        # Parse request data
        if request.content_type == 'application/json':
            data = json.loads(request.body)
        else:
            data = request.POST
        
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')
        mobile_number = data.get('mobile_number', '').strip()
        roll_number = data.get('roll_number', '').strip()
        
        user_type = request.session.get('user_type')
        user_id = request.session.get('user_id')
        
        # Validate input
        if not current_password or not new_password or not confirm_password:
            return JsonResponse({
                'success': False,
                'error': 'All password fields are required'
            }, status=400)
        
        if new_password != confirm_password:
            return JsonResponse({
                'success': False,
                'error': 'New passwords do not match'
            }, status=400)
        
        if len(new_password) < 6:
            return JsonResponse({
                'success': False,
                'error': 'New password must be at least 6 characters long'
            }, status=400)
        
        # Get user object
        try:
            if user_type == 'student':
                user_object = Student.objects.get(student_id=user_id)
            else:
                user_object = Staff.objects.get(staff_id=user_id)
        except (Student.DoesNotExist, Staff.DoesNotExist):
            return JsonResponse({
                'success': False,
                'error': 'User account not found'
            }, status=404)
        
        # Verify current password
        if not user_object.check_password(current_password):
            SecurityAuditLogger.log_security_event(
                event_type='password_change_failed',
                details={'user_id': user_id, 'user_type': user_type, 'reason': 'invalid_current_password'},
                request=request,
                severity='WARNING'
            )
            return JsonResponse({
                'success': False,
                'error': 'Current password is incorrect'
            }, status=401)
        
        # Update password and additional fields
        user_object.set_password(new_password)
        
        if user_type == 'student':
            if mobile_number:
                user_object.mobile_number = mobile_number
            if roll_number:
                user_object.roll_number = roll_number
            user_object.is_first_login = False
        
        user_object.save()
        
        # Log successful password change
        SecurityAuditLogger.log_security_event(
            event_type='password_changed',
            details={'user_id': user_id, 'user_type': user_type},
            request=request,
            severity='INFO'
        )
        
        # Determine redirect URL based on user type and role
        if user_type == 'student':
            password_redirect_url = '/student/dashboard/'
        else:
            staff_role = user_object.role if hasattr(user_object, 'role') else 'staff'
            if staff_role == 'security':
                password_redirect_url = '/security/dashboard/'
            elif staff_role == 'maintenance':
                password_redirect_url = '/maintenance/dashboard/'
            else:
                password_redirect_url = '/staff/'
        
        return JsonResponse({
            'success': True,
            'message': 'Password changed successfully',
            'redirect_url': password_redirect_url
        })
        
    except Exception as e:
        logger.error(f"Password change error: {e}")
        SecurityAuditLogger.log_security_event(
            event_type='password_change_error',
            details={'error': str(e)},
            request=request,
            severity='ERROR'
        )
        return JsonResponse({
            'success': False,
            'error': 'An error occurred while changing password. Please try again.'
        }, status=500)


def profile_view(request):
    """
    Profile view for both students and staff.
    """
    # Check authentication
    if not request.session.get('user_id'):
        return redirect('login')
    
    user_type = request.session.get('user_type')
    user_id = request.session.get('user_id')
    
    try:
        if user_type == 'student':
            user_object = Student.objects.get(student_id=user_id)
            template = 'student/profile.html'
        else:
            user_object = Staff.objects.get(staff_id=user_id)
            template = 'staff/profile.html'
            
            # For staff, also get all students if they have permission
            if user_object.role in ['warden', 'admin']:
                all_students = Student.objects.all().order_by('student_id')
                context = {
                    'user': user_object,
                    'user_type': user_type,
                    'all_students': all_students
                }
                return render(request, template, context)
        
        context = {
            'user': user_object,
            'user_type': user_type
        }
        
        return render(request, template, context)
        
    except (Student.DoesNotExist, Staff.DoesNotExist):
        messages.error(request, 'User account not found.')
        return redirect('login')


@api_view(['POST'])
@permission_classes([AllowAny])
def update_student_profile(request):
    """
    API endpoint for students to update their own profile information.
    """
    # Check if user is authenticated student
    if not request.session.get('user_id') or request.session.get('user_type') != 'student':
        return Response({
            'success': False,
            'error': 'Student authentication required'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        student = Student.objects.get(student_id=request.session['user_id'])
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Student account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        # Get form data
        mobile_number = request.data.get('mobile_number', '').strip()
        roll_number = request.data.get('roll_number', '').strip()
        
        # Update allowed fields
        if mobile_number:
            student.mobile_number = mobile_number
        if roll_number:
            student.roll_number = roll_number
        
        student.save()
        
        # Log profile update
        SecurityAuditLogger.log_security_event(
            event_type='profile_updated',
            details={
                'student_id': student.student_id,
                'fields_updated': ['mobile_number', 'roll_number']
            },
            request=request,
            severity='INFO'
        )
        
        return Response({
            'success': True,
            'message': 'Profile updated successfully',
            'student': {
                'student_id': student.student_id,
                'name': student.name,
                'email': student.email,
                'mobile_number': student.mobile_number,
                'roll_number': student.roll_number,
                'room_number': student.room_number,
                'block': student.block
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error updating student profile: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while updating the profile. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def update_staff_student_profile(request):
    """
    API endpoint for staff to update student profile information.
    Only accessible by warden and admin staff.
    """
    # Check if user is authenticated staff with proper permissions
    if not request.session.get('user_id') or request.session.get('user_type') != 'staff':
        return Response({
            'success': False,
            'error': 'Staff authentication required'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        staff = Staff.objects.get(staff_id=request.session['user_id'])
        if staff.role not in ['warden', 'admin']:
            return Response({
                'success': False,
                'error': 'Insufficient permissions'
            }, status=status.HTTP_403_FORBIDDEN)
    except Staff.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Staff account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        # Get student to update
        student_id = request.data.get('student_id', '').strip()
        if not student_id:
            return Response({
                'success': False,
                'error': 'Student ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Student not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get form data
        name = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip().lower()
        mobile_number = request.data.get('mobile_number', '').strip()
        roll_number = request.data.get('roll_number', '').strip()
        room_number = request.data.get('room_number', '').strip()
        block = request.data.get('block', '').strip().upper()
        phone = request.data.get('phone', '').strip()
        
        updated_fields = []
        
        # Update fields if provided
        if name and name != student.name:
            student.name = name
            updated_fields.append('name')
        
        if email and email != student.email:
            # Check if email is already in use
            if Student.objects.filter(email=email).exclude(student_id=student_id).exists():
                return Response({
                    'success': False,
                    'error': f'Email {email} is already in use'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                validate_email(email)
                student.email = email
                updated_fields.append('email')
            except ValidationError:
                return Response({
                    'success': False,
                    'error': 'Please enter a valid email address'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        if mobile_number != student.mobile_number:
            student.mobile_number = mobile_number
            updated_fields.append('mobile_number')
        
        if roll_number != student.roll_number:
            student.roll_number = roll_number
            updated_fields.append('roll_number')
        
        if room_number and room_number != student.room_number:
            student.room_number = room_number
            updated_fields.append('room_number')
        
        if block and block != student.block:
            student.block = block
            updated_fields.append('block')
        
        if phone != student.phone:
            student.phone = phone
            updated_fields.append('phone')
        
        if updated_fields:
            student.save()
            
            # Log profile update
            SecurityAuditLogger.log_security_event(
                event_type='student_profile_updated_by_staff',
                details={
                    'student_id': student.student_id,
                    'updated_by': staff.staff_id,
                    'fields_updated': updated_fields
                },
                request=request,
                severity='INFO'
            )
        
        return Response({
            'success': True,
            'message': f'Student profile updated successfully' + (f' ({len(updated_fields)} fields changed)' if updated_fields else ' (no changes)'),
            'student': {
                'student_id': student.student_id,
                'name': student.name,
                'email': student.email,
                'mobile_number': student.mobile_number,
                'roll_number': student.roll_number,
                'room_number': student.room_number,
                'block': student.block,
                'phone': student.phone
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error updating student profile by staff: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while updating the profile. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_student_account(request):
    """
    API endpoint for staff to create new student accounts.
    Only accessible by warden and admin staff.
    """
    # Check if user is authenticated staff with proper permissions
    if not request.session.get('user_id') or request.session.get('user_type') != 'staff':
        return Response({
            'success': False,
            'error': 'Authentication required'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        staff = Staff.objects.get(staff_id=request.session['user_id'])
        if staff.role not in ['warden', 'admin']:
            return Response({
                'success': False,
                'error': 'Insufficient permissions'
            }, status=status.HTTP_403_FORBIDDEN)
    except Staff.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Staff account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        # Get form data
        student_id = request.data.get('student_id', '').strip().upper()
        name = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip().lower()
        room_number = request.data.get('room_number', '').strip()
        block = request.data.get('block', '').strip().upper()
        phone = request.data.get('phone', '').strip()
        
        # Validate required fields
        if not all([student_id, name, email, room_number, block]):
            return Response({
                'success': False,
                'error': 'Student ID, name, email, room number, and block are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate email format
        try:
            validate_email(email)
        except ValidationError:
            return Response({
                'success': False,
                'error': 'Please enter a valid email address'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if student ID or email already exists
        if Student.objects.filter(student_id=student_id).exists():
            return Response({
                'success': False,
                'error': f'Student ID {student_id} already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if Student.objects.filter(email=email).exists():
            return Response({
                'success': False,
                'error': f'Email {email} is already registered'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate default password
        default_password = Student.generate_default_password()
        
        # Create student account
        student = Student.objects.create(
            student_id=student_id,
            name=name,
            email=email,
            room_number=room_number,
            block=block,
            phone=phone,
            is_first_login=True
        )
        student.set_password(default_password)
        student.save()
        
        # Log account creation
        SecurityAuditLogger.log_security_event(
            event_type='student_account_created',
            details={
                'student_id': student_id,
                'created_by': staff.staff_id,
                'email': email
            },
            request=request,
            severity='INFO'
        )
        
        # TODO: Send email with login credentials (implement in email notification task)
        
        return Response({
            'success': True,
            'message': f'Student account created successfully for {name}',
            'student': {
                'student_id': student_id,
                'name': name,
                'email': email,
                'room_number': room_number,
                'block': block,
                'default_password': default_password  # In production, this should be sent via email
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating student account: {e}")
        return Response({
            'success': False,
            'error': 'An error occurred while creating the account. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def require_authentication(view_func):
    """
    Decorator to require session-based authentication.
    """
    def wrapper(request, *args, **kwargs):
        if not request.session.get('user_id'):
            if request.headers.get('Content-Type') == 'application/json':
                return JsonResponse({
                    'success': False,
                    'error': 'Authentication required',
                    'redirect_url': '/login/'
                }, status=401)
            else:
                return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper


def require_staff_authentication(view_func):
    """
    Decorator to require staff authentication.
    """
    def wrapper(request, *args, **kwargs):
        if not request.session.get('user_id') or request.session.get('user_type') != 'staff':
            if request.headers.get('Content-Type') == 'application/json':
                return JsonResponse({
                    'success': False,
                    'error': 'Staff authentication required',
                    'redirect_url': '/login/'
                }, status=403)
            else:
                messages.error(request, 'Staff access required.')
                return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper