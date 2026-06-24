from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from .schemas import DiagnosisResult, DiagnosisScores, Finding, RunDiagnosisRequest
from .services import DiagnosisService

router = APIRouter(tags=['diagnoses'])
_svc = DiagnosisService()


def _to_result(d: dict) -> DiagnosisResult:
    scores = d.get('scores')
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
        recommendations=d.get('recommendations', []),
        credits_used=d.get('credits_used', 5),
        created_at=d.get('created_at', ''),
        completed_at=d.get('completed_at'),
    )


@router.post('', response_model=DiagnosisResult, status_code=status.HTTP_201_CREATED)
async def run_diagnosis(
    body: RunDiagnosisRequest,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    if body.type not in ('simple', 'detailed'):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="type must be 'simple' or 'detailed'")
    try:
        result = await _svc.run(
            client_id=body.client_id,
            agency_id=current_user.agency_id,
            member_id=current_user.member_id,
            keyword_id=body.keyword_id,
            keywords=body.keywords,
            diagnosis_type=body.type,
        )
        return _to_result(result)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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
