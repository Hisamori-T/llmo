# LLMO Score - VSCode 実装ガイド（Gemini API版）

**プロジェクト名**: LLMO Score  
**開発期間**: 4週間  
**仕様書**: LLMO-Score-FINAL-SPEC.md をベースに実装

---

## 🎯 VSCode Claude への実装指示

以下をコピーして VSCode Claude に実行してください：

```
【LLMO Score 実装プロジェクト】

以下の仕様書に基づいて、4週間で SaaS 月額課金アプリケーションを実装してください。

【プロジェクト名】
LLMO Score

【仕様書】
LLMO-Score-FINAL-SPEC.md

【主な特徴】
- 企業の AI 検索での見え方を診断する SaaS
- ブラウザベースのダッシュボード
- 月額課金（Stripe）
- Gemini API で診断実行
- セッション管理：同一アカウント = 同時に 1 ブラウザのみ

【実装対象】

【Phase 1: 基盤構築（Week 1-2）】

1. フロント基盤（Next.js 14）
   □ App Router 設定
   □ Tailwind CSS + shadcn/ui セットアップ
   □ Firebase Auth 統合
   □ Vercel デプロイ設定
   
   フォルダ構成:
   ```
   frontend/
   ├── app/
   │   ├── page.tsx (LP トップ)
   │   ├── auth/
   │   │   ├── login/page.tsx
   │   │   ├── signup/page.tsx
   │   │   └── reset-password/page.tsx
   │   └── dashboard/
   │       ├── page.tsx (Home/KPI)
   │       ├── diagnoses/page.tsx
   │       ├── reports/[id]/page.tsx
   │       ├── billing/page.tsx
   │       └── settings/page.tsx
   ├── components/
   │   ├── LoginForm.tsx
   │   ├── DiagnosisForm.tsx
   │   └── MultipleConnectionWarning.tsx
   ├── lib/
   │   ├── api.ts
   │   ├── auth.ts
   │   └── types.ts
   └── middleware.ts
   ```

2. バック基盤（FastAPI）
   □ FastAPI プロジェクト初期化
   □ Firestore SDK 統合
   □ Gemini API SDK 統合（google-generativeai）
   □ Stripe SDK 統合
   □ Docker 化
   
   フォルダ構成:
   ```
   backend/
   ├── main.py
   ├── requirements.txt
   ├── Dockerfile
   ├── routers/
   │   ├── auth.py
   │   ├── diagnoses.py
   │   ├── reports.py
   │   └── billing.py
   ├── services/
   │   ├── auth_service.py
   │   ├── diagnosis_service.py (← Gemini API)
   │   └── billing_service.py
   └── models/
       ├── schemas.py
       └── firestore_models.py
   ```

3. Firestore 初期化
   □ Collections 作成：users, sessions, organizations, diagnoses, reports, subscriptions
   □ Security Rules 設定
   □ インデックス作成

【Phase 2: 認証・セッション管理（Week 2-3）】

1. Firebase Auth ログインフロー
   □ ログイン画面（メール + パスワード）
   □ 新規登録画面
   □ パスワードリセット
   □ メール確認

2. セッション管理（複数接続制御）
   □ device_id 計算（User-Agent + OS）
   □ browser_id 計算（device_id + User-Agent）
   □ 複数接続警告画面（デバイス別 + ブラウザ別）
     - 「別デバイスでログインしています」
     - 「別ブラウザでログインしています」
   □ セッション revoke ロジック
   □ 同一ブラウザの複数タブはセッション共有

3. Token 管理
   □ JWT Token（1時間有効）
   □ Refresh Token（30日有効）
   □ 自動リフレッシュロジック
   □ HttpOnly Cookie

4. Stripe 統合
   □ Stripe Checkout セッション作成
   □ プラン選択（Starter/Pro/Enterprise）
   □ クレジットカード登録
   □ Webhook 処理（payment_intent.succeeded）
   □ 自動サブスク課金

【Phase 3: 診断機能実装（Week 3-4）】

1. Gemini API 統合
   □ Gemini SDK インストール（google-generativeai）
   □ API キー設定
   □ プロンプト設計（JSON 出力形式）
   □ エラーハンドリング（レート制限対策）
   
   実装内容:
   ```python
   # services/diagnosis_service.py
   import google.generativeai as genai
   
   class DiagnosisService:
       def __init__(self):
           genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
           self.model = genai.GenerativeModel('gemini-pro')
       
       async def run_diagnosis(self, company_name, industry, location, keywords):
           # Gemini に診断プロンプト送信
           # JSON レスポンスをパース
           # スコア計算
           # Firestore に保存
   ```

2. 診断エンドポイント
   □ POST /diagnoses（診断実行 + Gemini）
   □ GET /diagnoses（一覧取得）
   □ GET /diagnoses/{id}（詳細取得）
   □ クレジット消費記録

3. レポート生成
   □ 簡易レポート（自動生成、PDF）
   □ 詳細レポート（Stripe決済後、16ページ）
   □ PDF 生成（reportlab or WeasyPrint）
   □ Cloud Storage に保存

【Phase 4: ダッシュボード完成（Week 4）】

1. Dashboard UI
   □ Home（KPI Cards 表示）
     - 今月の診断数
     - 詳細レポート残数
     - Phase 3 運用数
     - 次の請求日
   
   □ Diagnoses（診断管理）
     - 診断フォーム
     - 実行中の進捗表示
     - 結果一覧
   
   □ Reports（レポート表示）
     - 簡易レポート表示
     - 詳細レポート購入フロー
     - PDF ダウンロード
     - 共有リンク生成
   
   □ Billing（請求・プラン管理）
     - 現在のプラン表示
     - 請求履歴テーブル
     - クレジットカード管理
     - 年払い変更オプション
   
   □ Settings（ユーザー管理・セキュリティ）
     - プロフィール編集
     - チーム管理（メンバー招待・削除）
     - Active Sessions 表示
     - パスワード変更

2. Responsive Design
   □ PC（1920px+）
   □ タブレット（768-1024px）
   □ スマートフォン（320-767px）

3. LP（SEO対応）
   □ トップページ
   □ 料金ページ（3段階プラン）
   □ 機能ページ
   □ ブログ（SEO記事）
   □ robots.txt（LP のみ対象）

4. セキュリティ・テスト
   □ セッション管理テスト（複数接続制御）
   □ JWT Token テスト
   □ CORS テスト
   □ SQL インジェクション対策
   □ XSS 対策
   □ エラーハンドリング

5. デプロイ
   □ Vercel にデプロイ（llmoscore.com, app.llmoscore.com）
   □ Cloud Run にデプロイ（api.llmoscore.com）
   □ 環境変数設定（Vercel + Cloud Run）
   □ DNS 設定確認
   □ SSL 証明書確認
   □ 本番環境テスト

【重要な仕様】

セッション管理:
  - 同一アカウント = 同時に 1 ブラウザのみ
  - 複数接続検出時に警告表示 + ユーザー選択
  - 新規ログイン時に旧セッション自動 revoke
  - 同一ブラウザ複数タブはセッション共有

課金体系:
  - 基本月額（Starter 5k / Pro 15k / Enterprise 50k）
  - 追加アカウント（Pro +2k/名 / Enterprise +1k/名）
  - API クレジット（超過時 +1k/100クレジット）
  - Phase3 運用（追加実行 +2k/回 or +1k/回）
  - 年払い 10% 割引

API 統合:
  - Gemini API（診断実行）
  - Stripe API（課金・サブスク）
  - SendGrid（メール）
  - Firebase Auth（認証）

【環境変数】

.env ファイルに以下を設定:

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Firebase
FIREBASE_PROJECT_ID=llmo-score
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Stripe
STRIPE_API_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
JWT_SECRET=your-secret-key
DATABASE_URL=firestore

【成功基準】

✅ ブラウザで動作する完全な SaaS
✅ セッション管理（複数接続制御）が正確に動作
✅ Gemini API で診断実行 + JSON パース
✅ Stripe サブスク決済が完全に統合
✅ PDF レポート自動生成
✅ モバイル対応（レスポンシブ）
✅ 本番環境デプロイ可能
✅ 複数ユーザーでの同時接続制御テスト完了

【開始】

上記の仕様に基づいて実装を開始してください。
不明な点があれば、LLMO-Score-FINAL-SPEC.md を参照してください。
```

