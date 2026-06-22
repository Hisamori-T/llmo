from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.shared.api.deps import CurrentUser, get_current_user, require_role
from .schemas import GenerateKeywordsRequest, KeywordItem, KeywordResult, Competitor, SuggestKeywordsRequest
from .services import KeywordService, suggest_keywords

router = APIRouter(tags=['keywords'])
_svc = KeywordService()


def _to_result(d: dict) -> KeywordResult:
    return KeywordResult(
        keyword_id=d.get('keyword_id') or d['_id'],
        client_id=d.get('client_id', ''),
        agency_id=d.get('agency_id', ''),
        url=d.get('url', ''),
        location=d.get('location', ''),
        industry=d.get('industry', ''),
        competitors=[Competitor(**c) if isinstance(c, dict) else c for c in d.get('competitors', [])],
        keywords=[KeywordItem(**k) if isinstance(k, dict) else k for k in d.get('keywords', [])],
        status=d.get('status', ''),
        credits_used=d.get('credits_used', 3),
        created_at=d.get('created_at', ''),
        completed_at=d.get('completed_at'),
    )


@router.post('/suggest', response_model=list[str])
async def suggest_keywords_endpoint(
    body: SuggestKeywordsRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return await suggest_keywords(
            company_name=body.company_name,
            industry=body.industry,
            location=body.location,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post('', response_model=KeywordResult, status_code=status.HTTP_201_CREATED)
async def generate_keywords(
    body: GenerateKeywordsRequest,
    current_user: CurrentUser = Depends(require_role('admin', 'staff')),
):
    try:
        result = await _svc.generate(
            client_id=body.client_id,
            agency_id=current_user.agency_id,
            member_id=current_user.member_id,
            location=body.location,
            max_competitors=body.max_competitors,
        )
        return _to_result(result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get('', response_model=list[KeywordResult])
async def list_keywords(
    client_id: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    docs = await _svc.list_keywords(agency_id=current_user.agency_id, client_id=client_id)
    return [_to_result(d) for d in docs]


@router.get('/{keyword_id}', response_model=KeywordResult)
async def get_keyword(
    keyword_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    doc = await _svc.get(keyword_id, current_user.agency_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Keyword result not found')
    return _to_result(doc)
