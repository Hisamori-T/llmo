from typing import Optional
from pydantic import BaseModel


class CreateOptimizationRequest(BaseModel):
    diagnosis_id: str


class OptimizationResponse(BaseModel):
    optimization_id: str
    diagnosis_id: str
    client_id: str
    agency_id: str
    member_id: str
    status: str
    json_ld: Optional[dict] = None
    ai_summary: Optional[str] = None
    robots_txt: Optional[str] = None
    faq_structure: Optional[list] = None
    wp_preset: Optional[dict] = None
    checklist: Optional[list] = None
    credits_used: int
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
