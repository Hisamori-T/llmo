# VSCode Claude への最終実装指示書

**プロジェクト**: AI認知度診断SaaS（LLMO診断）  
**開発期間**: 4週間  
**目標**: ブラウザベースのSaaS月額課金アプリケーション  
**仕様書**: FINAL-IMPLEMENTATION-SPEC.md をベースに実装

---

## 🎯 プロジェクト概要

### ビジネス要件

```
【ビジネスモデル】
SaaS 月額課金制
├─ ランディングページ（SEO対象）
└─ 認証後のダッシュボード（検索エンジン排除）

【プロダクト】
企業のAI検索での見えかた（AIに認識されているか）を診断するSaaSアプリ

【顧客層】
中小企業・店舗（直接顧客）
月額 5,000〜50,000円の課金

【収益モデ】
基本月額 + 追加アカウント + API クレジット + Phase 3 運用
年払い 10% 割引
```

### 技術スタック（確定）

```
【Frontend】
- Next.js 14（App Router）
- Vercel Hosting
- Tailwind CSS + shadcn/ui
- Firebase Auth
- Stripe.js

【Backend】
- FastAPI（Python 3.11）
- Google Cloud Run
- Firestore
- Cloud Storage
- Firebase Admin SDK

【External APIs】
- Claude API（診断ロジック）
- Stripe API（課金）
- SendGrid（メール）

【Infrastructure】
- Vercel（llmo-saas.com, app.llmo-saas.com）
- Google Cloud Run（api.llmo-saas.com）
- Firestore
- Firebase Auth
```

---

## 📋 実装フェーズ

### Phase 1: 基盤構築（Week 1-2）

#### 1.1 フロント基盤セットアップ

```bash
# プロジェクト立ち上げ
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend

# 必要なパッケージをインストール
npm install @stripe/react-stripe-js @stripe/js
npm install firebase
npm install react-hot-toast axios
npm install shadcn-ui  # コンポーネントライブラリ
```

**フォルダ構成:**
```
frontend/
├── app/
│   ├── layout.tsx (共通レイアウト)
│   ├── page.tsx (LP トップ)
│   ├── auth/
│   │   ├── signup/page.tsx
│   │   ├── login/page.tsx
│   │   └── reset-password/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx (Home)
│   │   ├── diagnoses/
│   │   │   ├── page.tsx (一覧)
│   │   │   └── [id]/page.tsx (詳細)
│   │   ├── reports/
│   │   │   └── [id]/page.tsx
│   │   ├── billing/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth].ts
│   │   └── diagnoses.ts
│   └── middleware.ts (認証保護)
├── components/
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   ├── LoginForm.tsx
│   ├── DiagnosisForm.tsx
│   └── ...etc
├── lib/
│   ├── api.ts (API 呼び出し)
│   ├── auth.ts (認証ロジック)
│   ├── types.ts (TypeScript 型定義)
│   └── utils.ts (ヘルパー関数)
├── styles/
│   └── globals.css
└── public/
    └── assets/ (画像等)
```

**実装内容:**

```typescript
// lib/auth.ts - Firebase Auth 統合
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// lib/api.ts - API 呼び出し
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.llmo-saas.com';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエスト前に JWT token を追加
apiClient.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// middleware.ts - 認証保護
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // LP・認証ページは公開
  if (pathname === '/' || pathname.startsWith('/auth')) {
    return NextResponse.next();
  }
  
  // /dashboard 以下は認証必須
  const token = request.cookies.get('auth_token');
  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
```

**Vercel へのデプロイ設定:**

```
Vercel CLI でログイン
vercel login

フロントエンドをデプロイ（本番前）
vercel --env-file .env.local

環境変数設定（Vercel Dashboard）
- NEXT_PUBLIC_API_BASE=https://api.llmo-saas.com
- NEXT_PUBLIC_FIREBASE_*
```

---

