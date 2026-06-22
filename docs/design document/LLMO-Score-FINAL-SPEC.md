# LLMO Score - 最終実装仕様書

**プロジェクト名**: LLMO Score  
**バージョン**: FINAL  
**作成日**: 2026-04-10  
**AI API**: Google Gemini（Claude → Gemini に変更）

---

## 🎯 プロジェクト概要

### ビジネス要件

```
【ビジネスモデル】
SaaS 月額課金制
├─ ランディングページ（SEO対象）
└─ 認証後のダッシュボード（検索エンジン排除）

【プロダクト】
LLMO Score
企業のAI検索での見えかた（AIに認識されているか）を診断するSaaSアプリ

【顧客層】
中小企業・店舗（直接顧客）
月額 5,000〜50,000円の課金

【収益モデル】
基本月額 + 追加アカウント + API クレジット + Phase 3 運用
年払い 10% 割引
```

### 技術スタック（Gemini 版）

```
【Frontend】
- Next.js 14（App Router）
- Vercel Hosting（llmoscore.com, app.llmoscore.com）
- Tailwind CSS + shadcn/ui
- Firebase Auth
- Stripe.js

【Backend】
- FastAPI（Python 3.11）
- Google Cloud Run（api.llmoscore.com）
- Firestore
- Cloud Storage
- Firebase Admin SDK

【External APIs】
- Google Gemini API（診断ロジック）← Claude → Gemini に変更
- Stripe API（課金）
- SendGrid（メール）

【Infrastructure】
- Vercel（Frontend）
- Google Cloud Run（Backend）
- Firestore（Database）
- Firebase Auth
```

---

## 🔄 Gemini API 統合仕様

### Gemini API の利用方法

```python
# services/diagnosis_service.py - Gemini 統合
import google.generativeai as genai
from typing import Dict, Any

class DiagnosisService:
    def __init__(self):
        # Gemini API キー設定
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel('gemini-pro')
        self.db = firestore.client()

    async def run_diagnosis(
        self,
        company_name: str,
        industry: str,
        location: str,
        keywords: list,
    ) -> Dict[str, Any]:
        """
        Gemini を使用して企業の AI 認知度を診断
        """
        
        # プロンプト設計
        prompt = f"""
        以下の企業情報に基づいて、AI検索エンジン（Google Gemini, ChatGPT, Claude）での認知度を診断してください。
        
        【企業情報】
        企業名: {company_name}
        業種: {industry}
        所在地: {location}
        主要キーワード: {', '.join(keywords)}
        
        【タスク】
        1. 企業名 + 業種 + 地域で検索した時、AI が企業を認識する確度を 0-100 で評価
        2. 現在の状況（強み・弱み）を分析
        3. 改善ポイント TOP 5 を提案
        4. 6ヶ月・12ヶ月後の改善予測
        
        【出力形式】
        JSON 形式で以下のフィールドを含める:
        {{
            "scores": {{
                "ai_awareness": <0-100の数値>,
                "competitive_ranking": <0-100の数値>,
                "geo_search": <0-100の数値>,
                "growth_potential": <0-100の数値>
            }},
            "findings": {{
                "strengths": [<強み1>, <強み2>, ...],
                "weaknesses": [<弱み1>, <弱み2>, ...],
                "opportunities": [<機会1>, <機会2>, ...]
            }},
            "recommendations": [
                {{
                    "priority": 1,
                    "action": "<施策>",
                    "impact": "<期待効果>",
                    "timeline": "<実施期間>"
                }},
                ...
            ],
            "six_month_projection": <0-100の数値>,
            "twelve_month_projection": <0-100の数値>
        }}
        """
        
        try:
            # Gemini に診断リクエスト
            response = self.model.generate_content(prompt)
            
            # JSON レスポンスをパース
            import json
            import re
            
            # マークダウン形式の JSON をパース
            json_text = response.text
            json_match = re.search(r'\{[\s\S]*\}', json_text)
            
            if json_match:
                diagnosis_data = json.loads(json_match.group())
            else:
                raise ValueError("Invalid Gemini response format")
            
            return diagnosis_data
            
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            raise

    async def generate_detailed_report(
        self,
        diagnosis_data: Dict,
        company_info: Dict,
    ) -> Dict[str, Any]:
        """
        詳細レポート用の追加分析（Gemini）
        """
        
        prompt = f"""
        以下の診断結果に基づいて、詳細な改善ロードマップを作成してください。
        
        【診断結果】
        {json.dumps(diagnosis_data, ensure_ascii=False, indent=2)}
        
        【企業情報】
        {json.dumps(company_info, ensure_ascii=False, indent=2)}
        
        【出力内容】
        1. 競合比較分析（同業界の競合企業との比較）
        2. 実装テンプレート（Schema.org, robots.txt, コンテンツ例）
        3. Phase 3 運用方針（月次改善内容）
        
        JSON 形式で出力してください。
        """
        
        try:
            response = self.model.generate_content(prompt)
            import json
            import re
            
            json_text = response.text
            json_match = re.search(r'\{[\s\S]*\}', json_text)
            
            if json_match:
                detailed_data = json.loads(json_match.group())
            else:
                raise ValueError("Invalid Gemini response format")
            
            return detailed_data
            
        except Exception as e:
            print(f"Error generating detailed report: {e}")
            raise
```

