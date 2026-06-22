from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.shared.db.firebase_auth import verify_id_token
from app.shared.db.firestore import db_query, db_update
from datetime import datetime, timezone

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
        decoded = await verify_id_token(credentials.credentials)
        user_id: str = decoded['uid']
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token')

    if not x_session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session ID required')

    sessions = await db_query(
        'sessions',
        filters=[('session_id', '==', x_session_id)],
        limit=1,
    )
    if not sessions:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session expired or invalid')

    session = sessions[0]
    if session.get('user_id') != user_id or session.get('status') != 'active':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session expired or invalid')

    await db_update('sessions', session['_id'], {
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
        session_id=x_session_id,
        email=decoded.get('email', ''),
        display_name=decoded.get('name', ''),
    )


def require_role(*roles: str):
    """Dependency factory: raises 403 if current user's role is not in allowed roles."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Permission denied')
        return current_user
    return _check
