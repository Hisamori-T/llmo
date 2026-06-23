"""Content service — GEO5原則 AIO コンテンツ生成（一次情報登録 → 記事生成 → 編集）."""
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.llm.orchestrator import ask_single
from app.shared.llm.tavily import search as tavily_search
from app.shared.utils.credits import check_and_deduct
from app.shared.constants.plans import CREDIT_COSTS

# ── Article generation prompt ─────────────────────────────────────────────

_ARTICLE_PROMPT = """\
あなたはGEO（生成エンジン最適化）のプロライターです。
AIに選ばれやすい・引用されやすい記事を作成してください。

## GEO5原則（全て必須）
1. 【引用可能性】AIが直接引用できる具体的な文章（固有名詞・実績数値・地名を含む文）
2. 【数値】定量データを最低3箇所（年数・件数・費用・割合・面積など）
3. 【統計/調査】業界統計または調査結果を1箇所以上（「〜調査によると」「〜年時点で〜%」など）
4. 【権威性】専門資格・受賞歴・施工実績・年数・メディア掲載など信頼指標を記述
5. 【簡潔な結論】各セクション末または記事末に、AIが引用しやすい1〜2文の要約

## 企業情報
- 名称: {name}
- URL: {url}
- 業種: {industry}
- エリア: {location}

## ターゲットキーワード
{keyword}

## 一次情報（顧客提供・必ずこの内容を活用して他社との差別化を図ること）
{sources_text}

{diagnosis_context}

## 出力（JSON形式のみ・コードブロック不要）
{{
  "title": "記事タイトル（40〜60文字、ターゲットキーワードを含む）",
  "outline": [
    {{"heading": "見出し名", "summary": "この節で伝える要点（1文）"}},
    ...（5〜8見出し）
  ],
  "body_markdown": "## 見出し1\\n\\n本文...（Markdownフォーマット、3000文字以上）",
  "geo_checklist": {{
    "citations": true,
    "numbers": true,
    "statistics": true,
    "authority": true,
    "conclusions": true
  }}
}}

body_markdown は3000文字以上。各見出し下に段落・箇条書きを使い具体性を持たせること。
キーワードは自然に本文中に3〜5回散りばめること。"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text


def _extract_json(text: str) -> Optional[dict]:
    try:
        return json.loads(_strip_fences(text))
    except Exception:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


# ── ContentSourceService ──────────────────────────────────────────────────

class ContentSourceService:
    async def add(
        self,
        client_id: str,
        agency_id: str,
        member_id: str,
        source_type: str,
        title: str,
        body: str,
        source_url: str,
    ) -> dict:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id:
            raise ValueError('Client not found')

        fetched_body = body

        # type=url でbodyが未入力の場合、Tavilyでページ内容を取得
        if source_type == 'url' and source_url and not body:
            results = await tavily_search(source_url, max_results=1)
            if results:
                fetched_body = results[0].get('content', '')[:3000]

        source_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        await db_set('content_sources', source_id, {
            'source_id': source_id,
            'client_id': client_id,
            'agency_id': agency_id,
            'member_id': member_id,
            'type': source_type,
            'title': title,
            'body': fetched_body,
            'source_url': source_url,
            'created_at': now,
        })

        return await db_get('content_sources', source_id)

    async def list_sources(
        self,
        agency_id: str,
        client_id: Optional[str] = None,
    ) -> list:
        docs = await db_query(
            'content_sources',
            filters=[('agency_id', '==', agency_id)],
            limit=200,
        )
        if client_id:
            docs = [d for d in docs if d.get('client_id') == client_id]
        docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        return docs

    async def get_source(self, source_id: str, agency_id: str) -> Optional[dict]:
        doc = await db_get('content_sources', source_id)
        if not doc or doc.get('agency_id') != agency_id:
            return None
        return doc

    async def delete_source(self, source_id: str, agency_id: str) -> bool:
        doc = await db_get('content_sources', source_id)
        if not doc or doc.get('agency_id') != agency_id:
            return False
        from app.shared.db.firestore import db_delete
        await db_delete('content_sources', source_id)
        return True


# ── ContentArticleService ─────────────────────────────────────────────────

class ContentArticleService:
    async def generate(
        self,
        client_id: str,
        agency_id: str,
        member_id: str,
        target_keyword: str,
        source_ids: list[str],
        diagnosis_id: Optional[str],
    ) -> dict:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id:
            raise ValueError('Client not found')

        await check_and_deduct(member_id, 'content_article')

        # Load sources
        sources = []
        for sid in source_ids:
            s = await db_get('content_sources', sid)
            if s and s.get('client_id') == client_id:
                sources.append(s)

        sources_text = '\n\n'.join(
            f'【{s.get("title", "")}（{s.get("type", "")}）】\n{s.get("body", "")[:800]}'
            for s in sources
        ) or '（一次情報なし — 業種標準の情報で生成）'

        # Optional: weak dependency on diagnosis findings
        diagnosis_context = ''
        if diagnosis_id:
            diagnosis = await db_get('diagnoses', diagnosis_id)
            if diagnosis and diagnosis.get('agency_id') == agency_id:
                findings = diagnosis.get('findings', []) or []
                top_findings = [
                    f.get('title', '') for f in findings[:3] if isinstance(f, dict)
                ]
                if top_findings:
                    diagnosis_context = (
                        '## 診断で判明した課題（記事で解決策として言及すること）\n'
                        + '\n'.join(f'- {t}' for t in top_findings)
                    )

        prompt = _ARTICLE_PROMPT.format(
            name=client.get('name', ''),
            url=client.get('url', ''),
            industry=client.get('industry', ''),
            location=client.get('location', ''),
            keyword=target_keyword,
            sources_text=sources_text,
            diagnosis_context=diagnosis_context,
        )

        now = datetime.now(timezone.utc).isoformat()
        article_id = str(uuid.uuid4())

        await db_set('content_articles', article_id, {
            'article_id': article_id,
            'client_id': client_id,
            'agency_id': agency_id,
            'member_id': member_id,
            'diagnosis_id': diagnosis_id,
            'target_keyword': target_keyword,
            'title': None,
            'outline': None,
            'body_markdown': None,
            'geo_checklist': None,
            'source_ids': source_ids,
            'status': 'draft',
            'credits_used': CREDIT_COSTS['content_article'],
            'created_at': now,
            'updated_at': now,
        })

        resp = await ask_single(prompt, model='gemini', timeout=90.0)
        if not resp.ok:
            await db_update('content_articles', article_id, {
                'status': 'draft',
                'updated_at': datetime.now(timezone.utc).isoformat(),
            })
            raise RuntimeError(f'Article generation failed: {resp.error}')

        parsed = _extract_json(resp.text) or {}

        await db_update('content_articles', article_id, {
            'title': parsed.get('title', f'{target_keyword}について'),
            'outline': parsed.get('outline', []),
            'body_markdown': parsed.get('body_markdown', resp.text),
            'geo_checklist': parsed.get('geo_checklist', {
                'citations': False, 'numbers': False,
                'statistics': False, 'authority': False, 'conclusions': False,
            }),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        })

        return await db_get('content_articles', article_id)

    async def update(
        self,
        article_id: str,
        agency_id: str,
        title: Optional[str],
        body_markdown: Optional[str],
        status: Optional[str],
    ) -> dict:
        doc = await db_get('content_articles', article_id)
        if not doc or doc.get('agency_id') != agency_id:
            raise ValueError('Article not found')

        patch: dict = {'updated_at': datetime.now(timezone.utc).isoformat()}
        if title is not None:
            patch['title'] = title
        if body_markdown is not None:
            patch['body_markdown'] = body_markdown
            # Re-evaluate GEO checklist on edit
            patch['geo_checklist'] = _check_geo(body_markdown)
        if status is not None:
            patch['status'] = status

        await db_update('content_articles', article_id, patch)
        return await db_get('content_articles', article_id)

    async def list_articles(
        self,
        agency_id: str,
        client_id: Optional[str] = None,
        limit: int = 50,
    ) -> list:
        docs = await db_query(
            'content_articles',
            filters=[('agency_id', '==', agency_id)],
            limit=limit,
        )
        if client_id:
            docs = [d for d in docs if d.get('client_id') == client_id]
        docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        return docs

    async def get(self, article_id: str, agency_id: str) -> Optional[dict]:
        doc = await db_get('content_articles', article_id)
        if not doc or doc.get('agency_id') != agency_id:
            return None
        return doc


def _check_geo(text: str) -> dict:
    """Heuristic GEO5 check on edited body text."""
    has_numbers = bool(re.search(r'\d+(?:[,，]\d+)*(?:\.\d+)?[%年件万個点回]', text))
    has_stats = bool(re.search(r'(調査|統計|レポート|データ|割合|パーセント|%)', text))
    has_citations = bool(re.search(r'「[^」]{10,}」', text))
    has_authority = bool(re.search(r'(資格|受賞|認定|実績|年数|年間|創業|設立|経験)', text))
    has_conclusions = bool(re.search(r'(まとめ|結論|ポイント|つまり|要するに)', text))
    return {
        'citations': has_citations,
        'numbers': has_numbers,
        'statistics': has_stats,
        'authority': has_authority,
        'conclusions': has_conclusions,
    }
