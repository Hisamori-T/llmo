import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from app.shared.db.firestore import db_get, db_query, db_set
from app.shared.constants.plans import CREDIT_COSTS
from .schemas import DiagnosisResult, DiagnosisScores, Finding, ProgressInfo, Recommendation, RunDiagnosisRequest
from .services import DiagnosisService

router = APIRouter(tags=['diagnoses'])
_svc = DiagnosisService()


def _to_result(d: dict) -> DiagnosisResult:
    scores = d.get('scores')
    progress_stage = d.get('progress_stage')
    progress = None
    if progress_stage:
        detail = d.get('progress_detail') or {}
        progress = ProgressInfo(
            stage=progress_stage,
            current=detail.get('current'),
            total=detail.get('total'),
        )
    return DiagnosisResult(
        diagnosis_id=d.get('diagnosis_id') or d['_id'],
        client_id=d.get('client_id', ''),
        agency_id=d.get('agency_id', ''),
        url=d.get('url', ''),
        keywords=d.get('keywords', []),
        type=d.get('type', 'simple'),
        status=d.get('status', ''),
        scores=DiagnosisScores(**scores) if isinstance(scores, dict) else None,
        findings=[Finding(**f) if isinstance(f, dict) else f for f in d.get('findings', [])],
        recommendations=[
            Recommendation(**r) if isinstance(r, dict) else Recommendation(action=str(r))
            for r in d.get('recommendations', [])
        ],
        credits_used=d.get('credits_used', 5),
        created_at=d.get('created_at', ''),
        completed_at=d.get('completed_at'),
        degraded=bool(d.get('degraded', False)),
        progress=progress,
    )


@router.post('', response_model=DiagnosisResult, status_code=status.HTTP_202_ACCEPTED)
async def run_diagnosis(
    body: RunDiagnosisRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    if body.type not in ('simple', 'detailed'):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="type must be 'simple' or 'detailed'")

    agency_id = current_user.agency_id
    member_id = current_user.member_id
    client_id = body.client_id

    # 1. Validate client
    client = await db_get('clients', client_id)
    if not client or client.get('agency_id') != agency_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client not found')

    # 2. Upfront balance check
    operation = 'simple_diagnosis' if body.type == 'simple' else 'detailed_diagnosis'
    credits_needed = CREDIT_COSTS[operation]
    member = await db_get('agency_members', member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Member not found')
    remaining = member.get('monthly_credit_limit', 0) - member.get('monthly_credit_used', 0)
    if remaining < credits_needed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f'Insufficient credits. Required: {credits_needed}, Available: {remaining}',
        )

    # 3. Duplicate detection (409 if same client already running/pending)
    existing = await db_query('diagnoses', filters=[('client_id', '==', client_id)], limit=50)
    in_progress = [d for d in existing if d.get('status') in ('pending', 'running')]
    if in_progress:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Diagnosis already in progress for this client')

    # 4. Resolve keywords
    keywords = list(body.keywords)
    if body.keyword_id and not keywords:
        kw_doc = await db_get('keywords', body.keyword_id)
        if kw_doc and kw_doc.get('agency_id') == agency_id:
            keywords = [k.get('keyword', '') for k in kw_doc.get('keywords', [])[:10]]

    # 5. INSERT diagnosis record immediately (running)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    retain_until = (now + timedelta(days=90)).date().isoformat()
    diagnosis_id = str(uuid.uuid4())

    record = {
        'diagnosis_id': diagnosis_id,
        'client_id': client_id,
        'agency_id': agency_id,
        'member_id': member_id,
        'url': client.get('url', ''),
        'keywords': keywords,
        'type': body.type,
        'source': 'manual',
        'status': 'running',
        'progress_stage': 'generating_keywords',
        'progress_detail': None,
        'scores': None,
        'ai_analysis': None,
        'keyword_analysis': None,
        'site_analysis': None,
        'findings': [],
        'recommendations': [],
        'projections': None,
        'raw_evidence': None,
        'credits_used': credits_needed,
        'degraded': False,
        'retain_until': retain_until,
        'created_at': now_iso,
        'completed_at': None,
    }
    await db_set('diagnoses', diagnosis_id, record)

    # 6. Register BackgroundTask (does not block)
    background_tasks.add_task(
        _svc.run_bg,
        diagnosis_id=diagnosis_id,
        client_id=client_id,
        agency_id=agency_id,
        member_id=member_id,
        keywords=keywords,
        diagnosis_type=body.type,
        source='manual',
    )

    # 7. Return 202 immediately
    return _to_result(record | {'_id': diagnosis_id})


@router.get('', response_model=list[DiagnosisResult])
async def list_diagnoses(
    client_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: CurrentUser = Depends(get_current_user),
):
    docs = await _svc.list_diagnoses(
        agency_id=current_user.agency_id,
        client_id=client_id,
        limit=limit,
    )
    return [_to_result(d) for d in docs]


@router.get('/{diagnosis_id}', response_model=DiagnosisResult)
async def get_diagnosis(
    diagnosis_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    doc = await _svc.get(diagnosis_id, current_user.agency_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Diagnosis not found')
    return _to_result(doc)
