import os
import sys
from pathlib import Path

# Debug: Check if DATABASE_URL is available at import time
print(f"[API INIT] DATABASE_URL in env: {bool(os.environ.get('DATABASE_URL'))}")
if os.environ.get('DATABASE_URL'):
    print(f"[API INIT] DATABASE_URL starts with: {os.environ.get('DATABASE_URL')[:30]}...")

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Ensure the project root is in the Python path
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Also add the parent directory to handle imports
if str(BASE_DIR.parent) not in sys.path:
    sys.path.insert(0, str(BASE_DIR.parent))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostel_coordination.settings')

# Import Django
try:
    import django
    django.setup()
except Exception as e:
    print(f"Django setup error: {e}")
    import traceback
    traceback.print_exc()
    raise

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()

# Vercel handler
app = application