### Gemini API の料金

```
Google Gemini API（2026年現在）:

無料枠:
  - 月50回の API コール無料
  - 1分あたり9リクエスト

有料:
  - $0.000075 / 入力トークン（1,000個単位）
  - $0.000375 / 出力トークン（1,000個単位）

予想費用（月間100診断の場合）:
  約 $2-5/月 で十分
  
推奨: 
  API クレジット 10クレジット/診断 の価格設定で、
  Gemini コスト < 1,000円/月
  → あなたの利益 > 99,000円/月（クレジット売上）
```

### 環境変数設定

```
.env ファイルに追加:

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# 既存の環境変数
FIREBASE_PROJECT_ID=...
STRIPE_API_KEY=...
JWT_SECRET=...
```

---

## 📋 実装時の変更点（Claude → Gemini）

### 1. バックエンド変更

```python
# requirements.txt に追加
google-generativeai==0.3.0  # Gemini SDK

# services/diagnosis_service.py
# 上記の Gemini 統合コード参照
```

### 2. API クレジット計算

```
従来（Claude API）:
  診断1件: 10 クレジット
  詳細レポート: 20 クレジット
  Phase3月次: 10 クレジット

Gemini（より安価）:
  診断1件: 5-8 クレジット ← 調整可能
  詳細レポート: 15 クレジット ← 調整可能
  Phase3月次: 5 クレジット ← 調整可能
```

**実際の Gemini コストが低いため、ユーザーに還元するか、
あなたの利益を増やすか選択可能。**

### 3. プロンプト工夫（Gemini 対応）

Gemini は Claude より：
- **短時間でレスポンス**（高速）
- **JSON 形式の出力が得意**
- **日本語の品質が良い**

デメリット：
- 長文プロンプトは若干精度低下の可能性

対策：
```python
# プロンプトを簡潔にして、JSON スキーマを明示
prompt = f"""
企業「{company_name}」のAI認知度を診断。

出力は以下の JSON スキーマに従うこと:
{{
  "scores": {{"ai_awareness": <0-100>}},
  "findings": {{"strengths": [...]}},
  "recommendations": [...]
}}
"""
```

---

## 💰 料金設定（Gemini 導入後）

### クレジット再設計案

