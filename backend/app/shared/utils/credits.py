from fastapi import HTTPException, status

from app.shared.db.firestore import db_get, db_update
from app.shared.constants.plans import CREDIT_COSTS


async def check_and_deduct(member_id: str, operation: str) -> int:
    """Check credit balance and deduct cost. Returns remaining credits."""
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
    return limit - new_used
