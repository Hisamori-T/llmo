from pydantic import BaseModel
from typing import Optional


class SessionInfo(BaseModel):
    session_id: str
    browser_name: str
    browser_version: str
    os: str
    os_version: str
    ip_address: str
    last_activity: str
    created_at: str
    is_current: bool
