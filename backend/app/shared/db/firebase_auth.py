import asyncio
from typing import Optional

from firebase_admin import auth

from .firestore import _init_firebase


async def verify_id_token(id_token: str) -> dict:
    _init_firebase()

    def _sync():
        return auth.verify_id_token(id_token)

    return await asyncio.to_thread(_sync)


async def create_firebase_user(email: str, password: str, display_name: str = '') -> str:
    """Create Firebase Auth user (for child account invitation)."""
    _init_firebase()

    def _sync():
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
        )
        return user.uid

    return await asyncio.to_thread(_sync)


async def generate_email_action_link(email: str, action_code_settings: Optional[dict] = None) -> str:
    """Generate email sign-in link for child account invitation."""
    _init_firebase()

    def _sync():
        from firebase_admin.auth import ActionCodeSettings
        settings = None
        if action_code_settings:
            settings = ActionCodeSettings(**action_code_settings)
        return auth.generate_sign_in_with_email_link(email, settings)

    return await asyncio.to_thread(_sync)