---

## 🛠️ 実装の詳細コード例

### Gemini API 統合（重要）

```python
# services/diagnosis_service.py

import google.generativeai as genai
import json
import re
import os
from typing import Dict, Any
from firebase_admin import firestore

class DiagnosisService:
    def __init__(self):
        # Gemini API 初期化
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
        Gemini API を使用して診断を実行
        """
        
        # プロンプト設計（JSON 出力を強制）
        prompt = f"""
あなたは AI 検索最適化（LLMO: Large Language Model Optimization）の専門家です。
以下の企業情報に基づいて、AI 検索エンジン（Google Gemini, ChatGPT, Claude）での認知度を診断してください。

【企業情報】
企業名: {company_name}
業種: {industry}
所在地: {location}
主要キーワード: {', '.join(keywords)}

【診断内容】
1. AI 認知度スコア（0-100）
2. 競合ランキングスコア（0-100）
3. 地域検索対応度（0-100）
4. 成長ポテンシャル（0-100）
5. 現在の強み・弱み・機会
6. 改善施策 TOP 5（優先度順）
7. 6ヶ月・12ヶ月後の改善予測

【出力形式】
必ず以下の JSON 形式で出力すること:

{{
    "scores": {{
        "ai_awareness": <0-100の整数>,
        "competitive_ranking": <0-100の整数>,
        "geo_search": <0-100の整数>,
        "growth_potential": <0-100の整数>
    }},
    "findings": {{
        "strengths": ["<強み1>", "<強み2>", "<強み3>"],
        "weaknesses": ["<弱み1>", "<弱み2>", "<弱み3>"],
        "opportunities": ["<機会1>", "<機会2>"]
    }},
    "recommendations": [
        {{
            "priority": 1,
            "action": "<具体的な施策>",
            "impact": "<期待される効果>",
            "timeline": "<実施期間>"
        }},
        {{
            "priority": 2,
            "action": "<具体的な施策>",
            "impact": "<期待される効果>",
            "timeline": "<実施期間>"
        }},
        {{
            "priority": 3,
            "action": "<具体的な施策>",
            "impact": "<期待される効果>",
            "timeline": "<実施期間>"
        }},
        {{
            "priority": 4,
            "action": "<具体的な施策>",
            "impact": "<期待される効果>",
            "timeline": "<実施期間>"
        }},
        {{
            "priority": 5,
            "action": "<具体的な施策>",
            "impact": "<期待される効果>",
            "timeline": "<実施期間>"
        }}
    ],
    "six_month_projection": <0-100の整数>,
    "twelve_month_projection": <0-100の整数>
}}
"""
        
        try:
            # Gemini に送信
            response = self.model.generate_content(prompt)
            
            # JSON をパース
            json_text = response.text
            
            # マークダウン形式の JSON を抽出
            json_match = re.search(r'\{[\s\S]*\}', json_text)
            
            if not json_match:
                raise ValueError("Gemini response does not contain JSON")
            
            # JSON をパース
            diagnosis_data = json.loads(json_match.group())
            
            # バリデーション
            self._validate_diagnosis_data(diagnosis_data)
            
            return diagnosis_data
        
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            raise ValueError("Failed to parse Gemini response as JSON")
        except Exception as e:
            print(f"Gemini API error: {e}")
            raise
    
    def _validate_diagnosis_data(self, data: Dict) -> None:
        """診断データの検証"""
        required_fields = ["scores", "findings", "recommendations"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
        
        # スコアの検証
        for score_key in ["ai_awareness", "competitive_ranking", "geo_search"]:
            if score_key not in data["scores"]:
                raise ValueError(f"Missing score: {score_key}")
            
            score_value = data["scores"][score_key]
            if not isinstance(score_value, int) or not (0 <= score_value <= 100):
                raise ValueError(f"Invalid score value: {score_key} = {score_value}")
    
    async def save_diagnosis(
        self,
        user_id: str,
        company_name: str,
        diagnosis_data: Dict,
    ) -> str:
        """診断結果を Firestore に保存"""
        
        import uuid
        from datetime import datetime
        
        diagnosis_id = str(uuid.uuid4())
        
        diagnosis_doc = {
            "diagnosis_id": diagnosis_id,
            "user_id": user_id,
            "company_name": company_name,
            "scores": diagnosis_data["scores"],
            "findings": diagnosis_data["findings"],
            "recommendations": diagnosis_data["recommendations"],
            "six_month_projection": diagnosis_data["six_month_projection"],
            "twelve_month_projection": diagnosis_data["twelve_month_projection"],
            "created_at": datetime.utcnow(),
            "status": "completed",
        }
        
        # Firestore に保存
        self.db.collection("diagnoses").document(diagnosis_id).set(diagnosis_doc)
        
        return diagnosis_id
```

