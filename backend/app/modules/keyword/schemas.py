from pydantic import BaseModel
from typing import Optional


class KeywordItem(BaseModel):
    keyword: str
    intent: str  # informational / commercial / navigational
    priority: str  # high / medium / low


class Competitor(BaseModel):
    name: str
    url: str
    address: str


class GenerateKeywordsRequest(BaseModel):
    client_id: str
    location: str
    max_competitors: int = 5


class SuggestKeywordsRequest(BaseModel):
    company_name: str
    industry: str
    location: str = ''


class KeywordResult(BaseModel):
    keyword_id: str
    client_id: str
    agency_id: str
    url: str
    location: str
    industry: str
    competitors: list[Competitor]
    keywords: list[KeywordItem]
    status: str
    credits_used: int
    created_at: str
    completed_at: Optional[str] = None
