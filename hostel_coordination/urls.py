"""
URL configuration for hostel_coordination project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from core.views import chat_interface, staff_dashboard, staff_query_interface, pass_history_view, security_dashboard, maintenance_dashboard, active_passes_view
from core.auth_views import (
    login_view, logout_view, student_dashboard, change_password_view, 
    profile_view, create_student_account, update_student_profile, update_staff_student_profile,
    require_authentication, require_staff_authentication
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    
    # Authentication URLs
    path('login/', login_view, name='login'),
    path('auth/login/', login_view, name='auth_login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/change-password/', change_password_view, name='change_password'),
    
    # Student URLs
    path('student/dashboard/', require_authentication(student_dashboard), name='student_dashboard'),
    path('student/profile/', require_authentication(profile_view), name='student_profile'),
    path('student/update-profile/', update_student_profile, name='update_student_profile'),
    
    # Staff URLs (Warden/Admin)
    path('staff/', require_staff_authentication(staff_dashboard), name='staff_dashboard'),
    path('staff/query/', require_staff_authentication(staff_query_interface), name='staff_query_interface'),
    path('staff/pass-history/', require_staff_authentication(pass_history_view), name='pass_history'),
    path('staff/profile/', require_staff_authentication(profile_view), name='staff_profile'),
    path('staff/create-student/', create_student_account, name='create_student_account'),
    path('staff/update-student-profile/', update_staff_student_profile, name='update_staff_student_profile'),
    
    # Security Staff URLs
    path('security/dashboard/', require_staff_authentication(security_dashboard), name='security_dashboard'),
    path('security/active-passes/', require_staff_authentication(active_passes_view), name='security_active_passes'),
    path('security/profile/', require_staff_authentication(profile_view), name='security_profile'),
    
    # Maintenance Staff URLs
    path('maintenance/dashboard/', require_staff_authentication(maintenance_dashboard), name='maintenance_dashboard'),
    path('maintenance/profile/', require_staff_authentication(profile_view), name='maintenance_profile'),
    
    # Chat interface (requires authentication)
    path('chat/', require_authentication(chat_interface), name='chat_interface'),
    
    # Default redirect to login
    path('', login_view, name='home'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
