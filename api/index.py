import os
import sys
from pathlib import Path

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostel_coordination.settings')

# Import Django
import django
django.setup()

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()

# Vercel handler
app = application
