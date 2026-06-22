# Entry point shim — uvicorn main:app is still supported for backward compatibility.
# The actual app is in app/main.py.
from app.main import app  # noqa: F401
