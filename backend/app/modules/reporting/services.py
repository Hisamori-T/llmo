import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.utils.credits import check_and_deduct
from app.shared.constants.plans import CREDIT_COSTS
from .pdf_generator import generate_pdf


class ReportService:
    async def create(
        self,
        diagnosis_id: str,
        agency_id: str,
        member_id: str,
        report_type: str,
    ) -> dict:
        diagnosis = await db_get('diagnoses', diagnosis_id)
        if not diagnosis or diagnosis.get('agency_id') != agency_id:
            raise ValueError('Diagnosis not found')
        if diagnosis.get('status') != 'completed':
            raise ValueError('Diagnosis is not completed yet')

        operation = 'simple_pdf' if report_type == 'simple' else 'detailed_pdf'
        await check_and_deduct(member_id, operation)

        now = datetime.now(timezone.utc).isoformat()
        report_id = str(uuid.uuid4())

        await db_set('reports', report_id, {
            'report_id': report_id,
            'diagnosis_id': diagnosis_id,
            'client_id': diagnosis.get('client_id', ''),
            'agency_id': agency_id,
            'member_id': member_id,
            'type': report_type,
            'status': 'completed',
            'share_token': None,
            'credits_used': CREDIT_COSTS[operation],
            'created_at': now,
        })

        return await db_get('reports', report_id)

    async def list_reports(self, agency_id: str, client_id: Optional[str] = None) -> list:
        docs = await db_query(
            'reports',
            filters=[('agency_id', '==', agency_id)],
            limit=100,
        )
        if client_id:
            docs = [d for d in docs if d.get('client_id') == client_id]
        docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        return docs

    async def get(self, report_id: str, agency_id: str) -> Optional[dict]:
        doc = await db_get('reports', report_id)
        if not doc or doc.get('agency_id') != agency_id:
            return None
        return doc

    async def get_by_token(self, token: str) -> Optional[dict]:
        docs = await db_query('reports', filters=[('share_token', '==', token)], limit=1)
        return docs[0] if docs else None

    async def generate_pdf_bytes(self, report: dict) -> bytes:
        diagnosis = await db_get('diagnoses', report['diagnosis_id'])
        client = await db_get('clients', report.get('client_id', ''))
        agency = await db_get('agencies', report['agency_id'])
        return generate_pdf(
            diagnosis=diagnosis or {},
            client=client or {},
            agency=agency or {},
            report_type=report.get('type', 'simple'),
        )

    async def create_share_link(self, report_id: str, agency_id: str) -> str:
        report = await self.get(report_id, agency_id)
        if not report:
            raise ValueError('Report not found')

        if report.get('share_token'):
            token = report['share_token']
        else:
            token = secrets.token_urlsafe(32)
            await db_update('reports', report_id, {'share_token': token})

        return f'{settings.app_url}/share/{token}'
