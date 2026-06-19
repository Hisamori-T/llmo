import firebase_admin
from firebase_admin import credentials, auth
from core.config import settings
import json

_initialized = False

def get_firebase_app():
    global _initialized
    if not _initialized and settings.firebase_project_id:
        cred_dict = {
            'type': 'service_account',
            'project_id': settings.firebase_project_id,
            'private_key_id': settings.firebase_private_key_id,
            'private_key': settings.firebase_private_key.replace('\\n', '\n'),
            'client_email': settings.firebase_client_email,
            'client_id': settings.firebase_client_id,
            'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
            'token_uri': 'https://oauth2.googleapis.com/token',
        }
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        _initialized = True
    return firebase_admin.get_app()

async def verify_firebase_token(id_token: str) -> dict:
    get_firebase_app()
    decoded = auth.verify_id_token(id_token)
    return decoded
