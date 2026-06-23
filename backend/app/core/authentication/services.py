"""JWT-based authentication service (v4.1 — httpOnly cookie, atomic signup)."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.db.models import (
    Agency as AgencyModel,
    AgencyMember as AgencyMemberModel,
    Session as SessionModel,
    User as UserModel,
)
from app.shared.db.postgres import transaction
from app.shared.utils.device import parse_device_info
from app.shared.constants.plans import PLAN_CONFIG


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _make_tokens(user_id: str, session_id: str) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    access_payload = {
        'sub': user_id,
        'session_id': session_id,
        'type': 'access',
        'iat': now,
        'exp': now + timedelta(seconds=settings.access_token_ttl),
    }
    refresh_payload = {
        'sub': user_id,
        'session_id': session_id,
        'type': 'refresh',
        'iat': now,
        'exp': now + timedelta(seconds=settings.refresh_token_ttl),
    }
    access_token = jwt.encode(access_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    refresh_token = jwt.encode(refresh_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return access_token, refresh_token


class AuthService:
    async def signup(
        self,
        email: str,
        password: str,
        agency_name: str,
        display_name: str,
        user_agent: Optional[str],
        ip_address: Optional[str],
    ) -> dict:
        existing = await db_query('users', filters=[('email', '==', email)], limit=1)
        if existing:
            return {'status': 'already_registered'}

        now = datetime.now(timezone.utc).isoformat()
        user_id = str(uuid.uuid4())
        agency_id = str(uuid.uuid4())
        member_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        display_name = display_name or email.split('@')[0]
        plan_config = PLAN_CONFIG['starter']
        device_info = parse_device_info(user_agent, ip_address)

        # Atomic: User → Agency → AgencyMember → Session in one transaction
        async with transaction() as sess:
            sess.add(UserModel(
                id=user_id,
                email=email,
                password_hash=_hash_password(password),
                email_verified=False,
                display_name=display_name,
                created_at=now,
                updated_at=now,
            ))
            sess.add(AgencyModel(
                id=agency_id,
                name=agency_name,
                owner_user_id=user_id,
                plan='starter',
                billing_cycle='monthly',
                status='trial',
                included_child_accounts=plan_config['included_child_accounts'],
                additional_child_accounts=0,
                max_child_accounts=plan_config['max_child_accounts'],
                credits_per_child=plan_config['credits_per_child'],
                included_clients=plan_config['included_clients'],
                additional_clients=0,
                max_clients=plan_config['max_clients'],
                stripe_customer_id=None,
                branding={
                    'logo_url': None,
                    'primary_color': '#4F46E5',
                    'contact_email': email,
                },
                created_at=now,
                updated_at=now,
            ))
            sess.add(AgencyMemberModel(
                id=member_id,
                agency_id=agency_id,
                user_id=user_id,
                role='admin',
                monthly_credit_limit=plan_config['credits_per_child'],
                monthly_credit_used=0,
                credit_reset_date=now,
                assigned_client_ids=[],
                active_session_id=session_id,
                status='active',
                joined_at=now,
            ))
            sess.add(SessionModel(
                id=session_id,
                session_id=session_id,
                user_id=user_id,
                agency_id=agency_id,
                member_id=member_id,
                **device_info,
                ip_address=ip_address or '',
                user_agent=user_agent or '',
                status='active',
                revoke_reason=None,
                last_activity=now,
                created_at=now,
            ))

        access_token, refresh_token = _make_tokens(user_id, session_id)
        return {
            'user_id': user_id,
            'agency_id': agency_id,
            'session_id': session_id,
            'role': 'admin',
            'access_token': access_token,
            'refresh_token': refresh_token,
        }

    async def login(
        self,
        email: str,
        password: str,
        force: bool,
        user_agent: Optional[str],
        ip_address: Optional[str],
    ) -> dict:
        users = await db_query('users', filters=[('email', '==', email)], limit=1)
        if not users:
            return {'status': 'not_registered'}

        user = users[0]
        user_id: str = user['_id']
        password_hash = user.get('password_hash', '')
        if not password_hash or not _verify_password(password, password_hash):
            return {'status': 'invalid_credentials'}

        return await self._login_existing(
            user_id, email, user.get('display_name', ''), user_agent, ip_address, force
        )

    async def _login_existing(
        self,
        user_id: str,
        email: str,
        display_name: str,
        user_agent: Optional[str],
        ip_address: Optional[str],
        force: bool,
    ) -> dict:
        members = await db_query(
            'agency_members',
            filters=[('user_id', '==', user_id)],
            limit=10,
        )
        members = [m for m in members if m.get('status') == 'active']
        if not members:
            return {'status': 'no_membership'}

        member = members[0]
        member_id: str = member['_id']
        agency_id: str = member['agency_id']
        device_info = parse_device_info(user_agent, ip_address)

        if member.get('active_session_id'):
            # Direct PK lookup (id = session_id after v4.1 simplification)
            existing = await db_get('sessions', member['active_session_id'])
            if existing and existing.get('status') == 'active':
                if existing.get('browser_id') != device_info['browser_id'] and not force:
                    return {
                        'status': 'multiple_connection',
                        'existing_session': {
                            'browser_name': existing.get('browser_name'),
                            'browser_version': existing.get('browser_version'),
                            'os': existing.get('os'),
                            'ip_address': existing.get('ip_address'),
                            'last_activity': existing.get('last_activity'),
                        },
                    }
                if force:
                    await db_update('sessions', existing['_id'], {
                        'status': 'revoked',
                        'revoke_reason': 'forced_login',
                    })

        now = datetime.now(timezone.utc).isoformat()
        session_id = str(uuid.uuid4())

        await db_set('sessions', session_id, {
            'session_id': session_id,
            'user_id': user_id,
            'agency_id': agency_id,
            'member_id': member_id,
            **device_info,
            'ip_address': ip_address or '',
            'user_agent': user_agent or '',
            'status': 'active',
            'revoke_reason': None,
            'last_activity': now,
            'created_at': now,
        })

        await db_update('agency_members', member_id, {'active_session_id': session_id})

        access_token, refresh_token = _make_tokens(user_id, session_id)
        return {
            'status': 'success',
            'user_id': user_id,
            'agency_id': agency_id,
            'session_id': session_id,
            'role': member['role'],
            'access_token': access_token,
            'refresh_token': refresh_token,
        }

    async def refresh(self, refresh_token: str) -> dict:
        try:
            payload = jwt.decode(
                refresh_token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
        except jwt.ExpiredSignatureError:
            return {'status': 'expired'}
        except jwt.InvalidTokenError:
            return {'status': 'invalid'}

        if payload.get('type') != 'refresh':
            return {'status': 'invalid'}

        user_id: str = payload['sub']
        session_id: str = payload['session_id']

        # Direct PK lookup
        session = await db_get('sessions', session_id)
        if not session or session.get('status') != 'active':
            return {'status': 'session_expired'}

        new_access, new_refresh = _make_tokens(user_id, session_id)
        return {
            'status': 'success',
            'access_token': new_access,
            'refresh_token': new_refresh,
        }

    async def forgot_password(self, email: str, app_url: str) -> dict:
        users = await db_query('users', filters=[('email', '==', email)], limit=1)
        if not users:
            return {'status': 'ok'}  # Don't reveal existence

        user_id = users[0]['_id']
        now = datetime.now(timezone.utc)
        reset_payload = {
            'sub': user_id,
            'email': email,
            'type': 'password_reset',
            'iat': now,
            'exp': now + timedelta(hours=1),
        }
        token = jwt.encode(reset_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

        reset_url = f'{app_url}/auth/reset-password?token={token}'
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    'https://api.sendgrid.com/v3/mail/send',
                    headers={
                        'Authorization': f'Bearer {settings.sendgrid_api_key}',
                        'Content-Type': 'application/json',
                    },
                    json={
                        'personalizations': [{'to': [{'email': email}]}],
                        'from': {'email': settings.from_email},
                        'subject': '【LLMO Score】パスワードリセット',
                        'content': [{'type': 'text/plain', 'value': f'パスワードリセット用リンク（1時間有効）:\n{reset_url}'}],
                    },
                )
        except Exception:
            pass  # Best-effort; don't expose delivery failures
        return {'status': 'ok'}

    async def reset_password(self, token: str, new_password: str) -> dict:
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except jwt.InvalidTokenError:
            return {'status': 'invalid'}
        if payload.get('type') != 'password_reset':
            return {'status': 'invalid'}
        user_id: str = payload['sub']
        await db_update('users', user_id, {
            'password_hash': _hash_password(new_password),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        })
        return {'status': 'ok'}

    async def logout(self, user_id: str, session_id: str) -> None:
        # Direct PK lookup
        session = await db_get('sessions', session_id)
        if not session or session.get('user_id') != user_id:
            return

        await db_update('sessions', session_id, {
            'status': 'revoked',
            'revoke_reason': 'logout',
        })

        member_id = session.get('member_id')
        if member_id:
            await db_update('agency_members', member_id, {'active_session_id': None})
