import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.shared.db.firestore import db_add, db_get, db_update
from app.shared.constants.plans import CREDIT_COSTS


async def check_and_deduct(
    member_id: str,
    operation: str,
    resource_id: Optional[str] = None,
    client_id: Optional[str] = None,
    initiated_by: Optional[str] = None,
) -> int:
    """クレジット残量チェック＋消費。消費成功時に credit_usage へ記録。

    Returns:
        消費後の残量
    """
    cost = CREDIT_COSTS.get(operation)
    if cost is None:
        raise ValueError(f'Unknown operation: {operation}')

    member = await db_get('agency_members', member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Member not found')

    limit = member.get('monthly_credit_limit', 0)
    used = member.get('monthly_credit_used', 0)
    remaining = limit - used

    if remaining < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f'Insufficient credits. Required: {cost}, Available: {remaining}',
        )

    new_used = used + cost
    await db_update('agency_members', member_id, {'monthly_credit_used': new_used})
    balance_after = limit - new_used

    # credit_usage 台帳に記録
    await db_add('credit_usage', {
        'id': str(uuid.uuid4()),
        'agency_id': member.get('agency_id', ''),
        'member_id': member_id,
        'initiated_by': initiated_by or member_id,
        'amount': cost,
        'usage_type': operation,
        'resource_id': resource_id or '',
        'client_id': client_id or '',
        'balance_after': balance_after,
        'created_at': datetime.now(timezone.utc).isoformat(),
    })

    return balance_after
