import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.llm.orchestrator import ask_single
from app.shared.utils.credits import check_and_deduct

KEYWORD_PROMPT = """\
あなたはWeb集客・SEO・LLMO（LLM検索最適化）の専門家です。
以下のビジネス情報と競合他社リストを基に、このビジネスがAI検索で上位に表示されるための最適なキーワードを生成してください。

ビジネス情報:
- 名称: {name}
- URL: {url}
- 業種: {industry}
- エリア: {location}

競合他社（上位{n}社）:
{competitors}

以下のJSON形式で30個のキーワードを返してください。必ずJSONのみを返し、説明文は不要です:
{{
  "keywords": [
    {{"keyword": "...", "intent": "informational", "priority": "high"}},
    ...
  ]
}}

intentは "informational"（情報収集）、"commercial"（購入検討）、"navigational"（指名検索）のいずれか。
priorityは "high"、"medium"、"low"のいずれか。
"""


class KeywordService:
    async def generate(
        self,
        client_id: str,
        agency_id: str,
        member_id: str,
        location: str,
        max_competitors: int,
    ) -> dict:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id:
            raise ValueError('Client not found')

        await check_and_deduct(member_id, 'keyword_generation')

        now = datetime.now(timezone.utc).isoformat()
        keyword_id = str(uuid.uuid4())

        await db_set('keywords', keyword_id, {
            'keyword_id': keyword_id,
            'client_id': client_id,
            'agency_id': agency_id,
            'member_id': member_id,
            'url': client.get('url', ''),
            'location': location,
            'industry': client.get('industry', ''),
            'competitors': [],
            'keywords': [],
            'status': 'running',
            'credits_used': 3,
            'created_at': now,
            'completed_at': None,
        })

        try:
            competitors = await _fetch_competitors(
                industry=client.get('industry', ''),
                location=location,
                own_url=client.get('url', ''),
                max_results=max_competitors,
            )
            keywords = await _generate_keywords_with_gemini(
                name=client.get('name', ''),
                url=client.get('url', ''),
                industry=client.get('industry', ''),
                location=location,
                competitors=competitors,
            )

            completed_at = datetime.now(timezone.utc).isoformat()
            await db_update('keywords', keyword_id, {
                'competitors': [c.__dict__ if hasattr(c, '__dict__') else c for c in competitors],
                'keywords': keywords,
                'status': 'completed',
                'completed_at': completed_at,
            })

        except Exception as e:
            await db_update('keywords', keyword_id, {
                'status': 'failed',
                'error': str(e),
                'completed_at': datetime.now(timezone.utc).isoformat(),
            })
            raise

        return await db_get('keywords', keyword_id)

    async def list_keywords(self, agency_id: str, client_id: Optional[str] = None) -> list:
        filters = [('agency_id', '==', agency_id)]
        docs = await db_query('keywords', filters=filters, limit=100)
        if client_id:
            docs = [d for d in docs if d.get('client_id') == client_id]
        docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        return docs

    async def get(self, keyword_id: str, agency_id: str) -> Optional[dict]:
        doc = await db_get('keywords', keyword_id)
        if not doc or doc.get('agency_id') != agency_id:
            return None
        return doc


SUGGEST_PROMPT = """\
あなたはLLMO（AI検索最適化）の専門家です。
以下のビジネス情報を基に、このビジネスがAI検索で上位に表示されるための最適なキーワードを10個提案してください。

ビジネス情報:
- 企業名: {company_name}
- 業種: {industry}
- エリア: {location}

以下のJSON形式のみで返してください。説明文は不要です:
{{"keywords": ["キーワード1", "キーワード2", "キーワード3"]}}
"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text


async def suggest_keywords(company_name: str, industry: str, location: str = '') -> list[str]:
    prompt = SUGGEST_PROMPT.format(
        company_name=company_name,
        industry=industry,
        location=location or '未指定',
    )
    resp = await ask_single(prompt, model='gemini')
    if not resp.ok:
        return []
    try:
        parsed = json.loads(_strip_fences(resp.text))
        return [str(k) for k in parsed.get('keywords', [])]
    except Exception:
        return []


async def _fetch_competitors(
    industry: str,
    location: str,
    own_url: str,
    max_results: int,
) -> list:
    if not settings.google_places_api_key:
        return []

    query = f'{industry} {location}'
    url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
    params = {'query': query, 'key': settings.google_places_api_key, 'language': 'ja'}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            data = resp.json()
    except Exception:
        return []

    competitors = []
    for place in data.get('results', [])[:max_results * 2]:
        name = place.get('name', '')
        address = place.get('formatted_address', '')
        website = place.get('website', '')

        if own_url and website and own_url.replace('https://', '').replace('http://', '').split('/')[0] in website:
            continue

        competitors.append({
            'name': name,
            'url': website or '',
            'address': address,
        })
        if len(competitors) >= max_results:
            break

    return competitors


async def _generate_keywords_with_gemini(
    name: str,
    url: str,
    industry: str,
    location: str,
    competitors: list,
) -> list:
    competitors_text = '\n'.join(
        f'- {c.get("name", "")} ({c.get("url", "")})'
        for c in competitors
    ) or '競合情報なし'

    prompt = KEYWORD_PROMPT.format(
        name=name,
        url=url,
        industry=industry,
        location=location,
        competitors=competitors_text,
        n=len(competitors),
    )

    resp = await ask_single(prompt, model='gemini')
    if not resp.ok:
        raise RuntimeError(f'Gemini keyword generation failed: {resp.error}')

    parsed = json.loads(_strip_fences(resp.text))
    return parsed.get('keywords', [])
