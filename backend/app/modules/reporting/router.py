from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from .schemas import CreateReportRequest, ReportInfo
from .services import ReportService

router = APIRouter(tags=['reports'])
_svc = ReportService()


def _to_info(d: dict, app_url: str = '') -> ReportInfo:
    token = d.get('share_token')
    return ReportInfo(
        report_id=d.get('report_id') or d['_id'],
        diagnosis_id=d.get('diagnosis_id', ''),
        client_id=d.get('client_id', ''),
        agency_id=d.get('agency_id', ''),
        type=d.get('type', 'simple'),
        status=d.get('status', 'completed'),
        share_token=token,
        share_url=f'{app_url}/share/{token}' if token else None,
        credits_used=d.get('credits_used', 2),
        created_at=d.get('created_at', ''),
    )


@router.post('', response_model=ReportInfo, status_code=status.HTTP_201_CREATED)
async def create_report(
    body: CreateReportRequest,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    if body.type not in ('simple', 'detailed'):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="type must be 'simple' or 'detailed'")
    try:
        report = await _svc.create(
            diagnosis_id=body.diagnosis_id,
            agency_id=current_user.agency_id,
            member_id=current_user.member_id,
            report_type=body.type,
        )
        return _to_info(report)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get('', response_model=list[ReportInfo])
async def list_reports(
    client_id: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    docs = await _svc.list_reports(agency_id=current_user.agency_id, client_id=client_id)
    return [_to_info(d) for d in docs]


@router.get('/{report_id}', response_model=ReportInfo)
async def get_report(
    report_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    doc = await _svc.get(report_id, current_user.agency_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Report not found')
    return _to_info(doc)


@router.get('/{report_id}/download')
async def download_report(
    report_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    doc = await _svc.get(report_id, current_user.agency_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Report not found')
    try:
        pdf_bytes = await _svc.generate_pdf_bytes(doc)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f'PDF generation failed: {e}')
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="llmo-report-{report_id[:8]}.pdf"'},
    )


@router.post('/{report_id}/share', response_model=dict)
async def share_report(
    report_id: str,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    try:
        share_url = await _svc.create_share_link(report_id, current_user.agency_id)
        return {'share_url': share_url}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
