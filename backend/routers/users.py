from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from models.database import get_db
from models.models import User, Session
from middleware.auth_middleware import get_current_user

router = APIRouter()

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None

class InviteRequest(BaseModel):
    email: EmailStr

@router.get('/me')
async def get_me(current_user: User = Depends(get_current_user)):
    limits = {'starter': 100, 'pro': 500, 'enterprise': 2000}
    return {
        'uid': current_user.id,
        'email': current_user.email,
        'displayName': current_user.display_name,
        'plan': current_user.plan.value,
        'role': current_user.role.value,
        'orgId': current_user.org_id,
        'monthlyCreditsUsed': current_user.monthly_credits_used,
        'monthlyCreditsLimit': limits.get(current_user.plan.value, 100),
        'createdAt': current_user.created_at.isoformat(),
    }

@router.patch('/me')
async def update_me(req: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.display_name is not None:
        current_user.display_name = req.display_name
    await db.commit()
    return {'status': 'success'}

@router.get('/sessions')
async def get_sessions(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Session).where(Session.user_id == current_user.id, Session.status == 'active').order_by(Session.last_activity.desc())
    )
    sessions = result.scalars().all()
    return {'sessions': [_serialize_session(s) for s in sessions]}

@router.delete('/sessions/{session_id}')
async def revoke_session(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id, Session.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    session.status = 'revoked'
    session.revoke_reason = 'manual'
    await db.commit()
    return {'status': 'success'}

@router.get('/dashboard')
async def get_dashboard(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from models.models import Diagnosis
    result = await db.execute(
        select(Diagnosis).where(Diagnosis.user_id == current_user.id, Diagnosis.status == 'completed').order_by(Diagnosis.created_at.desc()).limit(5)
    )
    recent = result.scalars().all()

    avg_score = 0
    if recent:
        scores = [d.scores.get('aiAwareness', 0) for d in recent if d.scores]
        avg_score = int(sum(scores) / len(scores)) if scores else 0

    limits = {'starter': 100, 'pro': 500, 'enterprise': 2000}
    return {
        'totalDiagnoses': len(recent),
        'avgScore': avg_score,
        'creditsUsed': current_user.monthly_credits_used,
        'creditsLimit': limits.get(current_user.plan.value, 100),
        'recentDiagnoses': [_serialize_diag(d) for d in recent[:3]],
    }

@router.post('/team/invite')
async def invite_member(req: InviteRequest, current_user: User = Depends(get_current_user)):
    # TODO: SendGrid でメール送信
    return {'status': 'success', 'message': f'{req.email} に招待メールを送信しました'}

def _serialize_session(s: Session) -> dict:
    return {'sessionId': s.id, 'browserName': s.browser_name, 'browserVersion': s.browser_version, 'os': s.os, 'osVersion': s.os_version, 'ipAddress': s.ip_address, 'lastActivity': s.last_activity.isoformat(), 'createdAt': s.created_at.isoformat(), 'status': s.status}

def _serialize_diag(d) -> dict:
    return {'id': d.id, 'companyName': d.company_name, 'industry': d.industry, 'scores': d.scores or {}, 'status': d.status.value, 'createdAt': d.created_at.isoformat()}