### 診断エンドポイント（FastAPI）

```python
# routers/diagnoses.py

from fastapi import APIRouter, HTTPException, Depends
from services.diagnosis_service import DiagnosisService
from models.schemas import DiagnosisRequest
from services.auth_service import get_current_user
import os

router = APIRouter()
diagnosis_service = DiagnosisService()

@router.post("/")
async def create_diagnosis(
    req: DiagnosisRequest,
    current_user = Depends(get_current_user),
):
    """
    新規診断を実行
    - Gemini API で分析
    - クレジット消費
    - 結果を Firestore に保存
    """
    
    try:
        # クレジット残高確認
        user_plan = await get_user_plan(current_user["uid"])
        
        # 診断: 5-8 クレジット消費（Gemini 版）
        credit_cost = 5  # 最小コスト
        
        if user_plan["monthly_credit_used"] + credit_cost > user_plan["monthly_credit_limit"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "credit_limit_exceeded",
                    "message": "月額クレジット制限を超過しました"
                }
            )
        
        # Gemini で診断実行
        diagnosis = await diagnosis_service.run_diagnosis(
            company_name=req.company_name,
            industry=req.industry,
            location=req.location,
            keywords=req.keywords or [],
        )
        
        # 診断結果を Firestore に保存
        diagnosis_id = await diagnosis_service.save_diagnosis(
            user_id=current_user["uid"],
            company_name=req.company_name,
            diagnosis_data=diagnosis,
        )
        
        # クレジット消費を記録
        await record_credit_usage(
            user_id=current_user["uid"],
            amount=credit_cost,
            usage_type="diagnosis",
            diagnosis_id=diagnosis_id,
        )
        
        return {
            "status": "success",
            "diagnosis_id": diagnosis_id,
            "scores": diagnosis["scores"],
            "findings": diagnosis["findings"],
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in create_diagnosis: {e}")
        raise HTTPException(status_code=500, detail="診断実行中にエラーが発生しました")
```

