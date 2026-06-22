from pydantic import BaseModel
from typing import Optional


class CreateReportRequest(BaseModel):
    diagnosis_id: str
    type: str = 'simple'  # simple / detailed


class ReportInfo(BaseModel):
    report_id: str
    diagnosis_id: str
    client_id: str
    agency_id: str
    type: str
    status: str
    share_token: Optional[str] = None
    share_url: Optional[str] = None
    credits_used: int
    created_at: str
