from pydantic import BaseModel, HttpUrl
from typing import Optional


class CreateClientRequest(BaseModel):
    name: str
    url: str
    industry: str
    location: str = ''
    contact_name: str = ''
    contact_email: str = ''
    contact_phone: str = ''
    tags: list[str] = []
    note: str = ''


class UpdateClientRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    tags: Optional[list[str]] = None
    note: Optional[str] = None
    status: Optional[str] = None


class ClientInfo(BaseModel):
    client_id: str
    agency_id: str
    name: str
    url: str
    industry: str
    location: str
    contact_name: str
    contact_email: str
    contact_phone: str
    tags: list[str]
    note: str
    status: str
    created_at: str
    updated_at: str
    created_by: str
    latest_diagnosis_id: Optional[str] = None
    latest_score: Optional[float] = None