```
【Gemini が安い = ユーザー価格下げ or 利益アップ】

案1: ユーザー価格そのままで利益アップ
  API クレジット価格を維持
  → あなたの利益が増加（Gemini が安いため）
  
案2: ユーザー価格を下げて差別化
  Starter: 月5,000円 → 月3,000円
  Pro: 月15,000円 → 月10,000円
  → 競合優位性向上

案3: ハイブリッド
  基本月額は維持
  API クレジット追加購入を割安に
  → クレジット消費を促す
```

**推奨: 案1（価格維持、利益アップ）で当面進める**

---

## 🛠️ 実装フロー（Gemini 版）

### Backend 実装（Week 1-2）

```python
# main.py で FastAPI 起動
# routers/diagnoses.py でエンドポイント定義
# services/diagnosis_service.py で Gemini 統合

# 実装ステップ:
# 1. Gemini SDK インストール
# 2. 認証キー設定
# 3. プロンプト設計 + テスト
# 4. JSON パース処理
# 5. エラーハンドリング
```

### テスト（Week 3）

```bash
# Gemini API テスト
python -c "
import google.generativeai as genai
genai.configure(api_key='your-key')
model = genai.GenerativeModel('gemini-pro')
response = model.generate_content('Test prompt')
print(response.text)
"

# 診断エンドポイント テスト
curl -X POST http://localhost:8000/diagnoses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "company_name": "テスト企業",
    "industry": "建設",
    "location": "福井県",
    "keywords": ["木造住宅", "新築"]
  }'
```

---

## ✅ 最終チェックリスト（Gemini 版）

### Backend

```
□ Gemini API SDK インストール
□ 環境変数設定（GEMINI_API_KEY）
□ 診断エンドポイント実装
□ JSON パース処理
□ エラーハンドリング（Gemini レート制限対策）
□ 詳細レポート生成ロジック
□ クレジット消費ロジック
□ ログ記録
```

### Frontend（変更なし）

```
□ 診断フォーム
□ 結果表示（簡易 + 詳細）
□ レポート配信
□ 全体フロー変更なし
```

### Infrastructure

```
□ Cloud Run デプロイ
□ 環境変数設定（Vercel + Cloud Run）
□ Gemini API 有効化（GCP Console）
□ 本番環境テスト
```

---

## 🚀 デプロイ手順（Gemini 版）

### Cloud Run デプロイ（Gemini キー含む）

```bash
gcloud run deploy llmo-score-api \
  --image gcr.io/PROJECT_ID/llmo-score-api:latest \
  --region us-central1 \
  --set-env-vars \
    FIREBASE_PROJECT_ID=llmo-score,\
    GEMINI_API_KEY=sk-...,\
    STRIPE_API_KEY=sk_...,\
    JWT_SECRET=...

# Gemini API 有効化（初回のみ）
gcloud services enable generativeai.googleapis.com
```

---

## 📊 Gemini 使用料試算

```
月間 1,000 診断実行の場合:

入力トークン:
  約 200 tokens/プロンプト × 1,000 = 200,000 tokens
  コスト: 200,000 × $0.000075 / 1,000 = $0.015

出力トークン:
  約 500 tokens/レスポンス × 1,000 = 500,000 tokens
  コスト: 500,000 × $0.000375 / 1,000 = $0.1875

月間合計: 約 $0.20 = 約 30円

→ 月間診断1,000件でも Gemini コストは 30円程度！
→ クレジット売上（5-8クレジット × 100円）= 50,000-80,000円
→ あなたの利益: 約 50,000円/月（API コストほぼゼロ）
```

---

## 🎯 最後の確認

以下について確認をお願いします:

1. **Gemini API キー取得済み？**
   - Google Cloud Console から取得して .env に設定

2. **クレジット価格は維持？**
   - API クレジット追加購入: 100クレジット = 1,000円（現在のまま）

3. **ドメイン変更は完了？**
   - llmoscore.com に変更済み？
   - DNS 設定済み？

4. **その他変更予定は？**
   - ブランドロゴ変更？
   - LP テキスト変更？

これらが確認できたら、**LLMO Score の最終実装ガイド** を更新します！🚀

