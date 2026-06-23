from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.shared.api.deps import CurrentUser, get_current_user, require_role
from app.shared.notifications.line import NotifyLevel, send_line_message

router = APIRouter(tags=['notification'])


class LineTestRequest(BaseModel):
    to: str
    message: str


class NotificationStatus(BaseModel):
    line_enabled: bool
    channels: list[str]


@router.get('/status', response_model=NotificationStatus)
async def notification_status(current_user: CurrentUser = Depends(require_role('admin'))):
    channels = []
    if settings.line_channel_access_token:
        channels.append('line')
    if settings.sendgrid_api_key:
        channels.append('email')
    if settings.slack_webhook_url:
        channels.append('slack')
    return NotificationStatus(
        line_enabled=bool(settings.line_channel_access_token),
        channels=channels,
    )


@router.post('/test/line', status_code=status.HTTP_200_OK)
async def test_line(
    body: LineTestRequest,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    if not settings.line_channel_access_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='LINE channel not configured. Set LINE_CHANNEL_ACCESS_TOKEN in .env.',
        )
    ok = await send_line_message(body.to, body.message, NotifyLevel.WARNING)
    if not ok:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='LINE message delivery failed')
    return {'sent': True, 'to': body.to}