#### 1.2 バック基盤セットアップ

```bash
# Python プロジェクト立ち上げ
mkdir backend
cd backend

# 仮想環境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# FastAPI インストール
pip install fastapi uvicorn
pip install firebase-admin
pip install python-dotenv
pip install pydantic
pip install httpx  # async HTTP client
```

**フォルダ構成:**
```
backend/
├── main.py (アプリケーション起点)
├── requirements.txt
├── .env
├── .dockerignore
├── Dockerfile
├── routers/
│   ├── auth.py
│   ├── diagnoses.py
│   ├── reports.py
│   ├── billing.py
│   └── users.py
├── services/
│   ├── auth_service.py
│   ├── diagnosis_service.py
│   ├── llm_service.py (Claude API)
│   └── billing_service.py (Stripe)
├── models/
│   ├── schemas.py (Pydantic スキーマ)
│   ├── firestore_models.py
│   └── enums.py
├── middleware/
│   ├── auth_middleware.py
│   └── cors_middleware.py
└── utils/
    ├── jwt_utils.py
    ├── validators.py
    └── helpers.py
```

**実装内容:**

```python
# main.py - FastAPI 起点
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from routers import auth, diagnoses, reports, billing, users
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="LLMO Diagnosis SaaS API",
    version="1.0.0",
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://llmo-saas.com",
        "https://app.llmo-saas.com",
        "http://localhost:3000",  # 開発用
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TrustedHost 設定
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["api.llmo-saas.com", "localhost"],
)

# ルーター登録
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(diagnoses.router, prefix="/diagnoses", tags=["diagnoses"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])
app.include_router(users.router, prefix="/users", tags=["users"])

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# routers/auth.py - 認証エンドポイント
from fastapi import APIRouter, HTTPException, Request
from services.auth_service import AuthService
from models.schemas import LoginRequest, SignupRequest

router = APIRouter()
auth_service = AuthService()

@router.post("/login")
async def login(req: Request, login_req: LoginRequest):
    """ログイン + セッション作成"""
    
    # 認証確認
    user = await auth_service.verify_email_password(
        login_req.email,
        login_req.password
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # デバイス・ブラウザ識別
    device_info = auth_service.extract_device_info(req.headers.get("User-Agent"))
    ip_address = req.client.host
    
    # 既存セッション確認
    existing_session = await auth_service.check_existing_session(
        user_id=user["uid"],
        device_id=device_info["device_id"],
        browser_id=device_info["browser_id"],
    )
    
    if existing_session and existing_session["status"] == "active":
        # 複数接続警告
        return {
            "status": "multiple_connection",
            "message": "別デバイスでログインしています" or "別ブラウザでログインしています",
            "existing_session": {
                "browser": existing_session["browser_name"],
                "device": existing_session["os"],
                "last_activity": existing_session["last_activity"],
            },
            "new_session": device_info,
        }
    
    # セッション作成
    session = await auth_service.create_session(
        user_id=user["uid"],
        email=user["email"],
        device_info=device_info,
        ip_address=ip_address,
    )
    
    return {
        "status": "success",
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_in": 3600,
    }

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """トークンリフレッシュ"""
    new_tokens = await auth_service.refresh_access_token(refresh_token)
    return new_tokens

@router.post("/logout")
async def logout(session_id: str):
    """ログアウト"""
    await auth_service.revoke_session(session_id)
    return {"status": "success"}
```

**Docker 化（Cloud Run デプロイ用）:**

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```
# requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
firebase-admin==6.2.0
python-dotenv==1.0.0
pydantic==2.5.0
httpx==0.25.1
stripe==7.4.0
aiohttp==3.9.1
```

**Cloud Run へのデプロイ:**

```bash
# Docker イメージをビルド
gcloud builds submit --tag gcr.io/PROJECT_ID/llmo-api:latest

# Cloud Run にデプロイ
gcloud run deploy llmo-api \
  --image gcr.io/PROJECT_ID/llmo-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=... \
  --set-env-vars STRIPE_API_KEY=... \
  --set-env-vars CLAUDE_API_KEY=...
```

