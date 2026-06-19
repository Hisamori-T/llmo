from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from models.database import get_db
from models.models import User, Report, Diagnosis
from middleware.auth_middleware import get_current_user
from services.report_service import generate_report_pdf, save_report
import uuid
import secrets
from datetime import datetime, timedelta

router = APIRouter()

class CreateReportRequest(BaseModel):
    diagnosis_id: str
    type: str = 'simple'

@router.post('')
async def create_report(
    req: CreateReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Diagnosis).where(Diagnosis.id == req.diagnosis_id, Diagnosis.user_id == current_user.id))
    diagnosis = result.scalar_one_or_none()
    if not diagnosis:
        raise HTTPException(status_code=404, detail='Diagnosis not found')
    if diagnosis.status.value != 'completed':
        raise HTTPException(status_code=400, detail='Diagnosis not completed')

    diagnosis_data = {
        'companyName': diagnosis.company_name,
        'industry': diagnosis.industry,
        'scores': diagnosis.scores or {},
        'findings': diagnosis.findings or [],
        'recommendations': diagnosis.recommendations or [],
    }
    pdf_bytes = generate_report_pdf(diagnosis_data, req.type)

    report_id = str(uuid.uuid4())
    pdf_path = save_report(report_id, pdf_bytes)

    report = Report(id=report_id, diagnosis_id=diagnosis.id, user_id=current_user.id, type=req.type, pdf_path=pdf_path)
    db.add(report)
    await db.commit()

    return {'report_id': report_id, 'type': req.type}

@router.get('')
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report).where(Report.user_id == current_user.id).order_by(Report.created_at.desc()).limit(50)
    )
    reports = result.scalars().all()
    return {'items': [_serialize(r) for r in reports]}

@router.get('/{report_id}/download')
async def download_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id, Report.user_id == current_user.id))
    report = result.scalar_one_or_none()
    if not report or not report.pdf_path:
        raise HTTPException(status_code=404, detail='Report not found')
    return FileResponse(report.pdf_path, media_type='application/pdf', filename=f'llmo-report-{report_id[:8]}.pdf')

@router.post('/{report_id}/share')
async def share_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id, Report.user_id == current_user.id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail='Report not found')

    token = secrets.token_urlsafe(32)
    report.share_token = token
    report.share_expires_at = datetime.utcnow() + timedelta(days=30)
    await db.commit()

    from core.config import settings
    share_url = f'{settings.app_url}/shared/report/{token}'
    return {'share_url': share_url, 'expires_at': report.share_expires_at.isoformat()}

def _serialize(r: Report) -> dict:
    return {
        'id': r.id,
        'diagnosisId': r.diagnosis_id,
        'type': r.type,
        'createdAt': r.created_at.isoformat(),
    }
