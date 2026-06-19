from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from models.database import get_db
from models.models import User, Session
from services.auth_service import AuthService
from core.firebase import verify_firebase_token

router = APIRouter()
auth_service = AuthService()

class LoginRequest(BaseModel):
    id_token: str
    force: bool = False

class SignupRequest(BaseModel):
    id_token: str
    display_name: str = ''

@router.post('/signup')
async def signup(req: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        decoded = await verify_firebase_token(req.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid Firebase token')

    ua_str = request.headers.get('User-Agent', '')
    ip = request.client.host if request.client else '0.0.0.0'
    device_info = auth_service.extract_device_info(ua_str)

    user = await auth_service.get_or_create_user(db, decoded['uid'], decoded.get('email', ''), req.display_name)
    session = await auth_service.create_session(db, user.id, device_info, ip, force=True)
    await db.commit()

    return {'status': 'success', 'session_id': session.id, 'user_id': user.id}

@router.post('/login')
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        decoded = await verify_firebase_token(req.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid Firebase token')

    uid = decoded['uid']
    ua_str = request.headers.get('User-Agent', '')
    ip = request.client.host if request.client else '0.0.0.0'
    device_info = auth_service.extract_device_info(ua_str)

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        user = await auth_service.get_or_create_user(db, uid, decoded.get('email', ''))

    existing = await auth_service.check_existing_session(db, uid, device_info['browser_id'])

    if existing and not req.force:
        return {
            'status': 'multiple_connection',
            'is_device_different': existing.os != device_info['os'],
            'existing_session': {
                'browser': f"{existing.browser_name} {existing.browser_version}",
                'device': f"{existing.os} {existing.os_version}",
                'lastActivity': existing.last_activity.isoformat(),
            },
            'new_session': {
                'browser': f"{device_info['browser_name']} {device_info['browser_version']}",
                'device': f"{device_info['os']} {device_info['os_version']}",
            },
        }

    session = await auth_service.create_session(db, uid, device_info, ip, force=req.force or bool(existing))
    await db.commit()

    return {'status': 'success', 'session_id': session.id, 'user_id': uid}

@router.post('/logout')
async def logout(body: dict, db: AsyncSession = Depends(get_db)):
    session_id = body.get('session_id')
    if session_id:
        await auth_service.revoke_session(db, session_id)
        await db.commit()
    return {'status': 'success'}
