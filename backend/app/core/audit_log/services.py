"""監査ログ記録ユーティリティ (FIX-2)。

呼び出し方:
    from app.core.audit_log.services import record_log
    await record_log(user_id=..., agency_id=..., action='credit_consumed', ...)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.shared.db.firestore import db_add


async def record_log(
    user_id: str,
    action: str,
    agency_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    """audit_logs に1行記録する。失敗しても呼び出し元を止めない。"""
    try:
        await db_add('audit_logs', {
            'id': str(uuid.uuid4()),
            'agency_id': agency_id or '',
            'user_id': user_id,
            'action': action,
            'resource_type': resource_type or '',
            'resource_id': resource_id or '',
            'details': details or {},
            'created_at': datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass  # 監査ログの失敗でビジネス処理を止めない
