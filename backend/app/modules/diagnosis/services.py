import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from google import genai

from app.config import settings
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.utils.credits import check_and_deduct
from app.shared.constants.plans import CREDIT_COSTS

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

- ai_awareness: 主要AI（ChatGPT/Claude/Gemini）がこのビジネスを正確に説明できる度合い。情報が公開・構造化されていない新興企業は20〜40、中規模企業は40〜60、広く認知された企業は60〜80、業界リーダーは80以上。
- brand_recognition: ブランド名・商号のAIへの浸透度。創業3年未満は30以下、地域密着型は30〜50、全国展開は50〜70、上場・著名企業は70以上。
- content_quality: WebサイトのAI読み取り適性（構造化データ・メタ情報・FAQ・明確な説明文）。URLのみで判断できない場合は業種標準値（50）を使用。
- competitor_gap: 同業他社と比較した優位性。業界平均と同水準なら50、優位なら50〜70、劣位なら50以下。
- overall: (ai_awareness + brand_recognition + content_quality + competitor_gap) / 4 の単純平均（小数点以下四捨五入）

スコアは事実ベースで算出し、楽観的・悲観的バイアスをかけないこと。\
"""

_JSON_TEMPLATE_SIMPLE = """

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
    {{
      "category": "カテゴリ名",
      "severity": "high|medium|low",
      "title": "問題タイトル",
      "description": "詳細説明（100字程度）"
    }}
  ],
  "recommendations": [
    "改善提案1（具体的なアクション）",
    "改善提案2",
    "改善提案3"
  ]
}}

findingsは3〜5件、recommendationsは3〜5件。"""

_JSON_TEMPLATE_DETAILED = """

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
    {{
      "category": "カテゴリ名",
      "severity": "high|medium|low",
      "title": "問題タイトル",
      "description": "詳細説明（200字以上）"
    }}
  ],
  "recommendations": [
    "改善提案1（具体的なアクション・優先度高）",
    "改善提案2",
    "改善提案3"
  ]
}}

findingsは8件以上（全カテゴリ網羅）、recommendationsは8件以上（優先度順）。各findingのdescriptionは200字以上で具体的に記述すること。"""

SIMPLE_PROMPT = _SCORE_SECTION + _JSON_TEMPLATE_SIMPLE
DETAILED_PROMPT = _SCORE_SECTION + _JSON_TEMPLATE_DETAILED


class DiagnosisService:
    async def run(
        self,
        client_id: str,
        agency_id: str,
        member_id: str,
        keyword_id: Optional[str],
        keywords: list[str],
        diagnosis_type: str,
    ) -> dict:
        client = await db_get('clients', client_id)
        if not client or client.get('agency_id') != agency_id:
            raise ValueError('Client not found')

        operation = 'simple_diagnosis' if diagnosis_type == 'simple' else 'detailed_diagnosis'
        credits_used = CREDIT_COSTS[operation]

        await check_and_deduct(member_id, operation)

        if keyword_id and not keywords:
            kw_doc = await db_get('keywords', keyword_id)
            if kw_doc and kw_doc.get('agency_id') == agency_id:
                keywords = [k.get('keyword', '') for k in kw_doc.get('keywords', [])[:10]]

        now = datetime.now(timezone.utc).isoformat()
        diagnosis_id = str(uuid.uuid4())

        await db_set('diagnoses', diagnosis_id, {
            'diagnosis_id': diagnosis_id,
            'client_id': client_id,
            'agency_id': agency_id,
            'member_id': member_id,
            'url': client.get('url', ''),
            'keywords': keywords,
            'type': diagnosis_type,
            'status': 'running',
            'scores': None,
            'findings': [],
            'recommendations': [],
            'credits_used': credits_used,
            'created_at': now,
            'completed_at': None,
        })

        try:
            result = await _run_gemini_diagnosis(
                name=client.get('name', ''),
                url=client.get('url', ''),
                industry=client.get('industry', ''),
                location=client.get('location', ''),
                keywords=keywords,
                diagnosis_type=diagnosis_type,
            )

            completed_at = datetime.now(timezone.utc).isoformat()
            update_data = {
                'scores': result['scores'],
                'findings': result['findings'],
                'recommendations': result['recommendations'],
                'status': 'completed',
                'completed_at': completed_at,
            }
            await db_set('diagnoses', diagnosis_id, {
                **await db_get('diagnoses', diagnosis_id),
                **update_data,
            })

            overall = result['scores'].get('overall', 0)
            await db_update('clients', client_id, {
                'latest_diagnosis_id': diagnosis_id,
                'latest_score': overall,
                'updated_at': completed_at,
            })

        except Exception as e:
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


async def _run_gemini_diagnosis(
    name: str,
    url: str,
    industry: str,
    location: str,
    keywords: list,
    diagnosis_type: str,
) -> dict:
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt_template = DETAILED_PROMPT if diagnosis_type == 'detailed' else SIMPLE_PROMPT
    prompt = prompt_template.format(
        name=name,
        url=url,
        industry=industry,
        location=location or '未指定',
        keywords='、'.join(keywords) if keywords else 'なし',
    )

    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=genai.types.GenerateContentConfig(temperature=0),
    )
    text = response.text.strip()

    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])

    parsed = json.loads(text)

    scores = parsed.get('scores', {})
    if 'overall' not in scores:
        vals = [v for v in scores.values() if isinstance(v, (int, float))]
        scores['overall'] = round(sum(vals) / len(vals), 1) if vals else 0

    return {
        'scores': scores,
        'findings': parsed.get('findings', []),
        'recommendations': parsed.get('recommendations', []),
    }
