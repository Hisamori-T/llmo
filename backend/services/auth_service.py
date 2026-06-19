from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import hashlib
import json
import uuid
import user_agents
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.models import User, Session, Organization, PlanEnum, RoleEnum
from core.firebase import verify_firebase_token
from core.config import settings

PLAN_CREDITS = {
    PlanEnum.starter: 100,
    PlanEnum.pro: 500,
    PlanEnum.enterprise: 2000,
}

class AuthService:
    def extract_device_info(self, user_agent_str: str) -> Dict[str, Any]:
        ua = user_agents.parse(user_agent_str or '')
        device_id = hashlib.sha256(
            json.dumps({'browser': ua.browser.family, 'os': ua.os.family}, sort_keys=True).encode()
        ).hexdigest()[:16]
        browser_id = hashlib.sha256(
            json.dumps({'device_id': device_id, 'ua': user_agent_str[:200]}, sort_keys=True).encode()
        ).hexdigest()[:16]
        return {
            'device_id': device_id,
            'browser_id': browser_id,
            'browser_name': ua.browser.family,
            'browser_version': ua.browser.version_string,
            'os': ua.os.family,
            'os_version': ua.os.version_string,
            'user_agent': user_agent_str,
        }

    async def get_or_create_user(self, db: AsyncSession, firebase_uid: str, email: str, display_name: str = '') -> User:
        result = await db.execute(select(User).where(User.id == firebase_uid))
        user = result.scalar_one_or_none()
        if user:
            return user

        # 新規ユーザー: org 作成
        org = Organization(name=f'{display_name or email} の組織', plan=PlanEnum.starter, monthly_credits_limit=PLAN_CREDITS[PlanEnum.starter])
        db.add(org)
        await db.flush()

        user = User(id=firebase_uid, email=email, display_name=display_name, plan=PlanEnum.starter, role=RoleEnum.admin, org_id=org.id, monthly_credits_used=0)
        db.add(user)
        await db.flush()
        return user

    async def check_existing_session(self, db: AsyncSession, user_id: str, browser_id: str) -> Optional[Session]:
        result = await db.execute(
            select(Session).where(Session.user_id == user_id, Session.status == 'active', Session.browser_id != browser_id)
        )
        return result.scalar_one_or_none()

    async def create_session(self, db: AsyncSession, user_id: str, device_info: Dict, ip_address: str, force: bool = False) -> Session:
        if force:
            await db.execute(
                update(Session).where(Session.user_id == user_id, Session.status == 'active').values(status='revoked', revoke_reason='new_login')
            )

        session = Session(
            id=str(uuid.uuid4()),
            user_id=user_id,
            device_id=device_info['device_id'],
            browser_id=device_info['browser_id'],
            browser_name=device_info['browser_name'],
            browser_version=device_info['browser_version'],
            os=device_info['os'],
            os_version=device_info['os_version'],
            ip_address=ip_address,
            user_agent=device_info['user_agent'],
            status='active',
            last_activity=datetime.utcnow(),
        )
        db.add(session)
        await db.flush()
        return session

    async def validate_session(self, db: AsyncSession, session_id: str) -> Optional[Session]:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.status == 'active')
        )
        session = result.scalar_one_or_none()
        if session:
            session.last_activity = datetime.utcnow()
        return session

    async def revoke_session(self, db: AsyncSession, session_id: str) -> None:
        await db.execute(
            update(Session).where(Session.id == session_id).values(status='revoked', revoke_reason='logout')
        )
