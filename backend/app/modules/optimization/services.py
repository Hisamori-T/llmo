"""Optimization service — STEP2 実装最適化（JSON-LD / AI要約 / robots.txt / FAQ / WP preset）."""
import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.llm.orchestrator import ask_single
from app.shared.utils.credits import check_and_deduct
from app.shared.constants.plans import CREDIT_COSTS

# ── Prompts ──────────────────────────────────────────────────────────────────

_JSONLD_PROMPT = """\
あなたは schema.org と LLMO（LLM検索最適化）の専門家です。
以下のビジネス情報を基に、AIが認識・引用しやすい構造化データと会社紹介文を生成してください。

企業情報:
- 名称: {name}
- URL: {url}
- 業種: {industry}
- エリア: {location}

診断で判明した課題・改善方向:
{findings_text}

以下のJSON形式のみを返してください（コードブロック不要）:
{{
  "schema_type": "選択した schema.org 型名（LocalBusiness / ConstructionBusiness / Restaurant / MedicalBusiness / BeautySalon / LegalService / AccountingService / ProfessionalService / EducationalOrganization 等から業種に最適なもの）",
  "json_ld": {{
    "@context": "https://schema.org",
    "@type": "...",
    "name": "企業名",
    "url": "https://...",
    "description": "事業説明（2〜3文）",
    "address": {{
      "@type": "PostalAddress",
      "addressLocality": "市区町村",
      "addressRegion": "都道府県",
      "addressCountry": "JP"
    }},
    "areaServed": "対応エリア",
    "telephone": "",
    "openingHours": "（店舗系なら例: Mo-Fr 09:00-18:00）",
    "priceRange": "（店舗系なら例: ¥¥）"
  }},
  "ai_summary": "AIが直接引用できる会社紹介文（2〜3文。事業内容・所在地・サービス対象・強みを含む）"
}}
不要なキーは省略してよい。telephoneやopeningHoursが不明な場合は空文字のまま。"""

_FAQ_PROMPT = """\
あなたは LLMO（LLM検索最適化）と FAQPage 構造化データの専門家です。
以下のビジネスについて、ユーザーやAIが頻繁に尋ねる質問とその回答を生成してください。

企業情報:
- 名称: {name}
- 業種: {industry}
- エリア: {location}
- URL: {url}

以下のJSON形式のみを返してください（コードブロック不要）:
{{
  "faqs": [
    {{"question": "質問1", "answer": "回答1（AIが引用できる具体的な内容）"}},
    {{"question": "質問2", "answer": "回答2"}},
    ...
  ]
}}

8〜10件生成すること。回答は具体的・信頼性が高く、AIが直接引用できる文体で書くこと。
業種固有の質問（料金・営業時間・対応エリア・資格・実績など）を中心に構成すること。"""


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


# ── robots.txt template ──────────────────────────────────────────────────────

def _build_robots_txt(url: str) -> str:
    domain = url.replace('https://', '').replace('http://', '').split('/')[0]
    return f"""\
# robots.txt — LLMO 最適化推奨設定
# 生成日: {datetime.now().strftime('%Y-%m-%d')}

# 全クローラー（デフォルト許可）
User-agent: *
Allow: /

# OpenAI GPTBot
User-agent: GPTBot
Allow: /

# Anthropic Claude
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: ClaudeBot
Allow: /

# Google Gemini / Bard
User-agent: Google-Extended
Allow: /

# Perplexity AI
User-agent: PerplexityBot
Allow: /

# You.com
User-agent: YouBot
Allow: /

# Common Crawl（学習データ基盤）
User-agent: CCBot
Allow: /

# Meta AI
User-agent: FacebookBot
Allow: /

Sitemap: https://{domain}/sitemap.xml
"""


# ── WordPress preset ─────────────────────────────────────────────────────────