---

#### 1.3 Firestore スキーマ設計・構築

```python
# services/firestore_setup.py - Firestore 初期化
import firebase_admin
from firebase_admin import credentials, firestore

# Firebase Admin SDK 初期化
cred = credentials.Certificate('path/to/serviceAccountKey.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

# Collections 作成（自動作成なので不要だが、スキーマ定義のため）
collections = [
    "users",
    "sessions",
    "organizations",
    "subscriptions",
    "diagnoses",
    "reports",
]

# セキュリティルール (Firestore Console で設定)
firestore_rules = """
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow create: if request.auth == null;  // 新規登録時
      allow update: if request.auth.uid == userId;
      allow delete: if request.auth.uid == userId;
    }
    
    // Sessions collection
    match /sessions/{sessionId} {
      allow read: if request.auth.uid == resource.data.user_id;
      allow create: if request.auth.uid == request.resource.data.user_id;
      allow update: if request.auth.uid == resource.data.user_id;
      allow delete: if request.auth.uid == resource.data.user_id;
    }
    
    // Diagnoses collection
    match /organizations/{orgId}/diagnoses/{diagnosisId} {
      allow read: if request.auth.uid in resource.data.allowed_users;
      allow write: if request.auth.uid in resource.data.allowed_users;
    }
    
    // その他のコレクション
    // ...
  }
}
"""
```

---

### Phase 2: 認証・セッション管理（Week 2-3）

#### 2.1 複数接続警告UI実装

```typescript
// components/MultipleConnectionWarning.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MultipleConnectionWarningProps {
  existingSession: {
    browser: string;
    device: string;
    lastActivity: string;
  };
  newSessionInfo: {
    browser: string;
    device: string;
  };
  isDeviceDifferent: boolean;  // true = 別デバイス, false = 別ブラウザ
  onChooseNewDevice: () => void;
  onCancel: () => void;
}

export function MultipleConnectionWarning({
  existingSession,
  newSessionInfo,
  isDeviceDifferent,
  onChooseNewDevice,
  onCancel,
}: MultipleConnectionWarningProps) {
  const [isLoading, setIsLoading] = useState(false);

  const message = isDeviceDifferent
    ? '別デバイスでログインしています'
    : '別ブラウザでログインしています';

  const handleChooseNewDevice = async () => {
    setIsLoading(true);
    try {
      await onChooseNewDevice();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">⚠️</div>
          <h2 className="text-xl font-bold">セキュリティ確認</h2>
        </div>

        <p className="text-gray-700 mb-6">
          {message}
        </p>

        <div className="bg-gray-50 rounded p-4 mb-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-1">新規ログイン:</p>
            <p className="text-sm text-gray-700">
              {newSessionInfo.browser} / {newSessionInfo.device}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-1">既存セッション:</p>
            <p className="text-sm text-gray-700">
              {existingSession.browser} / {existingSession.device}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              最終アクティビティ: {existingSession.lastActivity}
            </p>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded">
          <p className="text-xs">
            ℹ️ このアカウントは同時に1つのブラウザからのみログイン可能です。
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleChooseNewDevice}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'ログイン中...' : 'このブラウザを使用開始'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 2.2 セッション管理バックエンド

```python
# services/auth_service.py - セッション管理ロジック
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
import json
from firebase_admin import firestore
from models.schemas import SessionInfo

