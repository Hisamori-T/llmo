from fastapi import APIRouter, Depends, HTTPException, status

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from .schemas import (
    AgencyInfo, AgencyStats, Branding, InviteMemberRequest,
    MemberInfo, UpdateAgencyRequest, UpdateMemberRequest,
)
from .services import AgencyService

router = APIRouter(tags=['agency'])
_svc = AgencyService()


@router.get('', response_model=AgencyInfo)
async def get_agency(current_user: CurrentUser = Depends(get_current_user)):
    agency = await _svc.get_agency(current_user.agency_id)
    if not agency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Agency not found')
    branding = agency.get('branding', {})
    return AgencyInfo(
        agency_id=agency['_id'],
        name=agency.get('name', ''),
        plan=agency.get('plan', 'starter'),
        billing_cycle=agency.get('billing_cycle', 'monthly'),
        status=agency.get('status', 'trial'),
        included_child_accounts=agency.get('included_child_accounts', 2),
        additional_child_accounts=agency.get('additional_child_accounts', 0),
        max_child_accounts=agency.get('max_child_accounts', 5),
        credits_per_child=agency.get('credits_per_child', 100),
        included_clients=agency.get('included_clients', 10),
        max_clients=agency.get('max_clients', 30),
        branding=Branding(**branding) if isinstance(branding, dict) else Branding(),
        created_at=agency.get('created_at', ''),
    )


@router.patch('', response_model=AgencyInfo)
async def update_agency(
    body: UpdateAgencyRequest,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    updates = {}
    if body.name is not None:
        updates['name'] = body.name
    if body.branding is not None:
        updates['branding'] = body.branding.model_dump()

    if not updates:
        return await get_agency(current_user)

    await _svc.update_agency(current_user.agency_id, updates)
    return await get_agency(current_user)


@router.get('/stats', response_model=AgencyStats)
async def get_stats(current_user: CurrentUser = Depends(require_role('admin', 'staff'))):
    stats = await _svc.get_stats(current_user.agency_id)
    return AgencyStats(**stats)


@router.get('/members', response_model=list[MemberInfo])
async def list_members(current_user: CurrentUser = Depends(require_role('admin', 'staff'))):
    members = await _svc.list_members(current_user.agency_id)
    return [MemberInfo(**m) for m in members]


@router.post('/members/invite', response_model=dict, status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: InviteMemberRequest,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    try:
        result = await _svc.invite_member(
            agency_id=current_user.agency_id,
            email=str(body.email),
            role=body.role,
            display_name=body.display_name,
            monthly_credit_limit=body.monthly_credit_limit,
            inviter_user_id=current_user.user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch('/members/{member_id}', status_code=status.HTTP_200_OK)
async def update_member(
    member_id: str,
    body: UpdateMemberRequest,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    try:
        await _svc.update_member(
            member_id=member_id,
            agency_id=current_user.agency_id,
            updates=body.model_dump(exclude_none=True),
        )
        return {'ok': True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete('/members/{member_id}', status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    try:
        await _svc.remove_member(member_id=member_id, agency_id=current_user.agency_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
