from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.shared.api.deps import CurrentUser, get_current_user
from .schemas import LoginRequest, LoginResponse, LogoutRequest, SignupRequest, SignupResponse
from .services import AuthService

router = APIRouter(tags=['authentication'])
_service = AuthService()


def _get_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get('X-Forwarded-For')
    return forwarded.split(',')[0].strip() if forwarded else request.client.host if request.client else None


@router.post('/signup', response_model=SignupResponse)
async def signup(body: SignupRequest, request: Request):
    result = await _service.signup(
        id_token=body.id_token,
        agency_name=body.agency_name,
        display_name=body.display_name,
        user_agent=request.headers.get('User-Agent'),
        ip_address=_get_ip(request),
    )
    if result.get('status') == 'no_membership':
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Membership setup failed')
    return SignupResponse(**result)


@router.post('/login', response_model=LoginResponse)
async def login(body: LoginRequest, request: Request):
    result = await _service.login(
        id_token=body.id_token,
        force=body.force,
        user_agent=request.headers.get('User-Agent'),
        ip_address=_get_ip(request),
    )
    if result.get('status') == 'not_registered':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not registered. Please sign up first.')
    if result.get('status') == 'no_membership':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No active agency membership found.')
    return LoginResponse(**result)


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutRequest, current_user: CurrentUser = Depends(get_current_user)):
    await _service.logout(current_user.user_id, body.session_id)
