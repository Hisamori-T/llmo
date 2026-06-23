"""Firebase Auth stub (v4.0) — Firebase Auth is removed, use JWT auth instead."""
from typing import Optional


async def verify_id_token(id_token: str) -> dict:
    raise NotImplementedError('Firebase Auth removed in v4.0. Use JWT verify in shared/api/deps.py.')


async def create_firebase_user(email: str, password: str, display_name: str = '') -> str:
    raise NotImplementedError('Firebase Auth removed in v4.0. Use authentication/services.py.')


async def generate_email_action_link(email: str, action_code_settings: Optional[dict] = None) -> str:
    raise NotImplementedError('Firebase Auth removed in v4.0.')