def _build_wp_preset(name: str, url: str, description: str, schema_type: str, json_ld: dict) -> dict:
    return {
        'yoast_seo': {
            'company_name': name,
            'company_url': url,
            'company_or_person': 'company',
            'description': description,
            'schema_page_type': 'WebPage',
            'schema_article_type': 'Article',
        },
        'schema_pro': {
            '@type': schema_type,
            'name': name,
            'url': url,
            'description': description,
            'address': json_ld.get('address', {}),
            'areaServed': json_ld.get('areaServed', ''),
            'telephone': json_ld.get('telephone', ''),
            'openingHours': json_ld.get('openingHours', ''),
        },
        'json_ld_raw': json_ld,
        'instructions': {
            'yoast': 'Yoast SEO → SEO → 組織情報 に入力してください',
            'schema_pro': 'Schema Pro → グローバルスキーマ → ビジネス情報 にインポートしてください',
            'manual': 'テーマの <head> タグ内に json_ld_raw を <script type="application/ld+json"> タグで貼り付けてください',
        },
    }


# ── Checklist builder ────────────────────────────────────────────────────────

def _build_checklist(
    json_ld: dict,
    faq_structure: list,
    ai_summary: str,
    findings: list,
) -> list:
    items = []

    items.append({
        'id': 'cl-001',
        'category': '構造化データ',
        'priority': 'high',
        'action': 'JSON-LDをheadタグに追加する',
        'description': '生成したJSON-LDスクリプトを<head>タグ内に<script type="application/ld+json">タグで貼り付けてください。',
        'status': 'pending',
    })

    if ai_summary:
        items.append({
            'id': 'cl-002',
            'category': 'コンテンツ',
            'priority': 'high',
            'action': 'AI向け会社紹介文をAboutページに掲載する',
            'description': '生成したAI要約文をWebサイトの会社概要ページに追加してください。',
            'status': 'pending',
        })

    if faq_structure:
        items.append({
            'id': 'cl-003',
            'category': 'FAQ',
            'priority': 'high',
            'action': f'FAQページを作成しFAQPage構造化データを追加する（{len(faq_structure)}件）',
            'description': '生成した質問回答をFAQページに掲載し、FAQPage JSON-LDをheadタグに追加してください。',
            'status': 'pending',
        })

    items.append({
        'id': 'cl-004',
        'category': 'クローラー設定',
        'priority': 'medium',
        'action': 'robots.txtを更新してAIクローラーを許可する',
        'description': '生成したrobots.txtでサイトのrobots.txtを更新し、主要AIクローラー（GPTBot, ClaudeBot等）のアクセスを許可してください。',
        'status': 'pending',
    })

    for i, finding in enumerate(findings[:5]):
        if isinstance(finding, dict) and finding.get('severity') == 'high':
            items.append({
                'id': f'cl-{100 + i:03d}',
                'category': finding.get('category', '改善'),
                'priority': 'high',
                'action': finding.get('title', ''),
                'description': (finding.get('description', '') or '')[:200],
                'status': 'pending',
            })

    return items


# ── Main generation ──────────────────────────────────────────────────────────