---

## 📋 環境変数チェックリスト

以下の環境変数を設定してください:

### Vercel（Frontend）

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=llmo-score
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_API_BASE=https://api.llmoscore.com
```

### Cloud Run（Backend）

```
FIREBASE_PROJECT_ID=llmo-score
FIREBASE_PRIVATE_KEY=...（service account JSON）
FIREBASE_CLIENT_EMAIL=...
GEMINI_API_KEY=your-gemini-api-key
STRIPE_API_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-jwt-secret
```

---

## ✅ 最終デプロイチェック

```
□ Vercel にデプロイ
  □ llmoscore.com に接続
  □ app.llmoscore.com に接続
  □ 環境変数設定完了
  □ SSL 証明書確認

□ Cloud Run にデプロイ
  □ api.llmoscore.com に接続
  □ 環境変数設定完了（Gemini キー含む）
  □ Gemini API 有効化
  □ SSL 証明書確認

□ Firestore
  □ Collections 作成
  □ Security Rules 設定
  □ インデックス作成

□ Stripe
  □ ビジネスアカウント設定
  □ 商品・価格設定
  □ Webhook エンドポイント設定

□ 本番環境テスト
  □ ログイン〜診断〜課金の全フロー
  □ セッション制御テスト（複数接続）
  □ Gemini API レスポンス確認
  □ PDF 生成確認
```

---

**LLMO Score の実装を開始してください！** 🚀

