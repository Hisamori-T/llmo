import uuid
from datetime import datetime, timezone
from typing import Optional

from app.shared.db.firebase_auth import verify_id_token
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.utils.device import parse_device_info
from app.shared.constants.plans import PLAN_CONFIG


class AuthService:
    async def signup(
        self,
        id_token: str,
        agency_name: str,
        display_name: str,
        user_agent: Optional[str],
        ip_address: Optional[str],
    ) -> dict:
        decoded = await verify_id_token(id_token)
        user_id: str = decoded['uid']
        email: str = decoded.get('email', '')

        existing_user = await db_get('users', user_id)
        if existing_user:
            return await self._login_existing(user_id, email, display_name or existing_user.get('display_name', ''), user_agent, ip_address, force=False)

        now = datetime.now(timezone.utc).isoformat()
        display_name = display_name or decoded.get('name', email.split('@')[0])

        await db_set('users', user_id, {
            'email': email,
            'display_name': display_name,
            'created_at': now,
            'updated_at': now,
        })

        agency_id = str(uuid.uuid4())
        plan_config = PLAN_CONFIG['starter']
        await db_set('agencies', agency_id, {
            'name': agency_name,
            'owner_user_id': user_id,
            'plan': 'starter',
            'billing_cycle': 'monthly',
            'status': 'trial',
            'included_child_accounts': plan_config['included_child_accounts'],
            'additional_child_accounts': 0,
            'max_child_accounts': plan_config['max_child_accounts'],
            'credits_per_child': plan_config['credits_per_child'],
            'included_clients': plan_config['included_clients'],
            'additional_clients': 0,
            'max_clients': plan_config['max_clients'],
            'stripe_customer_id': None,
            'branding': {
                'logo_url': None,
                'primary_color': '#4F46E5',
                'contact_email': email,
            },
            'created_at': now,
            'updated_at': now,
        })

        member_id = str(uuid.uuid4())
        await db_set('agency_members', member_id, {
            'agency_id': agency_id,
            'user_id': user_id,
            'role': 'admin',
            'monthly_credit_limit': plan_config['credits_per_child'],
            'monthly_credit_used': 0,
            'credit_reset_date': now,
            'assigned_client_ids': [],
            'active_session_id': None,
            'status': 'active',
            'joined_at': now,
        })

        device_info = parse_device_info(user_agent, ip_address)
        session_id = str(uuid.uuid4())
        doc_id = str(uuid.uuid4())
        await db_set('sessions', doc_id, {
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

        return {
            'user_id': user_id,
            'agency_id': agency_id,
            'session_id': session_id,
            'role': 'admin',
        }

    async def login(
        self,
        id_token: str,
        force: bool,
        user_agent: Optional[str],
        ip_address: Optional[str],
    ) -> dict:
        decoded = await verify_id_token(id_token)
        user_id: str = decoded['uid']
        email: str = decoded.get('email', '')
        display_name: str = decoded.get('name', '')

        user = await db_get('users', user_id)
        if not user:
            return {'status': 'not_registered'}

        return await self._login_existing(user_id, email, display_name, user_agent, ip_address, force)

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
            existing_sessions = await db_query(
                'sessions',
                filters=[('session_id', '==', member['active_session_id'])],
                limit=1,
            )
            existing_sessions = [s for s in existing_sessions if s.get('status') == 'active']
            if existing_sessions:
                existing = existing_sessions[0]
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
        doc_id = str(uuid.uuid4())

        await db_set('sessions', doc_id, {
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

        await db_update('agency_members', member_id, {
            'active_session_id': session_id,
        })

        return {
            'status': 'success',
            'user_id': user_id,
            'agency_id': agency_id,
            'session_id': session_id,
            'role': member['role'],
        }

    async def logout(self, user_id: str, session_id: str) -> None:
        sessions = await db_query(
            'sessions',
            filters=[('session_id', '==', session_id), ('user_id', '==', user_id)],
            limit=1,
        )
        if not sessions:
            return

        session = sessions[0]
        await db_update('sessions', session['_id'], {
            'status': 'revoked',
            'revoke_reason': 'logout',
        })

        member_id = session.get('member_id')
        if member_id:
            await db_update('agency_members', member_id, {'active_session_id': None})
