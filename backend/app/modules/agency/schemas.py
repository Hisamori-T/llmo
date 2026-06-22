from pydantic import BaseModel, EmailStr
from typing import Optional


class Branding(BaseModel):
    logo_url: Optional[str] = None
    primary_color: str = '#4F46E5'
    contact_email: str = ''


class AgencyInfo(BaseModel):
    agency_id: str
    name: str
    plan: str
    billing_cycle: str
    status: str
    included_child_accounts: int
    additional_child_accounts: int
    max_child_accounts: int
    credits_per_child: int
    included_clients: int
    max_clients: int
    branding: Branding
    created_at: str


class UpdateAgencyRequest(BaseModel):
    name: Optional[str] = None
    branding: Optional[Branding] = None


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = 'staff'
    display_name: str = ''
    monthly_credit_limit: Optional[int] = None


class UpdateMemberRequest(BaseModel):
    role: Optional[str] = None
    monthly_credit_limit: Optional[int] = None
    status: Optional[str] = None


class MemberInfo(BaseModel):
    member_id: str
    user_id: str
    email: str
    display_name: str
    role: str
    status: str
    monthly_credit_limit: int
    monthly_credit_used: int
    credits_remaining: int
    joined_at: str


class AgencyStats(BaseModel):
    total_clients: int
    total_diagnoses: int
    total_credits_used: int
    total_credits_limit: int
    member_count: int
    active_member_count: int
