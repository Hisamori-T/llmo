import uuid
from datetime import datetime, timezone
from typing import Optional

from app.shared.db.firebase_auth import create_firebase_user
from app.shared.db.firestore import db_add, db_get, db_query, db_set, db_update
from app.shared.constants.plans import PLAN_CONFIG


class AgencyService:
    async def get_agency(self, agency_id: str) -> Optional[dict]:
        return await db_get('agencies', agency_id)

    async def update_agency(self, agency_id: str, updates: dict) -> dict:
        updates['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db_update('agencies', agency_id, updates)
        return await db_get('agencies', agency_id)

    async def get_stats(self, agency_id: str) -> dict:
        members = await db_query('agency_members', filters=[('agency_id', '==', agency_id)], limit=100)
        clients = await db_query('clients', filters=[('agency_id', '==', agency_id)], limit=1000)
        diagnoses = await db_query('diagnoses', filters=[('agency_id', '==', agency_id)], limit=1000)

        active_members = [m for m in members if m.get('status') == 'active']
        total_credits_used = sum(m.get('monthly_credit_used', 0) for m in active_members)
        total_credits_limit = sum(m.get('monthly_credit_limit', 0) for m in active_members)

        return {
            'total_clients': len(clients),
            'total_diagnoses': len(diagnoses),
            'total_credits_used': total_credits_used,
            'total_credits_limit': total_credits_limit,
            'member_count': len(members),
            'active_member_count': len(active_members),
        }

    async def list_members(self, agency_id: str) -> list:
        members = await db_query('agency_members', filters=[('agency_id', '==', agency_id)], limit=100)
        result = []
        for m in members:
            user = await db_get('users', m['user_id'])
            limit = m.get('monthly_credit_limit', 0)
            used = m.get('monthly_credit_used', 0)
            result.append({
                'member_id': m['_id'],
                'user_id': m['user_id'],
                'email': user.get('email', '') if user else '',
                'display_name': user.get('display_name', '') if user else '',
                'role': m['role'],
                'status': m['status'],
                'monthly_credit_limit': limit,
                'monthly_credit_used': used,
                'credits_remaining': max(0, limit - used),
                'joined_at': m.get('joined_at', ''),
            })
        return result

    async def invite_member(
        self,
        agency_id: str,
        email: str,
        role: str,
        display_name: str,
        monthly_credit_limit: Optional[int],
        inviter_user_id: str,
    ) -> dict:
        agency = await db_get('agencies', agency_id)
        if not agency:
            raise ValueError('Agency not found')

        plan_config = PLAN_CONFIG.get(agency.get('plan', 'starter'), PLAN_CONFIG['starter'])
        if monthly_credit_limit is None:
            monthly_credit_limit = plan_config['credits_per_child']

        existing_members = await db_query('agency_members', filters=[('agency_id', '==', agency_id)], limit=200)
        max_members = agency.get('max_child_accounts', plan_config['max_child_accounts'])
        active_non_admin = [m for m in existing_members if m.get('role') != 'admin' and m.get('status') != 'disabled']
        if len(active_non_admin) >= max_members:
            raise ValueError(f'Max child accounts ({max_members}) reached for this plan')

        import secrets
        temp_password = secrets.token_urlsafe(16)
        try:
            new_user_id = await create_firebase_user(email, temp_password, display_name)
        except Exception as e:
            raise ValueError(f'Failed to create user: {e}')

        now = datetime.now(timezone.utc).isoformat()
        await db_set('users', new_user_id, {
            'email': email,
            'display_name': display_name,
            'created_at': now,
            'updated_at': now,
        })

        member_id = str(uuid.uuid4())
        await db_set('agency_members', member_id, {
            'agency_id': agency_id,
            'user_id': new_user_id,
            'role': role,
            'monthly_credit_limit': monthly_credit_limit,
            'monthly_credit_used': 0,
            'credit_reset_date': now,
            'assigned_client_ids': [],
            'active_session_id': None,
            'status': 'invited',
            'invited_by': inviter_user_id,
            'joined_at': now,
        })

        return {
            'member_id': member_id,
            'user_id': new_user_id,
            'email': email,
            'role': role,
            'status': 'invited',
        }

    async def update_member(self, member_id: str, agency_id: str, updates: dict) -> dict:
        members = await db_query('agency_members', filters=[('_id', '==', member_id)], limit=1)
        if not members:
            members_by_id = await db_get('agency_members', member_id)
            if not members_by_id or members_by_id.get('agency_id') != agency_id:
                raise ValueError('Member not found')
            member = members_by_id
        else:
            member = members[0]
            if member.get('agency_id') != agency_id:
                raise ValueError('Member not found')

        if member.get('role') == 'admin':
            raise ValueError('Cannot modify admin member')

        allowed = {}
        if 'role' in updates and updates['role'] in ('staff', 'viewer'):
            allowed['role'] = updates['role']
        if 'monthly_credit_limit' in updates and isinstance(updates['monthly_credit_limit'], int):
            allowed['monthly_credit_limit'] = updates['monthly_credit_limit']
        if 'status' in updates and updates['status'] in ('active', 'disabled'):
            allowed['status'] = updates['status']

        await db_update('agency_members', member_id, allowed)
        return await db_get('agency_members', member_id)

    async def remove_member(self, member_id: str, agency_id: str) -> None:
        member = await db_get('agency_members', member_id)
        if not member or member.get('agency_id') != agency_id:
            raise ValueError('Member not found')
        if member.get('role') == 'admin':
            raise ValueError('Cannot remove admin member')

        await db_update('agency_members', member_id, {'status': 'disabled'})

        if member.get('active_session_id'):
            sessions = await db_query(
                'sessions',
                filters=[('session_id', '==', member['active_session_id'])],
                limit=1,
            )
            if sessions:
                await db_update('sessions', sessions[0]['_id'], {
                    'status': 'revoked',
                    'revoke_reason': 'member_removed',
                })
