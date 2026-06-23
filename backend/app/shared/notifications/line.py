"""LINE Messaging API notification sender (v4.0).

Uses Push Message API (not LINE Notify which is discontinued).
Free tier: 200 messages/month on the messaging plan.
Only critical/warning alerts are sent to conserve quota.
"""
from enum import Enum
from typing import Optional

import httpx

from app.config import settings

_PUSH_URL = 'https://api.line.me/v2/bot/message/push'


class NotifyLevel(str, Enum):
    CRITICAL = 'critical'
    WARNING = 'warning'
    INFO = 'info'


def _is_enabled() -> bool:
    return bool(settings.line_channel_access_token)


async def send_line_message(
    to: str,
    message: str,
    level: NotifyLevel = NotifyLevel.INFO,
) -> bool:
    """Send a push message to a LINE user or group ID.

    Returns True on success, False if skipped or failed.
    Only CRITICAL and WARNING are sent to conserve the free-tier quota.
    """
    if not _is_enabled():
        return False
    if level == NotifyLevel.INFO:
        return False

    headers = {
        'Authorization': f'Bearer {settings.line_channel_access_token}',
        'Content-Type': 'application/json',
    }
    payload = {
        'to': to,
        'messages': [{'type': 'text', 'text': message}],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(_PUSH_URL, json=payload, headers=headers)
            return res.status_code == 200
    except Exception:
        return False


async def notify_diagnosis_complete(
    to: str,
    company_name: str,
    score: int,
    diagnosis_id: str,
    app_url: str,
) -> bool:
    level = NotifyLevel.WARNING if score < 40 else NotifyLevel.INFO
    if level == NotifyLevel.INFO:
        return False
    msg = (
        f'【LLMO Score アラート】\n'
        f'{company_name} の診断が完了しました。\n'
        f'総合スコア: {score}/100\n'
        f'⚠️ スコアが低い状態です。改善をご検討ください。\n'
        f'{app_url}/dashboard/diagnoses/{diagnosis_id}'
    )
    return await send_line_message(to, msg, level)


async def notify_credit_low(
    to: str,
    agency_name: str,
    credits_used: int,
    credits_limit: int,
) -> bool:
    pct = credits_used / credits_limit * 100 if credits_limit else 0
    if pct < 80:
        return False
    level = NotifyLevel.CRITICAL if pct >= 95 else NotifyLevel.WARNING
    msg = (
        f'【LLMO Score クレジット警告】\n'
        f'{agency_name} のクレジット残量が {100 - pct:.0f}% です。\n'
        f'使用量: {credits_used} / {credits_limit}\n'
        f'追加購入をご検討ください。'
    )
    return await send_line_message(to, msg, level)


async def notify_error(
    to: str,
    context: str,
    detail: Optional[str] = None,
) -> bool:
    msg = f'【LLMO Score エラー】\n{context}'
    if detail:
        msg += f'\n詳細: {detail[:200]}'
    return await send_line_message(to, msg, NotifyLevel.CRITICAL)
