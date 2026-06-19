from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.database import get_db
from models.models import User, Session
from core.firebase import verify_firebase_token
from datetime import datetime
from typing import Optional

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session_id: Optional[str] = Header(None, alias='X-Session-Id'),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials

    # Firebase ID token 検証
    try:
        decoded = await verify_firebase_token(token)
        uid = decoded['uid']
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')

    # セッション検証
    if session_id:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == uid, Session.status == 'active')
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session expired or invalid')
        session.last_activity = datetime.utcnow()

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    return user
