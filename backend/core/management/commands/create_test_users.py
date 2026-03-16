"""
Management command to create test users for development and testing.
"""

from django.core.management.base import BaseCommand
from core.models import Student, Staff


class Command(BaseCommand):
    help = 'Create test users (students and staff) for development'

    def handle(self, *args, **options):
        self.stdout.write('Creating test users...')
        
        # Create test student
        try:
            student, created = Student.objects.get_or_create(
                student_id='STU001',
                defaults={
                    'name': 'Test Student',
                    'email': 'student@hostel.edu',
                    'room_number': '101',
                    'block': 'A',
                    'phone': '1234567890',
                    'is_first_login': False
                }
            )
            if created:
                student.set_password('student123')
                student.save()
                self.stdout.write(self.style.SUCCESS(f'✓ Created student: student@hostel.edu / student123'))
            else:
                # Update password for existing student
                student.set_password('student123')
                student.save()
                self.stdout.write(self.style.WARNING(f'✓ Updated existing student: student@hostel.edu / student123'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error creating student: {e}'))
        
        # Create test security staff
        try:
            security, created = Staff.objects.get_or_create(
                staff_id='SEC001',
                defaults={
                    'name': 'Security Guard',
                    'email': 'security@hostel.edu',
                    'role': 'security',
                    'phone': '9876543210',
                    'is_active': True
                }
            )
            if created:
                security.set_password('security123')
                security.save()
                self.stdout.write(self.style.SUCCESS(f'✓ Created security: security@hostel.edu / security123'))
            else:
                security.set_password('security123')
                security.save()
                self.stdout.write(self.style.WARNING(f'✓ Updated existing security: security@hostel.edu / security123'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error creating security: {e}'))
        
        # Create test warden
        try:
            warden, created = Staff.objects.get_or_create(
                staff_id='WAR001',
                defaults={
                    'name': 'Hostel Warden',
                    'email': 'warden@hostel.edu',
                    'role': 'warden',
                    'phone': '9876543211',
                    'is_active': True
                }
            )
            if created:
                warden.set_password('warden123')
                warden.save()
                self.stdout.write(self.style.SUCCESS(f'✓ Created warden: warden@hostel.edu / warden123'))
            else:
                warden.set_password('warden123')
                warden.save()
                self.stdout.write(self.style.WARNING(f'✓ Updated existing warden: warden@hostel.edu / warden123'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error creating warden: {e}'))
        
        self.stdout.write(self.style.SUCCESS('\n=== Test Users Created ==='))
        self.stdout.write('Student Login:')
        self.stdout.write('  Email: student@hostel.edu')
        self.stdout.write('  Password: student123')
        self.stdout.write('\nSecurity Login:')
        self.stdout.write('  Email: security@hostel.edu')
        self.stdout.write('  Password: security123')
        self.stdout.write('\nWarden Login:')
        self.stdout.write('  Email: warden@hostel.edu')
        self.stdout.write('  Password: warden123')
