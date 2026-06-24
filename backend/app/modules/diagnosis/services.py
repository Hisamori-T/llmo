"""Diagnosis service — simple(Gemini単体) / detailed(Gemini+GPT-4o+Tavily 多LLM)."""
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.utils.credits import check_and_deduct
from app.shared.constants.plans import CREDIT_COSTS
from app.shared.llm.orchestrator import ask_parallel, ask_single
from app.shared.llm.tavily import search_business, search_keyword

# ── Simple diagnosis (Gemini only) ──────────────────────────────────────────

_SCORE_SECTION = """\
あなたはLLMO（AI検索最適化）診断の専門家です。
以下のビジネスについて、AIがどれだけ認識・回答できるかを診断してください。

ビジネス情報:
- 名称: {name}
- URL: {url}
- 業種: {industry}
- エリア: {location}
- キーワード: {keywords}

## スコア基準（必ず以下の定義に従って厳密に採点すること）

- ai_awareness: 主要AI（ChatGPT/Claude/Gemini）がこのビジネスを正確に説明できる度合い。\
情報が公開・構造化されていない新興企業は20〜40、中規模企業は40〜60、\
広く認知された企業は60〜80、業界リーダーは80以上。
- brand_recognition: ブランド名・商号のAIへの浸透度。創業3年未満は30以下、\
地域密着型は30〜50、全国展開は50〜70、上場・著名企業は70以上。
- content_quality: WebサイトのAI読み取り適性（構造化データ・メタ情報・FAQ・明確な説明文）。\
URLのみで判断できない場合は業種標準値（50）を使用。
- competitor_gap: 同業他社と比較した優位性。業界平均と同水準なら50、優位なら50〜70、劣位なら50以下。
- overall: (ai_awareness + brand_recognition + content_quality + competitor_gap) / 4 の単純平均\
（小数点以下四捨五入）

スコアは事実ベースで算出し、楽観的・悲観的バイアスをかけないこと。\
"""

_SIMPLE_JSON = """

以下のJSON形式のみを返してください（コードブロック不要）:
{{
  "scores": {{
    "ai_awareness": <整数>,
    "brand_recognition": <整数>,
    "content_quality": <整数>,
    "competitor_gap": <整数>,
    "overall": <整数>
  }},
  "findings": [
    {{"category": "カテゴリ名", "severity": "high|medium|low",
      "title": "問題タイトル", "description": "詳細説明（100字程度）"}}
  ],
  "recommendations": ["改善提案1", "改善提案2", "改善提案3"]
}}
findingsは3〜5件、recommendationsは3〜5件。"""

SIMPLE_PROMPT = _SCORE_SECTION + _SIMPLE_JSON

# ── Detailed diagnosis prompts (multi-LLM per keyword) ──────────────────────

_KEYWORD_QUERY_PROMPT = """\
あなたはWeb上での企業認知度を調査するシステムです。
あなたの知識の中で、以下の質問に回答してください。

【質問】キーワード「{keyword}」で検索したとき、「{company_name}」（{url}）は推奨・言及されますか？

参考情報（Web調査結果）:
{evidence}

以下のJSON形式のみを返してください（コードブロック不要）:
{{
  "mention": "mentioned|partial|not_mentioned",
  "quality": 0,
  "context": "評価理由（100文字以内）",
  "summary": "この企業についてあなたが知っていること（200文字以内）"
}}

quality の基準:
- 0: 全く言及なし・知らない
- 1: 名前・存在のみ言及
- 2: 事業内容まで正確に説明できる
- 3: 推奨・上位提示・詳細な強みまで言及できる
"""

