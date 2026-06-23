# Backend CLAUDE.md - アーキテクチャルール (v4.1)

## 起動コマンド
```
# API サーバー
uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload

# Worker（Automation/APScheduler）
python worker/main.py
```

## スキーマ変更ルール（必須）
**スキーマ変更時は必ず alembic revision → upgrade を行うこと。**
```
# 変更後
alembic revision --autogenerate -m "説明"
alembic upgrade head
```
- `Base.metadata.create_all()` は **DEV_AUTO_CREATE=true** の開発用使い捨てDB専用。本番・ステージングでは実行しない。
- カラム追加・型変更・テーブル追加は全て alembic migration で管理する。

## DB アクセス方針（シム使用規約）
- `db_get / db_set / db_query / db_update / db_delete / db_add`（Firestore 互換シム）は **単純な単一レコードの get/set 用途に限定**する。
- 以下の場合は **SQLAlchemy ORM/生SQL ＋ `transaction()` を直接使用**すること（シム禁止）：
  - 複数テーブルへの書き込み（例: signup の User→Agency→AgencyMember→Session）
  - 集計・JOIN・サブクエリが必要な処理（例: 月次レポートの時系列集約、差分算出）
  - トランザクション境界が必要な処理
- 理由: シムは JOIN・トランザクション・整合性を捨てており、複雑な処理に使うと脆くなる。

## モジュール構成
```
backend/
├── app/
│   ├── core/          # Layer 1: 認証・認可・セッション・通知等
│   ├── modules/       # Layer 2: Agency・Client・Diagnosis等ビジネスロジック
│   ├── shared/        # 共通基盤 (db, utils, constants, api/deps)
│   ├── main.py
│   └── config.py
├── alembic/           # マイグレーション管理
│   ├── versions/      # リビジョンファイル
│   └── env.py
└── worker/
    └── main.py        # APScheduler worker（api コンテナと分離）
```

## 不変ルール
1. **1回の変更は1モジュールのみ** - 複数モジュールを同時変更禁止
2. **モジュール間DB直接アクセス禁止** - Service API経由のみ
3. **型安全** - Pydantic BaseModel for all I/O
4. **DB アクセス** - `app.shared.db.firestore.*`（シム）。複雑な処理は ORM 直接利用（上記シム使用規約参照）
5. **認証** - 全エンドポイントに `Depends(get_current_user)` を付ける（公開エンドポイント除く）
6. **Firebase/Firestore の新規利用禁止** - PostgreSQL + SQLAlchemy に統一済み

## データベース
- PostgreSQL (asyncpg / SQLAlchemy async)
- テーブル: users, agencies, agency_members, sessions, clients, keyword_sets, diagnoses, reports, invoices,
  api_credits, automation_schedules, automation_logs, optimizations, content_sources, content_articles,
  credit_usage, audit_logs

## 認証フロー (v4.1 — Firebase Auth 除去済み)
1. Frontend → `POST /auth/signup` または `POST /auth/login`（email/password）
2. レスポンス: `access_token`（ボディ）＋ `refresh_token`（httpOnly Cookie）
3. 以降のリクエスト: `Authorization: Bearer {access_token}` + `X-Session-Id: {session_id}`
4. トークン更新: `POST /auth/refresh`（Cookie から自動）

## セッション管理
- 1ユーザー = 最大1ブラウザ同時接続
- 別デバイスでログイン → 既存セッション警告 → force=true で強制切り替え
- `deps.py` は JWT 検証に加えセッションテーブルを DB 照合（status=active 確認）