class AuthService:
    def __init__(self):
        self.db = firestore.client()
        self.jwt_secret = os.getenv("JWT_SECRET")
        self.jwt_algorithm = "HS256"

    def extract_device_info(self, user_agent: str) -> Dict[str, Any]:
        """User-Agent からデバイス・ブラウザ情報を抽出"""
        from user_agents import parse
        
        ua = parse(user_agent)
        
        device_id = self._hash_device_id(
            browser_name=ua.browser.family,
            browser_version=ua.browser.version_string,
            os=ua.os.family,
            os_version=ua.os.version_string,
        )
        
        browser_id = self._hash_browser_id(
            device_id=device_id,
            user_agent=user_agent,
        )
        
        return {
            "device_id": device_id,
            "browser_id": browser_id,
            "browser_name": ua.browser.family,
            "browser_version": ua.browser.version_string,
            "os": ua.os.family,
            "os_version": ua.os.version_string,
            "user_agent": user_agent,
        }

    def _hash_device_id(self, **kwargs) -> str:
        """デバイスIDをハッシュ化"""
        import hashlib
        key = json.dumps(kwargs, sort_keys=True)
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def _hash_browser_id(self, **kwargs) -> str:
        """ブラウザIDをハッシュ化"""
        import hashlib
        key = json.dumps(kwargs, sort_keys=True)
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    async def check_existing_session(
        self,
        user_id: str,
        device_id: str,
        browser_id: str,
    ) -> Optional[Dict[str, Any]]:
        """既存セッションを確認"""
        sessions_ref = self.db.collection("sessions")
        query = (
            sessions_ref
            .where("user_id", "==", user_id)
            .where("status", "==", "active")
        )
        
        docs = query.stream()
        
        for doc in docs:
            session_data = doc.to_dict()
            if session_data.get("browser_id") != browser_id:
                # 異なるブラウザ = 複数接続
                return session_data
        
        return None

    async def create_session(
        self,
        user_id: str,
        email: str,
        device_info: Dict[str, Any],
        ip_address: str,
    ) -> Dict[str, str]:
        """新しいセッションを作成"""
        
        # 既存セッションを revoke（同じブラウザの場合は更新）
        await self._revoke_other_sessions(user_id, device_info["browser_id"])
        
        # JWT トークン生成
        now = datetime.utcnow()
        access_token_payload = {
            "sub": user_id,
            "email": email,
            "iat": now,
            "exp": now + timedelta(hours=1),
            "type": "access",
        }
        access_token = jwt.encode(
            access_token_payload,
            self.jwt_secret,
            algorithm=self.jwt_algorithm,
        )
        
        refresh_token_payload = {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(days=30),
            "type": "refresh",
        }
        refresh_token = jwt.encode(
            refresh_token_payload,
            self.jwt_secret,
            algorithm=self.jwt_algorithm,
        )
        
        # Firestore に保存
        session_id = self._generate_session_id()
        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "email": email,
            "device_id": device_info["device_id"],
            "browser_id": device_info["browser_id"],
            "browser_name": device_info["browser_name"],
            "browser_version": device_info["browser_version"],
            "os": device_info["os"],
            "os_version": device_info["os_version"],
            "ip_address": ip_address,
            "user_agent": device_info["user_agent"],
            "access_token": access_token,  # 暗号化推奨
            "refresh_token": refresh_token,  # 暗号化推奨
            "access_token_expires_at": now + timedelta(hours=1),
            "refresh_token_expires_at": now + timedelta(days=30),
            "created_at": now,
            "last_activity": now,
            "status": "active",
        }
        
        self.db.collection("sessions").document(session_id).set(session_data)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "session_id": session_id,
        }

    async def _revoke_other_sessions(
        self,
        user_id: str,
        current_browser_id: str,
    ) -> None:
        """同じユーザーの他のセッションを revoke"""
        sessions_ref = self.db.collection("sessions")
        query = (
            sessions_ref
            .where("user_id", "==", user_id)
            .where("status", "==", "active")
        )
        
        for doc in query.stream():
            session_data = doc.to_dict()
            if session_data.get("browser_id") != current_browser_id:
                # 異なるブラウザ = revoke
                doc.reference.update({
                    "status": "revoked",
                    "revoke_reason": "new_login",
                })

    def _generate_session_id(self) -> str:
        """セッションID生成"""
        import uuid
        return str(uuid.uuid4())