_SYNTHESIS_PROMPT = """\
あなたはLLMO（AI検索最適化）診断の専門家です。
以下の多LLM診断結果をもとに、詳細な分析・改善提案を生成してください。

企業情報:
- 名称: {name} / URL: {url} / 業種: {industry} / エリア: {location}

キーワード別AI認識スコア:
{keyword_scores_text}

総合スコア: overall={overall} / ai_awareness={ai_awareness} / competitive={competitive}

以下のJSON形式のみを返してください（コードブロック不要）:
{{
  "findings": [
    {{"category": "カテゴリ名", "severity": "high|medium|low",
      "title": "問題タイトル", "description": "詳細説明（200字以上）"}}
  ],
  "recommendations": [
    {{"priority": "high|medium|low", "category": "カテゴリ",
      "action": "具体的アクション", "impact": "期待効果", "timeline": "1週間以内|1ヶ月以内|3ヶ月以内"}}
  ],
  "projections": {{
    "six_month": "6ヶ月後の予測（施策実施を前提）",
    "twelve_month": "12ヶ月後の予測"
  }}
}}
findingsは8件以上、recommendationsは8件以上（優先度順）。"""


def _extract_json(text: str) -> Optional[dict]:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


# ── Simple diagnosis runner ──────────────────────────────────────────────────

async def _run_simple_diagnosis(
    name: str, url: str, industry: str, location: str, keywords: list[str],
) -> dict:
    kw_str = ', '.join(keywords[:5]) if keywords else '（指定なし）'
    prompt = SIMPLE_PROMPT.format(
        name=name, url=url, industry=industry, location=location, keywords=kw_str,
    )
    resp = await ask_single(prompt, model='gemini')
    if not resp.ok:
        raise RuntimeError(f'Gemini failed: {resp.error}')

    parsed = _extract_json(resp.text)
    if not parsed:
        raise ValueError(f'Failed to parse Gemini response: {resp.text[:200]}')

    return {
        'scores': parsed['scores'],
        'findings': parsed.get('findings', []),
        'recommendations': parsed.get('recommendations', []),
    }, False  # simple is never degraded (single-LLM, all-or-nothing)


# ── Detailed multi-LLM diagnosis runner ─────────────────────────────────────

def _judge_mention(quality: int) -> str:
    if quality >= 2:
        return 'mentioned'
    if quality == 1:
        return 'partial'
    return 'not_mentioned'


def _calc_citation_scores(keyword_results: dict) -> dict:
    """
    keyword_results: {keyword: {"gemini": {mention, quality}, "gpt4o": {mention, quality}}}

    Returns: {overall, ai_awareness, keyword_score_map}
    """
    kw_scores = {}
    mention_counts = 0
    total_keywords = len(keyword_results)

    for kw, ai_data in keyword_results.items():
        qualities = [v.get('quality', 0) for v in ai_data.values() if v]
        n_ai = len(qualities) or 1
        kw_score = round(sum(q / 3 for q in qualities) / n_ai * 100)
        kw_scores[kw] = kw_score

        any_mentioned = any(v.get('mention') in ('mentioned', 'partial') for v in ai_data.values() if v)
        if any_mentioned:
            mention_counts += 1

    overall = round(sum(kw_scores.values()) / total_keywords) if total_keywords else 0
    ai_awareness = round(mention_counts / total_keywords * 100) if total_keywords else 0

    return {'overall': overall, 'ai_awareness': ai_awareness, 'keyword_scores': kw_scores}


