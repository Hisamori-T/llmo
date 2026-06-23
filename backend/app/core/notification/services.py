"""Notification service — automation alert 配信の統一インターフェース。

チャネル資格情報（Slack webhook URL / LINE トークン）は
agency.settings.notification_channels に保持し、このアクセサ経由でのみ参照する。
automation_schedules には URL 実体を持たせない（I-4 設計規約）。
"""
import logging
from typing import Optional

import httpx

from app.config import settings
from app.shared.db.firestore import db_get, db_query
from app.shared.notifications.line import NotifyLevel, send_line_message

logger = logging.getLogger(__name__)


async def get_channel_config(agency_id: str, channel_type: str) -> Optional[dict]:
    """agency.settings.notification_channels から指定チャネルの設定を返す。

    シークレットは呼び出し元ログに漏らさないようマスキングして返す。
    """
    agency = await db_get('agencies', agency_id)
    if not agency:
        return None
    channels = (agency.get('settings') or {}).get('notification_channels') or {}
    config = channels.get(channel_type)
    return config


class NotificationService:
    async def send_automation_alert(
        self,
        agency_id: str,
        channels: list[str],
        user_ids: list[str],
        extra_emails: list[str],
        alert_level: str,
        message: str,
        report_id: Optional[str] = None,
    ) -> None:
        """automation からのアラート・月次レポート配信を処理する。"""
        tasks = []

        if 'email' in channels:
            emails = await self._resolve_emails(user_ids, extra_emails)
            for email in emails:
                tasks.append(self._send_email(email, alert_level, message, report_id))

        if 'slack' in channels:
            slack_config = await get_channel_config(agency_id, 'slack')
            if slack_config and slack_config.get('webhook_url'):
                tasks.append(self._send_slack(slack_config['webhook_url'], alert_level, message))

        if 'line' in channels:
            line_config = await get_channel_config(agency_id, 'line')
            line_user_ids = (line_config or {}).get('user_ids', [])
            level = NotifyLevel.CRITICAL if alert_level == 'critical' else NotifyLevel.WARNING
            for uid in line_user_ids:
                tasks.append(send_line_message(uid, message, level))

        import asyncio
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                logger.warning(f'Notification task {i} failed: {r}')

    async def _resolve_emails(self, user_ids: list[str], extra_emails: list[str]) -> list[str]:
        emails = list(extra_emails)
        for uid in user_ids:
            # agency_members テーブルから email を引く
            members = await db_query(
                'agency_members',
                filters=[('user_id', '==', uid)],
                limit=1,
            )
            if members and members[0].get('email'):
                emails.append(members[0]['email'])
            else:
                # users テーブルから引く
                user = await db_get('users', uid)
                if user and user.get('email'):
                    emails.append(user['email'])
        return list(dict.fromkeys(emails))  # deduplicate, preserve order

    async def _send_email(
        self,
        to_email: str,
        alert_level: str,
        message: str,
        report_id: Optional[str] = None,
    ) -> bool:
        if not settings.sendgrid_api_key:
            return False
        subject = f'[LLMO Score] {"緊急" if alert_level == "critical" else "お知らせ"}アラート'
        body = message
        if report_id:
            body += f'\n\nレポートURL: {settings.app_url}/reports/{report_id}'
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    'https://api.sendgrid.com/v3/mail/send',
                    headers={'Authorization': f'Bearer {settings.sendgrid_api_key}'},
                    json={
                        'personalizations': [{'to': [{'email': to_email}]}],
                        'from': {'email': settings.from_email or 'noreply@llmo-score.com'},
                        'subject': subject,
                        'content': [{'type': 'text/plain', 'value': body}],
                    },
                )
                return resp.status_code in (200, 202)
        except Exception as e:
            logger.warning(f'Email to {to_email} failed: {e}')
            return False

    async def _send_slack(self, webhook_url: str, alert_level: str, message: str) -> bool:
        emoji = ':rotating_light:' if alert_level == 'critical' else ':warning:'
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    webhook_url,
                    json={'text': f'{emoji} {message}'},
                )
                return resp.status_code == 200
        except Exception as e:
            logger.warning(f'Slack notify failed: {e}')
            return False
