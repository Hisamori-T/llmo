"""Content router — 一次情報登録 / GEO5原則記事生成 / 編集 API."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.shared.api.deps import get_current_user
from .schemas import (
    AddSourceRequest, AiAssistRequest, AiAssistResponse,
    ArticleResponse, GenerateArticleRequest, KeywordSuggestionsResponse,
    SourceResponse, TemplatesResponse, UpdateArticleRequest,
)
from .services import AiAssistService, ContentArticleService, ContentSourceService, KeywordSuggestionsService
from .templates_data import TEMPLATES

router = APIRouter(tags=['content'])
_source_svc = ContentSourceService()
_article_svc = ContentArticleService()
_ai_assist_svc = AiAssistService()
_kw_suggest_svc = KeywordSuggestionsService()


# ── Templates endpoint (static — must precede any /{id} patterns) ─────────

@router.get('/templates', response_model=TemplatesResponse)
async def get_templates(
    current_user = Depends(get_current_user),
):
    return TemplatesResponse(templates=TEMPLATES)


@router.post('/ai-assist', response_model=AiAssistResponse)
async def ai_assist(
    body: AiAssistRequest,
    current_user = Depends(get_current_user),
):
    result = await _ai_assist_svc.run(
        mode=body.mode,
        source_type=body.source_type,
        text=body.text,
        member_id=current_user.member_id,
    )
    return result


@router.get('/keyword-suggestions', response_model=KeywordSuggestionsResponse)
async def get_keyword_suggestions(
    client_id: str = Query(...),
    current_user = Depends(get_current_user),
):
    return await _kw_suggest_svc.get_suggestions(
        client_id=client_id,
        agency_id=current_user.agency_id,
    )


# ── Source endpoints ──────────────────────────────────────────────────────

@router.post('/sources', response_model=SourceResponse, status_code=201)
async def add_source(
    body: AddSourceRequest,
    current_user = Depends(get_current_user),
):
    try:
        doc = await _source_svc.add(
            client_id=body.client_id,
            agency_id=current_user.agency_id,
            member_id=current_user.member_id,
            source_type=body.type,
            title=body.title,
            body=body.body,
            source_url=body.source_url,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return doc


@router.get('/sources', response_model=list[SourceResponse])
async def list_sources(
    client_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
):
    return await _source_svc.list_sources(
        agency_id=current_user.agency_id,
        client_id=client_id,
    )


@router.get('/sources/{source_id}', response_model=SourceResponse)
async def get_source(
    source_id: str,
    current_user = Depends(get_current_user),
):
    doc = await _source_svc.get_source(source_id, current_user.agency_id)
    if not doc:
        raise HTTPException(404, 'Source not found')
    return doc


@router.delete('/sources/{source_id}', status_code=204)
async def delete_source(
    source_id: str,
    current_user = Depends(get_current_user),
):
    ok = await _source_svc.delete_source(source_id, current_user.agency_id)
    if not ok:
        raise HTTPException(404, 'Source not found')


# ── Article endpoints ─────────────────────────────────────────────────────

@router.post('/articles', response_model=ArticleResponse, status_code=201)
async def generate_article(
    body: GenerateArticleRequest,
    current_user = Depends(get_current_user),
):
    try:
        doc = await _article_svc.generate(
            client_id=body.client_id,
            agency_id=current_user.agency_id,
            member_id=current_user.member_id,
            target_keyword=body.target_keyword,
            target_keywords=body.target_keywords,
            source_ids=body.source_ids,
            diagnosis_id=body.diagnosis_id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return doc


@router.get('/articles', response_model=list[ArticleResponse])
async def list_articles(
    client_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
):
    return await _article_svc.list_articles(
        agency_id=current_user.agency_id,
        client_id=client_id,
    )


@router.get('/articles/{article_id}', response_model=ArticleResponse)
async def get_article(
    article_id: str,
    current_user = Depends(get_current_user),
):
    doc = await _article_svc.get(article_id, current_user.agency_id)
    if not doc:
        raise HTTPException(404, 'Article not found')
    return doc


@router.patch('/articles/{article_id}', response_model=ArticleResponse)
async def update_article(
    article_id: str,
    body: UpdateArticleRequest,
    current_user = Depends(get_current_user),
):
    try:
        doc = await _article_svc.update(
            article_id=article_id,
            agency_id=current_user.agency_id,
            title=body.title,
            body_markdown=body.body_markdown,
            status=body.status,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    return doc