async def _run_detailed_diagnosis(
    name: str, url: str, industry: str, location: str, keywords: list[str],
) -> dict:
    # 1. Tavily grounding
    business_evidence = await search_business(url, name)
    evidence_text = '\n'.join(
        f'- {r["title"]}: {r["content"][:200]}' for r in business_evidence[:3]
    ) or '（Web情報なし）'

    # 2. Per-keyword multi-LLM query
    keyword_results: dict[str, dict] = {}
    raw_evidence: dict[str, dict] = {}
    total_calls = 0
    failed_calls = 0

    for kw in keywords[:8]:
        kw_evidence = await search_keyword(kw, location)
        kw_evidence_text = evidence_text + '\n' + '\n'.join(
            f'- {r["title"]}: {r["content"][:150]}' for r in kw_evidence[:2]
        )

        prompt = _KEYWORD_QUERY_PROMPT.format(
            keyword=kw, company_name=name, url=url, evidence=kw_evidence_text,
        )
        responses = await ask_parallel(prompt)

        keyword_results[kw] = {}
        raw_evidence[kw] = {}

        for model_name, resp in responses.items():
            total_calls += 1
            if resp.ok:
                parsed = _extract_json(resp.text) or {}
                quality = int(parsed.get('quality', 0))
                keyword_results[kw][model_name] = {
                    'mention': _judge_mention(quality),
                    'quality': quality,
                    'context': parsed.get('context', ''),
                    'raw': resp.raw[:500],
                }
            else:
                failed_calls += 1
                keyword_results[kw][model_name] = {
                    'mention': 'not_mentioned', 'quality': 0,
                    'context': f'error: {resp.error}', 'raw': '',
                }
            raw_evidence[kw][model_name] = resp.raw[:1000]

    # All LLM calls failed → total failure, caller should not charge
    if total_calls > 0 and failed_calls == total_calls:
        raise RuntimeError('All LLM calls failed — no valid responses')

    # 3. Citation score calculation
    citation = _calc_citation_scores(keyword_results)
    overall = citation['overall']
    ai_awareness = citation['ai_awareness']
    # Simplified competitive/geo/eeat/growth (暫定値 — Phase 3 スコープ外の精緻化は後続で対応)
    competitive = min(100, max(0, overall + 5))
    geo = min(100, max(0, ai_awareness - 5))
    eeat = min(100, max(0, round((overall + ai_awareness) / 2 * 0.9)))
    growth = min(100, max(0, 100 - overall))

    scores = {
        'overall': overall,
        'ai_awareness': ai_awareness,
        'competitive': competitive,
        'geo': geo,
        'eeat': eeat,
        'growth_potential': growth,
        # backward-compat fields for simple schema
        'brand_recognition': ai_awareness,
        'content_quality': eeat,
        'competitor_gap': competitive,
    }

    # 4. Synthesis: findings + recommendations + projections
    def _kw_detail(kw: str) -> str:
        parts = [f'{m}={v.get("quality", 0)}' for m, v in keyword_results[kw].items()]
        return ', '.join(parts)

    kw_scores_text = '\n'.join(
        f'- {kw}: {score}点 ({_kw_detail(kw)})'
        for kw, score in citation['keyword_scores'].items()
    )
    synthesis_prompt = _SYNTHESIS_PROMPT.format(
        name=name, url=url, industry=industry, location=location,
        keyword_scores_text=kw_scores_text,
        overall=overall, ai_awareness=ai_awareness, competitive=competitive,
    )
    synthesis_resp = await ask_single(synthesis_prompt, model='gemini')
    synthesis = _extract_json(synthesis_resp.text) if synthesis_resp.ok else {}

    degraded = failed_calls > 0
    return {
        'scores': scores,
        'ai_analysis': {
            model_name: {
                kw: keyword_results[kw].get(model_name, {})
                for kw in keyword_results
            }
            for model_name in ('gemini', 'gpt4o')
        },
        'keyword_analysis': {'scores': citation['keyword_scores']},
        'findings': synthesis.get('findings', []),
        'recommendations': synthesis.get('recommendations', []),
        'projections': synthesis.get('projections', {}),
        'raw_evidence': {'tavily': business_evidence[:3], 'llm': raw_evidence},
    }, degraded


# ── DiagnosisService ─────────────────────────────────────────────────────────

