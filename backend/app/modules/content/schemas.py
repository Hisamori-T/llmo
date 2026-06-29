from typing import Any, Literal, Optional
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
    target_keyword: str = ''          # 後方互換: target_keywords 指定時は空文字可
    target_keywords: Optional[list[str]] = None  # ✨ 複数KW（D-5）
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


# ── AI Assist schemas ──────────────────────────────────────────────────────

class GapCheckMissingItem(BaseModel):
    geo_key: str
    message: str


class AiAssistRequest(BaseModel):
    mode: Literal['gap_check', 'structure']
    source_type: Literal['interview', 'doc']
    text: str


class AiAssistResponse(BaseModel):
    missing: Optional[list[GapCheckMissingItem]] = None   # gap_check mode
    structured_text: Optional[str] = None                  # structure mode


# ── Keyword suggestions schemas ───────────────────────────────────────────

class KeywordCandidate(BaseModel):
    keyword: str
    score: Optional[int] = None  # diagnosis mode: int, fallback mode: None
    weak: bool
    label: str


class KeywordSuggestionsResponse(BaseModel):
    source: Literal['diagnosis', 'fallback']
    requires_generation: bool = False
    candidates: list[KeywordCandidate]


# ── Templates schemas ──────────────────────────────────────────────────────

class TemplateEntry(BaseModel):
    source_type: str
    label: str
    description: str
    needs_body_scaffold: bool
    scaffold: Optional[list[Any]] = None


class TemplatesResponse(BaseModel):
    templates: dict[str, TemplateEntry]


# ── Article schemas (continued) ────────────────────────────────────────────

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
