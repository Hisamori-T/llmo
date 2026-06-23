from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from app.shared.db.firestore import db_get, db_query, db_update  # noqa: F401 (db_get used in dashboard)
from .schemas import UpdateProfileRequest, UserProfile

router = APIRouter(tags=['user_management'])


@router.get('/me', response_model=UserProfile)
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    user = await db_get('users', current_user.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    members = await db_query(
        'agency_members',
        filters=[
            ('user_id', '==', current_user.user_id),
            ('agency_id', '==', current_user.agency_id),
        ],
        limit=1,
    )
    member = members[0] if members else {}

    limit = member.get('monthly_credit_limit', 0)
    used = member.get('monthly_credit_used', 0)

    return UserProfile(
        user_id=current_user.user_id,
        email=user.get('email', ''),
        display_name=user.get('display_name', ''),
        agency_id=current_user.agency_id,
        role=current_user.role,
        monthly_credit_limit=limit,
        monthly_credit_used=used,
        credits_remaining=max(0, limit - used),
    )


@router.patch('/me', response_model=UserProfile)
async def update_me(
    body: UpdateProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    update_data = {}
    if body.display_name is not None:
        update_data['display_name'] = body.display_name
    if update_data:
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db_update('users', current_user.user_id, update_data)

    return await get_me(current_user)


@router.get('/dashboard', response_model=dict)
async def get_dashboard(current_user: CurrentUser = Depends(get_current_user)):
    members = await db_query(
        'agency_members',
        filters=[
            ('user_id', '==', current_user.user_id),
            ('agency_id', '==', current_user.agency_id),
        ],
        limit=1,
    )
    member = members[0] if members else {}
    credit_limit = member.get('monthly_credit_limit', 0)
    credit_used = member.get('monthly_credit_used', 0)

    diagnoses = await db_query(
        'diagnoses',
        filters=[('agency_id', '==', current_user.agency_id)],
        limit=100,
    )
    total = len(diagnoses)
    scores = [d.get('scores', {}).get('overall', 0) for d in diagnoses if d.get('scores')]
    avg_score = round(sum(scores) / len(scores)) if scores else 0

    recent = sorted(diagnoses, key=lambda d: d.get('created_at', ''), reverse=True)[:5]
    recent_list = []
    for d in recent:
        sc = d.get('scores') or {}
        client = await db_get('clients', d.get('client_id', '')) or {}
        recent_list.append({
            'id': d.get('diagnosis_id') or d.get('_id', ''),
            'companyName': client.get('name', d.get('url', '')),
            'createdAt': d.get('created_at', ''),
            'scores': {
                'aiAwareness': sc.get('ai_awareness', 0),
                'overall': sc.get('overall', 0),
            },
        })

    return {
        'totalDiagnoses': total,
        'avgScore': avg_score,
        'creditsUsed': credit_used,
        'creditsLimit': credit_limit,
        'recentDiagnoses': recent_list,
    }


@router.get('/team', response_model=list[dict])
async def list_team(current_user: CurrentUser = Depends(require_role('admin', 'staff'))):
    members = await db_query(
        'agency_members',
        filters=[('agency_id', '==', current_user.agency_id)],
        limit=50,
    )
    result = []
    for m in members:
        user = await db_get('users', m['user_id'])
        result.append({
            'member_id': m['_id'],
            'user_id': m['user_id'],
            'email': user.get('email', '') if user else '',
            'display_name': user.get('display_name', '') if user else '',
            'role': m['role'],
            'status': m['status'],
            'monthly_credit_limit': m.get('monthly_credit_limit', 0),
            'monthly_credit_used': m.get('monthly_credit_used', 0),
            'joined_at': m.get('joined_at', ''),
        })
    return result
