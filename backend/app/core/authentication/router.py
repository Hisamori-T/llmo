from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.config import settings
from app.shared.api.deps import CurrentUser, get_current_user
from .schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    RefreshResponse,
    ResetPasswordRequest,
    SignupRequest,
    SignupResponse,
)
from .services import AuthService

router = APIRouter(tags=['authentication'])
_service = AuthService()

_COOKIE_NAME = 'refresh_token'


def _get_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get('X-Forwarded-For')
    return forwarded.split(',')[0].strip() if forwarded else request.client.host if request.client else None


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite='lax',
        max_age=settings.refresh_token_ttl,
        path='/auth/refresh',
    )


@router.post('/signup', response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, request: Request, response: Response):
    result = await _service.signup(
        email=body.email,
        password=body.password,
        agency_name=body.agency_name,
        display_name=body.display_name,
        user_agent=request.headers.get('User-Agent'),
        ip_address=_get_ip(request),
    )
    if result.get('status') == 'already_registered':
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')
    if result.get('status') == 'no_membership':
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Membership setup failed')
    _set_refresh_cookie(response, result.pop('refresh_token'))
    return SignupResponse(**result)


@router.post('/login', response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response):
    result = await _service.login(
        email=body.email,
        password=body.password,
        force=body.force,
        user_agent=request.headers.get('User-Agent'),
        ip_address=_get_ip(request),
    )
    if result.get('status') == 'not_registered':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not registered')
    if result.get('status') == 'invalid_credentials':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password')
    if result.get('status') == 'no_membership':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No active agency membership found')
    if result.get('status') == 'success':
        _set_refresh_cookie(response, result.pop('refresh_token'))
    return LoginResponse(**result)


@router.post('/refresh', response_model=RefreshResponse)
async def refresh(request: Request, response: Response):
    token = request.cookies.get(_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token missing')
    result = await _service.refresh(token)
    if result.get('status') in ('expired', 'invalid', 'session_expired'):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token invalid or expired')
    _set_refresh_cookie(response, result.pop('refresh_token'))
    return RefreshResponse(**{k: v for k, v in result.items() if k != 'status'})


@router.post('/forgot-password', status_code=status.HTTP_200_OK)
async def forgot_password(body: ForgotPasswordRequest, request: Request):
    from app.config import settings as cfg
    await _service.forgot_password(body.email, cfg.app_url)
    return {'detail': 'If the email is registered, a reset link has been sent.'}


@router.post('/reset-password', status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest):
    result = await _service.reset_password(body.token, body.new_password)
    if result.get('status') == 'invalid':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Reset token invalid or expired')
    return {'detail': 'Password updated successfully'}


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutRequest, response: Response, current_user: CurrentUser = Depends(get_current_user)):
    await _service.logout(current_user.user_id, body.session_id)
    response.delete_cookie(key=_COOKIE_NAME, path='/auth/refresh')
