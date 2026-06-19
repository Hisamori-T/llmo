from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from models.database import get_db
from models.models import User, Diagnosis, DiagnosisStatusEnum
from middleware.auth_middleware import get_current_user
from services.diagnosis_service import DiagnosisService
import uuid

router = APIRouter()
diagnosis_service = DiagnosisService()

class DiagnosisRequest(BaseModel):
    company_name: str
    industry: str
    location: Optional[str] = None
    keywords: Optional[List[str]] = None

@router.post('')
async def create_diagnosis(
    req: DiagnosisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from models.models import PlanEnum
    CREDIT_LIMITS = {PlanEnum.starter: 100, PlanEnum.pro: 500, PlanEnum.enterprise: 2000}
    limit = CREDIT_LIMITS[current_user.plan]

    if current_user.monthly_credits_used + 10 > limit:
        raise HTTPException(status_code=429, detail='Monthly credit limit exceeded')

    diagnosis = Diagnosis(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        org_id=current_user.org_id,
        company_name=req.company_name,
        industry=req.industry,
        location=req.location,
        keywords=req.keywords or [],
        status=DiagnosisStatusEnum.pending,
        credits_consumed=10,
    )
    db.add(diagnosis)
    await db.commit()

    background_tasks.add_task(diagnosis_service.run_diagnosis, db, diagnosis, current_user)

    return {'diagnosis_id': diagnosis.id, 'status': 'pending'}

@router.get('')
async def list_diagnoses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Diagnosis).where(Diagnosis.user_id == current_user.id).order_by(Diagnosis.created_at.desc()).limit(50)
    )
    diagnoses = result.scalars().all()
    return {'items': [_serialize(d) for d in diagnoses]}

@router.get('/{diagnosis_id}')
async def get_diagnosis(
    diagnosis_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Diagnosis).where(Diagnosis.id == diagnosis_id))
    diagnosis = result.scalar_one_or_none()
    if not diagnosis:
        raise HTTPException(status_code=404, detail='Diagnosis not found')
    if diagnosis.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Forbidden')
    return _serialize(diagnosis)

def _serialize(d: Diagnosis) -> dict:
    return {
        'id': d.id,
        'companyName': d.company_name,
        'industry': d.industry,
        'location': d.location,
        'keywords': d.keywords,
        'status': d.status.value,
        'scores': d.scores or {},
        'findings': d.findings or [],
        'recommendations': d.recommendations or [],
        'createdAt': d.created_at.isoformat(),
        'completedAt': d.completed_at.isoformat() if d.completed_at else None,
    }