async def _generate_artifacts(client: dict, diagnosis: dict) -> dict:
    name = client.get('name', '')
    url = client.get('url', '')
    industry = client.get('industry', '')
    location = client.get('location', '')

    findings = diagnosis.get('findings', []) or []
    findings_text = '\n'.join(
        f'- [{f.get("severity", "")}] {f.get("title", "")}: {f.get("description", "")[:100]}'
        for f in findings[:5] if isinstance(f, dict)
    ) or '（診断結果なし）'

    jsonld_prompt = _JSONLD_PROMPT.format(
        name=name, url=url, industry=industry, location=location,
        findings_text=findings_text,
    )
    faq_prompt = _FAQ_PROMPT.format(
        name=name, url=url, industry=industry, location=location,
    )

    # Run both Gemini calls in parallel
    jsonld_resp, faq_resp = await asyncio.gather(
        ask_single(jsonld_prompt, model='gemini'),
        ask_single(faq_prompt, model='gemini'),
    )

    # Parse JSON-LD response
    jsonld_parsed = _extract_json(jsonld_resp.text) if jsonld_resp.ok else {}
    json_ld = jsonld_parsed.get('json_ld', {})
    schema_type = jsonld_parsed.get('schema_type', 'LocalBusiness')
    ai_summary = jsonld_parsed.get('ai_summary', '')

    # If JSON-LD is missing required fields, fill with client data
    if not json_ld.get('@type'):
        json_ld = {
            '@context': 'https://schema.org',
            '@type': schema_type,
            'name': name,
            'url': url,
            'description': ai_summary,
            'address': {
                '@type': 'PostalAddress',
                'addressLocality': location,
                'addressCountry': 'JP',
            },
        }

    # Parse FAQ response
    faq_parsed = _extract_json(faq_resp.text) if faq_resp.ok else {}
    faq_structure = faq_parsed.get('faqs', [])

    # Build FAQPage JSON-LD and embed into json_ld as mainEntity if FAQs exist
    if faq_structure:
        json_ld['mainEntity'] = [
            {
                '@type': 'Question',
                'name': item.get('question', ''),
                'acceptedAnswer': {'@type': 'Answer', 'text': item.get('answer', '')},
            }
            for item in faq_structure
        ]

    robots_txt = _build_robots_txt(url)
    wp_preset = _build_wp_preset(name, url, ai_summary, schema_type, json_ld)
    checklist = _build_checklist(
        json_ld=json_ld,
        faq_structure=faq_structure,
        ai_summary=ai_summary,
        findings=diagnosis.get('findings', []) or [],
    )

    return {
        'json_ld': json_ld,
        'ai_summary': ai_summary,
        'robots_txt': robots_txt,
        'faq_structure': faq_structure,
        'wp_preset': wp_preset,
        'checklist': checklist,
    }


# ── Service class ─────────────────────────────────────────────────────────────

class OptimizationService:
    async def create(
        self,
        diagnosis_id: str,
        agency_id: str,
        member_id: str,
    ) -> dict:
        diagnosis = await db_get('diagnoses', diagnosis_id)
        if not diagnosis or diagnosis.get('agency_id') != agency_id:
            raise ValueError('Diagnosis not found')
        if diagnosis.get('status') != 'completed':
            raise ValueError('Diagnosis is not completed yet')

        client_id = diagnosis.get('client_id', '')
        client = await db_get('clients', client_id)
        if not client:
            raise ValueError('Client not found')

        await check_and_deduct(member_id, 'optimization')

        now = datetime.now(timezone.utc).isoformat()
        optimization_id = str(uuid.uuid4())

        await db_set('optimizations', optimization_id, {
            'optimization_id': optimization_id,
            'diagnosis_id': diagnosis_id,
            'client_id': client_id,
            'agency_id': agency_id,
            'member_id': member_id,
            'status': 'running',
            'json_ld': None,
            'ai_summary': None,
            'robots_txt': None,
            'faq_structure': None,
            'wp_preset': None,
            'checklist': None,
            'credits_used': CREDIT_COSTS['optimization'],
            'created_at': now,
            'completed_at': None,
            'error': None,
        })

        try:
            artifacts = await _generate_artifacts(client, diagnosis)
            completed_at = datetime.now(timezone.utc).isoformat()
            await db_update('optimizations', optimization_id, {
                **artifacts,
                'status': 'completed',
                'completed_at': completed_at,
            })
        except Exception as e:
            await db_update('optimizations', optimization_id, {
                'status': 'failed',
                'error': str(e),
                'completed_at': datetime.now(timezone.utc).isoformat(),
            })
            raise

        return await db_get('optimizations', optimization_id)

    async def list_optimizations(
        self,
        agency_id: str,
        client_id: Optional[str] = None,
        limit: int = 50,
    ) -> list:
        docs = await db_query(
            'optimizations',
            filters=[('agency_id', '==', agency_id)],
            limit=limit,
        )
        if client_id:
            docs = [d for d in docs if d.get('client_id') == client_id]
        docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
        return docs

    async def get(self, optimization_id: str, agency_id: str) -> Optional[dict]:
        doc = await db_get('optimizations', optimization_id)
        if not doc or doc.get('agency_id') != agency_id:
            return None
        return doc