```

---

### Phase 3: 診断・レポート実装（Week 3-4）

#### 3.1 診断エンドポイント

```python
# routers/diagnoses.py
from fastapi import APIRouter, HTTPException, Depends
from services.diagnosis_service import DiagnosisService
from models.schemas import DiagnosisRequest

router = APIRouter()
diagnosis_service = DiagnosisService()

@router.post("/")
async def create_diagnosis(
    req: DiagnosisRequest,
    current_user = Depends(get_current_user),
):
    """新規診断を実行"""
    
    # ユーザーのプランを確認（クレジット制限）
    user_plan = await get_user_plan(current_user["uid"])
    if user_plan["monthly_credit_used"] + 10 > user_plan["monthly_credit_limit"]:
        raise HTTPException(
            status_code=429,
            detail="Monthly credit limit exceeded"
        )
    
    # 診断実行（Claude API）
    diagnosis = await diagnosis_service.run_diagnosis(
        company_name=req.company_name,
        industry=req.industry,
        location=req.location,
        keywords=req.keywords,
    )
    
    # クレジット消費記録
    await record_credit_usage(
        user_id=current_user["uid"],
        amount=10,
        usage_type="diagnosis",
    )
    
    # Firestore に保存
    diagnosis_id = diagnosis_service.save_diagnosis(
        user_id=current_user["uid"],
        diagnosis_data=diagnosis,
    )
    
    return {
        "diagnosis_id": diagnosis_id,
        "status": "completed",
        "scores": diagnosis["scores"],
        "findings": diagnosis["findings"],
    }

@router.get("/{diagnosis_id}")
async def get_diagnosis(
    diagnosis_id: str,
    current_user = Depends(get_current_user),
):
    """診断結果を取得"""
    diagnosis = diagnosis_service.get_diagnosis(diagnosis_id)
    
    if diagnosis["user_id"] != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    return diagnosis
```

#### 3.2 レポート生成

```python
# services/report_service.py
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io

class ReportService:
    async def generate_simple_report(self, diagnosis_data: Dict) -> bytes:
        """簡易レポート PDF 生成"""
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # タイトル
        c.setFont("Helvetica-Bold", 24)
        c.drawString(50, 750, "AI認知度診断レポート")
        
        # スコア表示
        score = diagnosis_data["scores"]["ai_awareness"]
        c.setFont("Helvetica-Bold", 48)
        c.drawString(200, 600, f"{score}/100")
        
        # グラフ（簡易）
        # ...
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    async def generate_detailed_report(self, diagnosis_data: Dict) -> bytes:
        """詳細レポート PDF 生成（Stripe決済後）"""
        # より複雑な PDF 生成
        # ...
        pass
```

---

### Phase 4: Stripe 統合・請求（Week 4）

#### 4.1 Stripe チェックアウト

```python
# routers/billing.py
import stripe

stripe.api_key = os.getenv("STRIPE_API_KEY")

@router.post("/checkout")
async def create_checkout_session(
    plan_id: str,
    current_user = Depends(get_current_user),
):
    """Stripe チェックアウトセッション作成"""
    
    # プラン価格取得
    plan_prices = {
        "starter": 5000,  # 月額 5,000円
        "pro": 15000,     # 月額 15,000円
        "enterprise": 50000,  # 月額 50,000円
    }
    
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "jpy",
                    "product_data": {
                        "name": f"{plan_id.capitalize()} Plan",
                    },
                    "unit_amount": plan_prices[plan_id],
                    "recurring": {
                        "interval": "month",
                        "interval_count": 1,
                    },
                },
                "quantity": 1,
            }
        ],
        mode="subscription",
        customer_email=current_user["email"],
        success_url="https://app.llmo-saas.com/dashboard?success=true",
        cancel_url="https://app.llmo-saas.com/billing?canceled=true",
        client_reference_id=current_user["uid"],
    )
    
    return {"checkout_url": session.url}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe Webhook 処理"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        # 請求成功時の処理
        await record_payment(invoice)
    
    return {"status": "received"}
