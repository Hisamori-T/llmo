from pydantic import BaseModel
from typing import Optional


class SignupRequest(BaseModel):
    id_token: str
    agency_name: str
    display_name: str = ''


class LoginRequest(BaseModel):
    id_token: str
    force: bool = False


class LogoutRequest(BaseModel):
    session_id: str


class SignupResponse(BaseModel):
    user_id: str
    agency_id: str
    session_id: str
    role: str


class LoginResponse(BaseModel):
    status: str  # 'success' | 'multiple_connection'
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    agency_id: Optional[str] = None
    role: Optional[str] = None
    existing_session: Optional[dict] = None  # populated when status='multiple_connection'
