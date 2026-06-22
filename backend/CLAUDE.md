# Backend CLAUDE.md - アーキテクチャルール

## 起動コマンド
```
uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload
```

## モジュール構成
```
backend/
├── app/
│   ├── core/          # Layer 1: 認証・認可・セッション・通知等
│   ├── modules/       # Layer 2: Agency・Client・Diagnosis等ビジネスロジック
│   ├── shared/        # 共通基盤 (db, utils, constants, api/deps)
│   ├── main.py
│   └── config.py
└── firebase-adminsdk.json
```

## 不変ルール
1. **1回の変更は1モジュールのみ** - 複数モジュールを同時変更禁止
2. **モジュール間DB直接アクセス禁止** - Service API経由のみ
3. **型安全** - Pydantic BaseModel for all I/O
4. **Firestore** - SQLAlchemyは使わない。全DBアクセスは `app.shared.db.firestore.*`
5. **認証** - 全エンドポイントに `Depends(get_current_user)` を付ける（公開エンドポイント除く）

## データベース
- Firestore (firebase-admin SDK)
- コレクション: users, agencies, agency_members, sessions, clients, diagnoses, keywords, reports, invoices

## 認証フロー
1. Frontend → Firebase Auth（サインアップ・ログイン）
2. Firebase ID Token → `POST /auth/login` → session_id 取得
3. 以降のリクエスト: `Authorization: Bearer {id_token}` + `X-Session-Id: {session_id}`

## セッション管理
- 1ユーザー = 最大1ブラウザ同時接続
- 別デバイスでログイン → 既存セッション警告 → force=true で強制切り替え
- 親アカウント(admin)と子アカウント(staff/viewer)はそれぞれ独立したセッション
