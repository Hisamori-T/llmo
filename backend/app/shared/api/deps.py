"""FastAPI dependencies — JWT-based auth (v4.0, Firebase Auth removed)."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_update

security = HTTPBearer()


@dataclass
class CurrentUser:
    user_id: str
    agency_id: str
    member_id: str
    role: str
    session_id: str
    email: str = ''
    display_name: str = ''


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_session_id: Optional[str] = Header(None, alias='X-Session-Id'),
) -> CurrentUser:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')

    if payload.get('type') != 'access':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token type')

    user_id: str = payload['sub']
    token_session_id: str = payload.get('session_id', '')

    # Accept session_id from token or from header (header takes precedence for compat)
    resolved_session_id = x_session_id or token_session_id
    if not resolved_session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session ID required')

    # Direct PK lookup (session id = DB id since v4.1 simplification)
    session = await db_get('sessions', resolved_session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session expired or invalid')

    if session.get('user_id') != user_id or session.get('status') != 'active':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session expired or invalid')

    await db_update('sessions', resolved_session_id, {
        'last_activity': datetime.now(timezone.utc).isoformat(),
    })

    members = await db_query(
        'agency_members',
        filters=[('user_id', '==', user_id)],
        limit=10,
    )
    members = [m for m in members if m.get('agency_id') == session['agency_id'] and m.get('status') == 'active']
    if not members:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Membership not found')

    member = members[0]

    return CurrentUser(
        user_id=user_id,
        agency_id=session['agency_id'],
        member_id=member['_id'],
        role=member['role'],
        session_id=resolved_session_id,
        email=payload.get('email', ''),
        display_name=payload.get('display_name', ''),
    )


def require_role(*roles: str):
    """Dependency factory: raises 403 if current user's role is not in allowed roles."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Permission denied')
        return current_user
    return _check
