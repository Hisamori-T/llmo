from typing import Literal, Optional
from pydantic import BaseModel


# ── Source schemas ─────────────────────────────────────────────────────────

class AddSourceRequest(BaseModel):
    client_id: str
    type: Literal['interview', 'doc', 'url']
    title: str
    body: str = ''
    source_url: str = ''


class SourceResponse(BaseModel):
    source_id: str
    client_id: str
    agency_id: str
    type: str
    title: str
    body: str
    source_url: str
    created_at: str


# ── Article schemas ────────────────────────────────────────────────────────

class GenerateArticleRequest(BaseModel):
    client_id: str
    target_keyword: str
    source_ids: list[str] = []
    diagnosis_id: Optional[str] = None  # 弱依存（オプション）


class UpdateArticleRequest(BaseModel):
    title: Optional[str] = None
    body_markdown: Optional[str] = None
    status: Optional[Literal['draft', 'edited', 'published']] = None


class GeoChecklist(BaseModel):
    citations: bool    # 引用可能な具体的文章
    numbers: bool      # 定量データ3箇所以上
    statistics: bool   # 統計・調査データ
    authority: bool    # 権威性指標
    conclusions: bool  # 各セクションに結論


class ArticleResponse(BaseModel):
    article_id: str
    client_id: str
    agency_id: str
    member_id: str
    diagnosis_id: Optional[str] = None
    target_keyword: str
    title: Optional[str] = None
    outline: Optional[list] = None
    body_markdown: Optional[str] = None
    geo_checklist: Optional[dict] = None
    source_ids: list
    status: str
    credits_used: int
    created_at: str
    updated_at: Optional[str] = None
