import os
import sys

# Add the project directory to the sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostel_coordination.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()

# Vercel handler
app = application
