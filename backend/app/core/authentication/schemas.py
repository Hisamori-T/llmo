from typing import Optional

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    agency_name: str
    display_name: str = ''


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    force: bool = False


class LogoutRequest(BaseModel):
    session_id: str


class SignupResponse(BaseModel):
    user_id: str
    agency_id: str
    session_id: str
    role: str
    access_token: str


class LoginResponse(BaseModel):
    status: str  # 'success' | 'multiple_connection'
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    agency_id: Optional[str] = None
    role: Optional[str] = None
    access_token: Optional[str] = None
    existing_session: Optional[dict] = None


class RefreshResponse(BaseModel):
    access_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
