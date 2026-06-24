"""Optimization router — STEP2 実装最適化 API."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response

from app.shared.api.deps import get_current_user
from .schemas import CreateOptimizationRequest, OptimizationResponse
from .services import OptimizationService

router = APIRouter(tags=['optimization'])
_svc = OptimizationService()

_ARTIFACT_KEYS = {'json_ld', 'ai_summary', 'robots_txt', 'faq_structure', 'wp_preset', 'checklist'}


@router.post('', response_model=OptimizationResponse, status_code=201)
async def create_optimization(
    body: CreateOptimizationRequest,
    current_user = Depends(get_current_user),
):
    try:
        doc = await _svc.create(
            diagnosis_id=body.diagnosis_id,
            agency_id=current_user.agency_id,
            member_id=current_user.member_id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return doc


@router.get('', response_model=list[OptimizationResponse])
async def list_optimizations(
    client_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
):
    return await _svc.list_optimizations(
        agency_id=current_user.agency_id,
        client_id=client_id,
    )


@router.get('/{optimization_id}', response_model=OptimizationResponse)
async def get_optimization(
    optimization_id: str,
    current_user = Depends(get_current_user),
):
    doc = await _svc.get(optimization_id, current_user.agency_id)
    if not doc:
        raise HTTPException(404, 'Optimization not found')
    return doc


@router.get('/{optimization_id}/download/{artifact}')
async def download_artifact(
    optimization_id: str,
    artifact: str,
    current_user = Depends(get_current_user),
):
    if artifact not in _ARTIFACT_KEYS:
        raise HTTPException(400, f'artifact must be one of: {", ".join(_ARTIFACT_KEYS)}')

    doc = await _svc.get(optimization_id, current_user.agency_id)
    if not doc:
        raise HTTPException(404, 'Optimization not found')
    if doc.get('status') != 'completed':
        raise HTTPException(400, 'Optimization not completed yet')

    value = doc.get(artifact)
    if value is None:
        raise HTTPException(404, f'{artifact} not available')

    if artifact in ('json_ld', 'faq_structure', 'wp_preset', 'checklist'):
        content = json.dumps(value, ensure_ascii=False, indent=2)
        filename = f'{artifact}.json'
        return Response(
            content=content.encode('utf-8'),
            media_type='application/json',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )
    else:
        filename = 'robots.txt' if artifact == 'robots_txt' else f'{artifact}.txt'
        return PlainTextResponse(
            content=str(value),
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )
