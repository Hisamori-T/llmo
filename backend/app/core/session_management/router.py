from fastapi import APIRouter, Depends, HTTPException, status

from app.shared.api.deps import CurrentUser, get_current_user
from app.shared.db.firestore import db_query, db_update
from .schemas import SessionInfo

router = APIRouter(tags=['session_management'])


@router.get('/sessions', response_model=list[SessionInfo])
async def list_sessions(current_user: CurrentUser = Depends(get_current_user)):
    sessions = await db_query(
        'sessions',
        filters=[('user_id', '==', current_user.user_id)],
        limit=20,
    )
    sessions.sort(key=lambda s: s.get('created_at', ''), reverse=True)
    active = [s for s in sessions if s.get('status') == 'active']
    return [
        SessionInfo(
            session_id=s['session_id'],
            browser_name=s.get('browser_name', ''),
            browser_version=s.get('browser_version', ''),
            os=s.get('os', ''),
            os_version=s.get('os_version', ''),
            ip_address=s.get('ip_address', ''),
            last_activity=s.get('last_activity', ''),
            created_at=s.get('created_at', ''),
            is_current=s['session_id'] == current_user.session_id,
        )
        for s in active
    ]


@router.delete('/sessions/{session_id}', status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(session_id: str, current_user: CurrentUser = Depends(get_current_user)):
    sessions = await db_query(
        'sessions',
        filters=[('session_id', '==', session_id)],
        limit=1,
    )
    if not sessions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Session not found')

    session = sessions[0]
    if session.get('user_id') != current_user.user_id or session.get('status') != 'active':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Session not found')

    await db_update('sessions', session['_id'], {
        'status': 'revoked',
        'revoke_reason': 'manual_revocation',
    })
