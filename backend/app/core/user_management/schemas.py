from pydantic import BaseModel, EmailStr
from typing import Optional


class UserProfile(BaseModel):
    user_id: str
    email: str
    display_name: str
    agency_id: str
    role: str
    monthly_credit_limit: int
    monthly_credit_used: int
    credits_remaining: int


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None


class InviteStaffRequest(BaseModel):
    email: EmailStr
    role: str = 'staff'
    display_name: str = ''