class DiagnosisService:
    async def run(
        self,
        client_id: str,
        agency_id: str,
        member_id: str,
        keyword_id: Optional[str] = None,
        keywords: list[str] = None,
        diagnosis_type: str = 'simple',
        source: str = 'manual',
    ) -> dict:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id:
            raise ValueError('Client not found')

        operation = 'simple_diagnosis' if diagnosis_type == 'simple' else 'detailed_diagnosis'
        credits_needed = CREDIT_COSTS[operation]

        # Upfront balance check (no deduction yet) — automation credits managed separately
        if source == 'manual':
            member = await db_get('agency_members', member_id)
            if not member:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Member not found')
            remaining = member.get('monthly_credit_limit', 0) - member.get('monthly_credit_used', 0)
            if remaining < credits_needed:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f'Insufficient credits. Required: {credits_needed}, Available: {remaining}',
                )

        if keyword_id and not keywords:
            kw_doc = await db_get('keywords', keyword_id)
            if kw_doc and kw_doc.get('agency_id') == agency_id:
                keywords = [k.get('keyword', '') for k in kw_doc.get('keywords', [])[:10]]

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        retain_until = (now + timedelta(days=90)).date().isoformat()
        diagnosis_id = str(uuid.uuid4())

        keywords = keywords or []
        await db_set('diagnoses', diagnosis_id, {
            'diagnosis_id': diagnosis_id,
            'client_id': client_id,
            'agency_id': agency_id,
            'member_id': member_id,
            'url': client.get('url', ''),
            'keywords': keywords,
            'type': diagnosis_type,
            'source': source,
            'status': 'running',
            'scores': None,
            'ai_analysis': None,
            'keyword_analysis': None,
            'site_analysis': None,
            'findings': [],
            'recommendations': [],
            'projections': None,
            'raw_evidence': None,
            'credits_used': credits_needed,
            'degraded': False,
            'retain_until': retain_until,
            'created_at': now_iso,
            'completed_at': None,
        })

        try:
            if diagnosis_type == 'detailed':
                result, degraded = await _run_detailed_diagnosis(
                    name=client.get('name', ''),
                    url=client.get('url', ''),
                    industry=client.get('industry', ''),
                    location=client.get('location', ''),
                    keywords=keywords,
                )
            else:
                result, degraded = await _run_simple_diagnosis(
                    name=client.get('name', ''),
                    url=client.get('url', ''),
                    industry=client.get('industry', ''),
                    location=client.get('location', ''),
                    keywords=keywords,
                )

            # 1+ valid responses — charge now (post-success billing)
            if source == 'manual':
                await check_and_deduct(
                    member_id, operation,
                    resource_id=diagnosis_id,
                    client_id=client_id,
                )

            completed_at = datetime.now(timezone.utc).isoformat()
            await db_update('diagnoses', diagnosis_id, {
                'scores': result['scores'],
                'ai_analysis': result.get('ai_analysis'),
                'keyword_analysis': result.get('keyword_analysis'),
                'findings': result.get('findings', []),
                'recommendations': result.get('recommendations', []),
                'projections': result.get('projections'),
                'raw_evidence': result.get('raw_evidence'),
                'status': 'completed',
                'degraded': degraded,
                'completed_at': completed_at,
            })

            overall = result['scores'].get('overall', 0)
            await db_update('clients', client_id, {
                'latest_diagnosis_id': diagnosis_id,
                'latest_score': overall,
                'updated_at': completed_at,
            })

        except Exception as e:
            # Total failure — no charge
            await db_update('diagnoses', diagnosis_id, {
                'status': 'failed',
                'error': str(e),
                'completed_at': datetime.now(timezone.utc).isoformat(),
            })
            raise

        return await db_get('diagnoses', diagnosis_id)

    async def list_diagnoses(
        self,
        agency_id: str,
        client_id: Optional[str] = None,
        limit: int = 50,
    ) -> list:
        docs = await db_query(
            'diagnoses',
            filters=[('agency_id', '==', agency_id)],
            limit=limit,
        )
        if client_id:
            docs = [d for d in docs if d.get('client_id') == client_id]
        docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        return docs

    async def get(self, diagnosis_id: str, agency_id: str) -> Optional[dict]:
        doc = await db_get('diagnoses', diagnosis_id)
        if not doc or doc.get('agency_id') != agency_id:
            return None
        return doc