```

---

#### 4.2 ダッシュボード（Billing ページ）

```typescript
// app/dashboard/billing/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export default function BillingPage() {
  const [billingInfo, setBillingInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBillingInfo() {
      try {
        const res = await apiClient.get('/billing/info');
        setBillingInfo(res.data);
      } finally {
        setLoading(false);
      }
    }
    fetchBillingInfo();
  }, []);

  if (loading) return <div>読み込み中...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">請求・プラン管理</h1>

      {/* 現在のプラン */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">現在のプラン</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">プラン</p>
            <p className="text-2xl font-bold">{billingInfo?.plan_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">月額</p>
            <p className="text-2xl font-bold">¥{billingInfo?.monthly_amount}</p>
          </div>
        </div>
      </div>

      {/* 請求履歴 */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">請求履歴</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">日付</th>
              <th className="text-left py-2">金額</th>
              <th className="text-left py-2">ステータス</th>
              <th className="text-left py-2">アクション</th>
            </tr>
          </thead>
          <tbody>
            {billingInfo?.invoices?.map((invoice) => (
              <tr key={invoice.id} className="border-b hover:bg-gray-50">
                <td className="py-2">{invoice.date}</td>
                <td className="py-2">¥{invoice.amount}</td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    invoice.status === 'paid' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.status === 'paid' ? '成功' : '待機中'}
                  </span>
                </td>
                <td className="py-2">
                  <a href={invoice.pdf_url} target="_blank" className="text-blue-600 hover:underline">
                    PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 📋 実装チェックリスト（完全版）

### Frontend - 完全チェックリスト

```
□ LP（https://llmo-saas.com）
  □ トップページ（ヒーロー + 説明 + CTA）
  □ 料金ページ（3段階プラン表示）
  □ 機能ページ
  □ ブログ（SEO記事 月2-4本）
  □ お問い合わせフォーム
  □ robots.txt 設定（LP のみ対象）

□ 認証フロー
  □ ログイン画面
  □ 新規登録画面
  □ メール確認画面
  □ パスワードリセット
  □ 複数接続警告（デバイス別 + ブラウザ別）
  □ Firebase Auth 統合

□ ダッシュボード
  □ Home（KPI表示）
  □ Diagnoses（診断実行・一覧・詳細）
  □ Reports（簡易・詳細レポート表示）
  □ Billing（請求・プラン管理）
  □ Settings（プロフィール・チーム・セキュリティ）
  □ Middleware 認証保護
  □ robots.txt（/dashboard は検索排除）

□ セッション管理
  □ HttpOnly Cookie
  □ JWT Token 自動リフレッシュ
  □ セッション有効期限表示
  □ Active Sessions 管理
  □ セッションログアウト

□ Stripe 連携
  □ Checkout フロー UI
  □ クレジットカード管理
  □ 請求履歴表示
  □ 年払い変更オプション

□ レスポンシブ
  □ PC（1920px+）
  □ タブレット（768-1024px）
  □ スマートフォン（320-767px）

□ SEO 対応
  □ メタタグ（title, description）
  □ OGP タグ
  □ XML サイトマップ
  □ robots.txt
  □ 内部リンク最適化
```

### Backend - 完全チェックリスト

```
□ 認証エンドポイント
  □ POST /auth/signup
  □ POST /auth/login
  □ POST /auth/logout
  □ POST /auth/refresh
  □ POST /auth/reset-password

□ セッション管理
  □ デバイス ID 計算（User-Agent + OS）
  □ ブラウザ ID 計算（device_id + User-Agent）
  □ 既存セッション確認
  □ 複数接続検出
  □ セッション revoke ロジック
  □ last_activity 更新

□ 診断エンドポイント
  □ POST /diagnoses（診断実行 + Claude API）
  □ GET /diagnoses（一覧）
  □ GET /diagnoses/{id}（詳細）
  □ クレジット消費記録

□ レポートエンドポイント
  □ GET /reports/{id}/simple（簡易 PDF 生成）
  □ GET /reports/{id}/detailed（詳細 PDF + Stripe決済）
  □ POST /reports/{id}/share（共有リンク生成）

□ 請求エンドポイント
  □ POST /billing/checkout（Stripe セッション作成）
  □ GET /billing/invoices（請求履歴）
  □ PATCH /billing/plan（プラン変更）
  □ POST /webhooks/stripe（Stripe Webhook）

□ ユーザー管理
  □ GET /users/me
  □ PATCH /users/me（プロフィール更新）
  □ GET /users/sessions（セッション一覧）
  □ DELETE /users/sessions/{id}（セッション削除）
  □ POST /users/team/invite（メンバー招待）
  □ DELETE /users/team/{user_id}（メンバー削除）

□ セキュリティ
  □ JWT Token 署名・検証
  □ CORS 設定
  □ Rate Limiting
  □ Input Validation
  □ エラーハンドリング

□ ログ・モニタリング
  □ ログ記録（Cloud Logging）
  □ エラートラッキング（Sentry）
  □ パフォーマンスモニタリング
```

---

## 🚀 デプロイメント手順

### Frontend（Vercel）

```bash
# リポジトリ初期化
cd frontend
git init
git add .
git commit -m "Initial commit"

# Vercel に接続
vercel login
vercel --prod

# 環境変数設定（Vercel Dashboard）
# - NEXT_PUBLIC_API_BASE=https://api.llmo-saas.com
# - NEXT_PUBLIC_FIREBASE_API_KEY=...
# - etc
```

### Backend（Google Cloud Run）

```bash
cd backend

# GCP プロジェクト設定
gcloud config set project llmo-saas

# Docker イメージをビルド＆プッシュ
gcloud builds submit --tag gcr.io/llmo-saas/api:latest

# Cloud Run にデプロイ
gcloud run deploy llmo-api \
  --image gcr.io/llmo-saas/api:latest \
  --region us-central1 \
  --memory 2Gi \
  --timeout 3600 \
  --set-env-vars \
    FIREBASE_PROJECT_ID=llmo-saas,\
    STRIPE_API_KEY=sk_...,\
    STRIPE_WEBHOOK_SECRET=whsec_...,\
    CLAUDE_API_KEY=sk-...,\
    JWT_SECRET=your-secret-key

# カスタムドメイン設定
gcloud run services update-traffic llmo-api \
  --region us-central1 \
  --update-routes api.llmo-saas.com=llmo-api
```

### Firestore セキュリティルール

```
Firestore Console で設定
```

---

## 📞 サポート・デバッグ

**ログ確認:**

```bash
# Vercel ログ
vercel logs

# Cloud Run ログ
gcloud logs read --limit 50 --service-name llmo-api
```

**テスト:**

```bash
# Frontend テスト
npm run test

# Backend テスト
pytest tests/

# E2E テスト
npx playwright test
```

---

## ✅ 完成時のチェックリスト

- [ ] LP が Google 検索で上位表示（1-3ヶ月後）
- [ ] ユーザー登録フロー完成
- [ ] セッション管理（複数接続制御）完全実装
- [ ] 診断機能完成（Claude API連携）
- [ ] Stripe サブスク完全実装
- [ ] ダッシュボード全機能完成
- [ ] セキュリティテスト完了
- [ ] 本番環境デプロイ完了
- [ ] 初期ユーザー獲得開始

---

**このドキュメントをベースに、VSCode Claude で実装を進めてください！** 🚀

