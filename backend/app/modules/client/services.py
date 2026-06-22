import uuid
from datetime import datetime, timezone
from typing import Optional

from app.shared.db.firestore import db_get, db_query, db_set, db_update


class ClientService:
    async def create(
        self,
        agency_id: str,
        user_id: str,
        data: dict,
    ) -> dict:
        agency = await db_get('agencies', agency_id)
        if not agency:
            raise ValueError('Agency not found')

        existing = await db_query('clients', filters=[('agency_id', '==', agency_id)], limit=10000)
        active = [c for c in existing if c.get('status') != 'deleted']
        max_clients = agency.get('max_clients', 10)
        if len(active) >= max_clients:
            raise ValueError(f'Max clients ({max_clients}) reached for this plan')

        now = datetime.now(timezone.utc).isoformat()
        client_id = str(uuid.uuid4())
        doc = {
            'client_id': client_id,
            'agency_id': agency_id,
            'name': data['name'],
            'url': data['url'],
            'industry': data.get('industry', ''),
            'location': data.get('location', ''),
            'contact_name': data.get('contact_name', ''),
            'contact_email': data.get('contact_email', ''),
            'contact_phone': data.get('contact_phone', ''),
            'tags': data.get('tags', []),
            'note': data.get('note', ''),
            'status': 'active',
            'created_at': now,
            'updated_at': now,
            'created_by': user_id,
            'latest_diagnosis_id': None,
            'latest_score': None,
        }
        await db_set('clients', client_id, doc)
        return {'_id': client_id, **doc}

    async def list_clients(
        self,
        agency_id: str,
        member_id: Optional[str] = None,
        role: str = 'admin',
        search: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> list:
        if role == 'admin':
            clients = await db_query(
                'clients',
                filters=[('agency_id', '==', agency_id)],
                limit=500,
            )
            clients.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        else:
            member = await db_get('agency_members', member_id) if member_id else None
            assigned_ids = member.get('assigned_client_ids', []) if member else []
            if not assigned_ids:
                return []
            clients = []
            for cid in assigned_ids:
                c = await db_get('clients', cid)
                if c:
                    clients.append(c)

        result = [c for c in clients if c.get('status') != 'deleted']

        if search:
            s = search.lower()
            result = [c for c in result if s in c.get('name', '').lower() or s in c.get('url', '').lower()]
        if industry:
            result = [c for c in result if c.get('industry') == industry]

        return result

    async def get(self, client_id: str, agency_id: str) -> Optional[dict]:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id or client.get('status') == 'deleted':
            return None
        return client

    async def update(self, client_id: str, agency_id: str, updates: dict) -> dict:
        client = await self.get(client_id, agency_id)
        if not client:
            raise ValueError('Client not found')

        allowed_fields = {'name', 'url', 'industry', 'location', 'contact_name',
                          'contact_email', 'contact_phone', 'tags', 'note', 'status'}
        filtered = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
        filtered['updated_at'] = datetime.now(timezone.utc).isoformat()

        await db_update('clients', client_id, filtered)
        return await db_get('clients', client_id)

    async def delete(self, client_id: str, agency_id: str) -> None:
        client = await self.get(client_id, agency_id)
        if not client:
            raise ValueError('Client not found')
        await db_update('clients', client_id, {
            'status': 'deleted',
            'updated_at': datetime.now(timezone.utc).isoformat(),
        })
