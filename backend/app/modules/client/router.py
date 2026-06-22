from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from .schemas import ClientInfo, CreateClientRequest, UpdateClientRequest
from .services import ClientService

router = APIRouter(tags=['clients'])
_svc = ClientService()


def _to_info(c: dict) -> ClientInfo:
    return ClientInfo(
        client_id=c.get('client_id') or c['_id'],
        agency_id=c.get('agency_id', ''),
        name=c.get('name', ''),
        url=c.get('url', ''),
        industry=c.get('industry', ''),
        location=c.get('location', ''),
        contact_name=c.get('contact_name', ''),
        contact_email=c.get('contact_email', ''),
        contact_phone=c.get('contact_phone', ''),
        tags=c.get('tags', []),
        note=c.get('note', ''),
        status=c.get('status', 'active'),
        created_at=c.get('created_at', ''),
        updated_at=c.get('updated_at', ''),
        created_by=c.get('created_by', ''),
        latest_diagnosis_id=c.get('latest_diagnosis_id'),
        latest_score=c.get('latest_score'),
    )


@router.post('', response_model=ClientInfo, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: CreateClientRequest,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    try:
        client = await _svc.create(
            agency_id=current_user.agency_id,
            user_id=current_user.user_id,
            data=body.model_dump(),
        )
        return _to_info(client)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get('', response_model=list[ClientInfo])
async def list_clients(
    search: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    clients = await _svc.list_clients(
        agency_id=current_user.agency_id,
        member_id=current_user.member_id,
        role=current_user.role,
        search=search,
        industry=industry,
    )
    return [_to_info(c) for c in clients]


@router.get('/{client_id}', response_model=ClientInfo)
async def get_client(
    client_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    client = await _svc.get(client_id, current_user.agency_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client not found')
    return _to_info(client)


@router.patch('/{client_id}', response_model=ClientInfo)
async def update_client(
    client_id: str,
    body: UpdateClientRequest,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    try:
        updated = await _svc.update(
            client_id=client_id,
            agency_id=current_user.agency_id,
            updates=body.model_dump(exclude_none=True),
        )
        return _to_info(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete('/{client_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: str,
    current_user: CurrentUser = Depends(require_role('admin')),
):
    try:
        await _svc.delete(client_id=client_id, agency_id=current_user.agency_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
