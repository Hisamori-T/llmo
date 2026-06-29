"""Content service — GEO5原則 AIO コンテンツ生成（一次情報登録 → 記事生成 → 編集）。"""
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import HTTPException

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.llm.orchestrator import ask_single
from app.shared.llm.tavily import search as tavily_search
from app.shared.utils.credits import check_and_deduct
from app.shared.constants.plans import CREDIT_COSTS
from .geo5 import GEO5_PRINCIPLES
from .templates_data import TEMPLATES

# In-process service calls（DB直参照禁止・疎結合ルール準拠）
from app.modules.diagnosis.services import DiagnosisService as _DiagnosisSvc
from app.modules.client.services import ClientService as _ClientSvc
from app.modules.keyword.services import suggest_keywords as _suggest_keywords

logger = logging.getLogger(__name__)

# ── Article generation prompt ─────────────────────────────────────────────
# GEO5原則の定義は geo5.py が唯一の出典（二重定義禁止）

_GEO5_SECTION = '\n'.join(
    ['## GEO5原則（全て必須）'] +
    [f'{i + 1}. 【{p.name}】{p.content}' for i, p in enumerate(GEO5_PRINCIPLES)]
)

_ARTICLE_PROMPT_SUFFIX = """

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

_ARTICLE_PROMPT = (
    'あなたはGEO（生成エンジン最適化）のプロライターです。\n'
    'AIに選ばれやすい・引用されやすい記事を作成してください。\n'
    '\n'
    + _GEO5_SECTION
    + _ARTICLE_PROMPT_SUFFIX
)


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
        target_keywords: Optional[list[str]] = None,
    ) -> dict:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id:
            raise ValueError('Client not found')

        # KW解決: 複数KW指定（✨）→ 代表1件をDB保存・全件をプロンプトに渡す。単数後方互換。
        if target_keywords and len(target_keywords) > 0:
            primary_keyword = target_keywords[0]
            keyword_for_prompt = ' / '.join(target_keywords)
        elif target_keyword:
            primary_keyword = target_keyword
            keyword_for_prompt = target_keyword
        else:
            raise ValueError('target_keyword または target_keywords が必要です')

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
            keyword=keyword_for_prompt,
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
            'target_keyword': primary_keyword,
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


# ── AiAssistService ───────────────────────────────────────────────────────

class AiAssistService:
    """AI補助（gap_check / structure）。geo5.py を唯一の出典としてプロンプトを生成。
    課金パターン: 成功後1cr（check_and_deduct は LLM+parse 成功後のみ呼ぶ）。
    """

    def _build_gap_check_prompt(self, text: str) -> str:
        criteria = '\n'.join(
            f'{i + 1}. 【{p.name}】key="{p.key}" — {p.check}'
            for i, p in enumerate(GEO5_PRINCIPLES)
        )
        return (
            'あなたはGEO（生成エンジン最適化）の専門家です。'
            '以下の一次情報テキストをGEO5原則の観点で評価し、'
            '不足している原則のみをJSONで返してください。\n\n'
            f'## GEO5評価基準（全5原則）\n{criteria}\n\n'
            '## 評価ルール\n'
            '- 各原則を評価し、不足しているもののみ "missing" 配列に含める\n'
            '- 不足なしの場合は missing: []\n'
            '- 厳密JSON形式のみで出力（Markdown・前後の説明文・コードブロック禁止）\n\n'
            f'## 評価テキスト\n{text}\n\n'
            '## 出力（JSONのみ・他の文字列不要）\n'
            '{"missing": [{"geo_key": "<geo_key値>", "message": "<不足の説明（20〜50文字）>"}]}'
        )

    def _build_structure_prompt(self, text: str, source_type: str) -> str:
        if source_type == 'interview':
            questions = '\n'.join(
                f'Q{i + 1}. {p.guiding_question}'
                for i, p in enumerate(GEO5_PRINCIPLES)
            )
            format_desc = (
                'Q&A形式で整形してください。以下の質問を目安に内容を分類・整理してください:\n'
                f'{questions}\n'
                '各Qに対して A: （回答） の形式で、元のテキストの内容を整理して出力してください。'
            )
        else:  # doc
            headings = [s['heading'] for s in TEMPLATES['doc']['scaffold']]
            format_desc = (
                f'以下の3つの見出し構造に整形してください: {" / ".join(headings)}\n'
                '各見出し下に箇条書きまたは文章で内容を整理してください。'
            )
        return (
            'あなたは文章整形の専門家です。'
            '以下のテキストをGEO5原則（引用可能性・数値・統計・権威性・簡潔な結論）に沿った構造で整形してください。\n\n'
            f'## 整形方針\n{format_desc}\n\n'
            '## 整形ルール\n'
            '- 元のテキストの内容を最大限活かし、加筆・創作はしない\n'
            '- 厳密JSON形式のみで出力（Markdown・前後の説明文・コードブロック禁止）\n\n'
            f'## 整形対象テキスト\n{text}\n\n'
            '## 出力（JSONのみ・他の文字列不要）\n'
            '{"structured_text": "<整形後テキスト>"}'
        )

    async def run(
        self,
        mode: str,
        source_type: str,
        text: str,
        member_id: str,
    ) -> dict:
        # 1. 事前残量チェック（LLMを呼ぶ前に弾く）
        member = await db_get('agency_members', member_id)
        if not member:
            raise HTTPException(404, 'Member not found')
        cost = CREDIT_COSTS['content_ai_assist']
        remaining = member.get('monthly_credit_limit', 0) - member.get('monthly_credit_used', 0)
        if remaining < cost:
            raise HTTPException(
                402,
                f'Insufficient credits. Required: {cost}, Available: {remaining}',
            )

        # 2. プロンプト生成（geo5.py を唯一の出典として参照）
        if mode == 'gap_check':
            prompt = self._build_gap_check_prompt(text)
        else:
            prompt = self._build_structure_prompt(text, source_type)

        # 3. LLM呼び出し（Gemini単体・多LLM不使用）
        resp = await ask_single(prompt, model='gemini', timeout=30.0)
        if not resp.ok:
            logger.error('ai_assist LLM error mode=%s: %s', mode, resp.error)
            raise HTTPException(502, 'AI補助に失敗しました')

        # 4. JSON parse（失敗時は課金しない）
        parsed = _extract_json(resp.text)
        if parsed is None:
            logger.error('ai_assist JSON parse failed mode=%s text_head=%s', mode, resp.text[:200])
            raise HTTPException(502, 'AI補助のレスポンス解析に失敗しました')

        # mode別の必須キー検証
        if mode == 'gap_check' and 'missing' not in parsed:
            logger.error('ai_assist gap_check missing key: %s', parsed)
            raise HTTPException(502, 'AI補助のレスポンス形式が不正です')
        if mode == 'structure' and 'structured_text' not in parsed:
            logger.error('ai_assist structure missing key: %s', parsed)
            raise HTTPException(502, 'AI補助のレスポンス形式が不正です')

        # 5. 成功後課金（LLM+parse 成功時のみ）
        await check_and_deduct(member_id, 'content_ai_assist')

        return parsed


# ── KeywordSuggestionsService ─────────────────────────────────────────────

class KeywordSuggestionsService:
    """キーワード候補取得。diagnosis スコア経由（優先）→ fallback で suggest_keywords。
    課金なし（suggest_keywords も check_and_deduct 呼ばない）。
    """

    _diag_svc = _DiagnosisSvc()
    _client_svc = _ClientSvc()

    async def get_suggestions(self, client_id: str, agency_id: str) -> dict:
        # 1. 診断スコアを取得（diagnosisモジュールの公開APIを in-process で呼ぶ）
        result = await self._diag_svc.get_keyword_scores(client_id, agency_id)
        scores: dict[str, int] = result.get('scores', {})

        if scores:
            # スコア昇順（弱いものを先頭）
            sorted_items = sorted(scores.items(), key=lambda x: x[1])
            candidates = [
                {
                    'keyword': kw,
                    'score': score,
                    'weak': score < 80,
                    'label': f'{kw}（{score}・要強化）' if score < 80 else f'{kw}（{score}）',
                }
                for kw, score in sorted_items
            ]
            return {'source': 'diagnosis', 'requires_generation': False, 'candidates': candidates}

        # 2. 診断スコアなし → クライアント情報でフォールバック
        client = await self._client_svc.get(client_id, agency_id)
        if not client:
            return {'source': 'fallback', 'requires_generation': False, 'candidates': []}

        suggested = await _suggest_keywords(
            company_name=client.get('name', ''),
            industry=client.get('industry', ''),
            location=client.get('location', ''),
        )
        candidates = [
            {'keyword': kw, 'score': None, 'weak': False, 'label': kw}
            for kw in suggested
        ]
        return {'source': 'fallback', 'requires_generation': False, 'candidates': candidates}


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
