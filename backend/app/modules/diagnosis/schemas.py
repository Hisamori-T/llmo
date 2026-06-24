from pydantic import BaseModel
from typing import Optional


class DiagnosisScores(BaseModel):
    ai_awareness: float
    brand_recognition: float
    content_quality: float
    competitor_gap: float
    overall: float


class Finding(BaseModel):
    category: str
    severity: str  # high / medium / low
    title: str
    description: str


class Recommendation(BaseModel):
    action: str = ''
    priority: str = ''
    category: str = ''
    impact: str = ''
    timeline: str = ''


class RunDiagnosisRequest(BaseModel):
    client_id: str
    keyword_id: Optional[str] = None
    keywords: list[str] = []
    type: str = 'simple'  # simple / detailed


class DiagnosisResult(BaseModel):
    diagnosis_id: str
    client_id: str
    agency_id: str
    url: str
    keywords: list[str]
    type: str
    status: str
    scores: Optional[DiagnosisScores] = None
    findings: list[Finding] = []
    recommendations: list[Recommendation] = []
    credits_used: int
    created_at: str
    completed_at: Optional[str] = None
