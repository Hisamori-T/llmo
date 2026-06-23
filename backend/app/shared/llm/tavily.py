"""Tavily API web search for real-time grounding."""
from typing import Optional

import httpx

from app.config import settings

_API_URL = 'https://api.tavily.com/search'


async def search(
    query: str,
    max_results: int = 5,
    include_domains: Optional[list[str]] = None,
) -> list[dict]:
    """Search Tavily. Returns list of {url, title, content, score}. Falls back to [] if unconfigured."""
    if not settings.tavily_api_key:
        return []

    payload = {
        'api_key': settings.tavily_api_key,
        'query': query,
        'max_results': max_results,
        'search_depth': 'basic',
        'include_answer': False,
    }
    if include_domains:
        payload['include_domains'] = include_domains

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(_API_URL, json=payload)
            res.raise_for_status()
            data = res.json()
            return data.get('results', [])
    except Exception:
        return []


async def search_business(url: str, company_name: str) -> list[dict]:
    domain = url.replace('https://', '').replace('http://', '').split('/')[0]
    results = await search(
        query=f'{company_name} {domain} サービス 特徴',
        max_results=5,
        include_domains=[domain] if domain else None,
    )
    if not results:
        results = await search(query=f'{company_name} 会社概要', max_results=3)
    return results


async def search_keyword(keyword: str, location: str = '') -> list[dict]:
    query = f'{keyword} {location}'.strip() if location else keyword
    return await search(query=query, max_results=3)
