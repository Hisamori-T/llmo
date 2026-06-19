from datetime import datetime
from typing import Optional, List
import json
from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import Diagnosis, User, DiagnosisStatusEnum
from core.config import settings

client = AsyncAnthropic(api_key=settings.claude_api_key)

DIAGNOSIS_PROMPT = """あなたはAI検索最適化（LLMO: LLM Optimization）の専門家です。
以下の企業情報を分析し、AIモデル（ChatGPT、Gemini、Claude等）がこの企業をどのように認識・評価しているかを診断してください。

企業名: {company_name}
業種: {industry}
所在地: {location}
キーワード: {keywords}

以下のJSON形式で回答してください（日本語）:
{{
  "scores": {{
    "ai_awareness": 0-100,
    "brand_recognition": 0-100,
    "content_quality": 0-100,
    "competitor_gap": 0-100
  }},
  "findings": [
    {{
      "category": "カテゴリ名",
      "severity": "high|medium|low",
      "title": "発見事項のタイトル",
      "description": "詳細説明"
    }}
  ],
  "recommendations": [
    "改善推奨事項1",
    "改善推奨事項2"
  ],
  "summary": "診断の総合まとめ（2-3文）"
}}

スコアの評価基準:
- ai_awareness: AIが企業名・サービスを認識できるか（高い = よく知られている）
- brand_recognition: ブランドの独自性・差別化（高い = 明確なポジショニング）
- content_quality: オンラインコンテンツの量と質（高い = 充実している）
- competitor_gap: 同業他社との比較（高い = 優位性がある）"""

class DiagnosisService:
    async def run_diagnosis(
        self,
        db: AsyncSession,
        diagnosis: Diagnosis,
        user: User,
    ) -> None:
        diagnosis.status = DiagnosisStatusEnum.running
        await db.commit()

        try:
            prompt = DIAGNOSIS_PROMPT.format(
                company_name=diagnosis.company_name,
                industry=diagnosis.industry,
                location=diagnosis.location or '未指定',
                keywords=', '.join(diagnosis.keywords or []) or 'なし',
            )

            message = await client.messages.create(
                model='claude-sonnet-4-6',
                max_tokens=2000,
                messages=[{'role': 'user', 'content': prompt}],
            )

            content = message.content[0].text
            diagnosis.raw_llm_response = content

            # JSON 抽出
            start = content.find('{')
            end = content.rfind('}') + 1
            result = json.loads(content[start:end])

            scores_raw = result.get('scores', {})
            diagnosis.scores = {
                'aiAwareness': scores_raw.get('ai_awareness', 50),
                'brandRecognition': scores_raw.get('brand_recognition', 50),
                'contentQuality': scores_raw.get('content_quality', 50),
                'competitorGap': scores_raw.get('competitor_gap', 50),
            }
            diagnosis.findings = result.get('findings', [])
            diagnosis.recommendations = result.get('recommendations', [])
            diagnosis.status = DiagnosisStatusEnum.completed
            diagnosis.completed_at = datetime.utcnow()

            # クレジット消費
            user.monthly_credits_used += diagnosis.credits_consumed

        except Exception as e:
            diagnosis.status = DiagnosisStatusEnum.failed
            diagnosis.raw_llm_response = str(e)

        await db.commit()
