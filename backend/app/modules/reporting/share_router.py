from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from .services import ReportService

router = APIRouter(tags=['share'])
_svc = ReportService()


@router.get('/{token}')
async def get_shared_report(token: str):
    """Public endpoint — no authentication required."""
    report = await _svc.get_by_token(token)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Share link not found or expired')
    try:
        pdf_bytes = await _svc.generate_pdf_bytes(report)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f'PDF generation failed: {e}')
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'inline; filename="llmo-report.pdf"'},
    )
