# LLMO Score — Phase 9 デプロイ手順書（本番カットオーバー）

**対象 SSOT**: `LLMO-Score-COMPLETE-FINAL-v4.md`（v4.1）
**作成日**: 2026-06-23
**方針**: ケース1 — v3 データは移行しない。**空の新DB `llmo_v4` を Alembic baseline から作成**し、Docker Compose 構成へカットオーバーする。
**サーバ**: VPS 116.80.96.175 / `llmo.fact-ally.com`

---

## 0. 大原則（やってはいけないこと）

- ❌ 既存 `llmo_db`（v3）に `alembic upgrade head` を流す（テーブル名衝突で新旧混在・破損）
- ❌ `alembic stamp head` で適用済みと偽装する
- ❌ 本番で `DEV_AUTO_CREATE=true`（`create_all` は列追加しない）
- ✅ v3 の `llmo_db` と旧 systemd 構成は**消さずに残す**（ロールバック用）。カットオーバー安定後に破棄
- ✅ 作業は `v4-rebuild` ブランチで実施、本番切替の瞬間まで現行サービスは止めない

---

## 1. 事前準備（ローカル/ブランチ側で完了させる）

```
□ FIX-8 までの修正が v4-rebuild に入っている
□ 前回の宿題2点が緑:
   - _detect_hallucinations の previous 側参照が ai_analysis 構造になっている
   - （実DB確認は本手順の 4 で実施）
□ docker-compose.yml に db/api/web/nginx/worker の5サービスが定義済み
   （worker を独立サービスとして追加。command: python worker/main.py）
□ .env（本番用）を用意（下記 2 の変数）
□ 必要なAPIキーが揃っている: GEMINI / OPENAI / TAVILY / GOOGLE_PLACES /
   STRIPE_SECRET / STRIPE_WEBHOOK_SECRET / SENDGRID / LINE_CHANNEL_*
```

---

## 2. 本番 `.env`（DATABASE_URL を新DBに向ける）

```bash
# DB — 新DB llmo_v4 を指す（v3 の llmo_db ではない）
DATABASE_URL=postgresql+asyncpg://llmo:***@db:5432/llmo_v4
DEV_AUTO_CREATE=false            # 本番は必ず false（alembic で作る）

# 認証
JWT_SECRET=***                   JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL=3600            REFRESH_TOKEN_TTL=2592000

# AI / Web
GEMINI_API_KEY=***   OPENAI_API_KEY=***   TAVILY_API_KEY=***   GOOGLE_PLACES_API_KEY=***

# 課金 / 通知
STRIPE_SECRET_KEY=***   STRIPE_WEBHOOK_SECRET=***   SENDGRID_API_KEY=***
LINE_CHANNEL_ACCESS_TOKEN=***   LINE_CHANNEL_SECRET=***

# フロント（公開可）
NEXT_PUBLIC_API_URL=https://llmo.fact-ally.com/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_***
```

> Postgres コンテナの初期DB名は `llmo`（既定）でよい。`llmo_v4` は 4 の手順で明示作成する。

---

## 3. Docker Compose の起動（DBとアプリを立てる）

```bash
# v4-rebuild を pull
cd /root/llmo && git fetch && git checkout v4-rebuild && git pull

# まず db だけ起動（マイグレーションの前提）
docker compose up -d db
docker compose ps          # db が healthy になるまで待つ
```

---

## 4. 新DB `llmo_v4` を baseline から作成（Phase 9 の核心）

```bash
# 4-1. 新しい空DBを作成（v3 の llmo_db には触れない）
docker compose exec db psql -U llmo -c "CREATE DATABASE llmo_v4;"

# 4-2. Alembic baseline を新DBに適用（api イメージ内で実行）
#      DATABASE_URL が llmo_v4 を指していることを確認のうえ:
docker compose run --rm api alembic upgrade head

# 4-3. 適用確認（ここが前回からの宿題の最終確認）
docker compose exec db psql -U llmo -d llmo_v4 -c "\dt"          # 17テーブルの存在
docker compose exec db psql -U llmo -d llmo_v4 -c "\d diagnoses" # source / retain_until / degraded
docker compose exec db psql -U llmo -d llmo_v4 -c "\d optimizations"  # checklist
docker compose run --rm api alembic current                      # head であること
```

**確認チェック**:
```
□ \dt に 17テーブル（…/api_credits/automation_schedules/automation_logs/
  credit_usage/audit_logs/optimizations/content_*）が揃っている
□ diagnoses に source / retain_until / degraded 列がある
□ optimizations に checklist 列がある
□ alembic current = 0001_baseline_v4_1_all_tables (head)
```
名前衝突は起きない（空DBのため）。ここが全部緑なら DB は正しい。

---

## 5. アプリ全サービス起動

```bash
docker compose up -d --build        # api / web / worker / nginx をビルド＆起動
docker compose ps                   # 全サービス Up
docker compose logs -f api worker   # 起動エラーが無いか
```

確認:
```
□ api: /api/health が {"status":"ok"} を返す（コンテナ内 or nginx 経由）
□ worker: "Worker started — polling every 60 seconds (Asia/Tokyo)" のログ
□ worker が create_all を呼んでいない（init_db 除去済みのはず）
```

---

## 6. nginx 向き先切替 ＋ SSL（カットオーバー）

現行は systemd（旧 frontend:3001 / backend:8006 直）。これを Docker Compose の upstream へ切替える。

```
□ infra/nginx/llmo.conf が upstream を Docker サービス（api:8006 / web:3001）に向けている
□ SSL 証明書パスを /etc/ssl/llmo/ に統一（compose の nginx がマウント）
□ 既存 certbot 証明書を nginx コンテナにマウント or コピー
```

```bash
# 旧 systemd を止めてから compose の nginx を有効化（ポート競合回避）
systemctl stop llmo-frontend llmo-backend
docker compose up -d nginx
curl -I https://llmo.fact-ally.com           # 200 / SSL 有効
```

> ポート80/443 を旧nginxが掴んでいる場合は、旧nginx停止 or compose 側を別経路にする。競合に注意。

---

## 7. Stripe / 外部Webhook の向き先確認

```
□ Stripe Webhook: https://llmo.fact-ally.com/api/billing/webhook が新api に届く
□ STRIPE_WEBHOOK_SECRET が本番値
□ LINE 公式アカウントのチャネルが有効（push 月200通枠）
```

---

## 8. E2E スモークテスト（代理店フロー一気通貫）

新DBは空なので、実際に作りながら確認する。

```
□ signup（代理店Admin作成）→ httpOnly cookie で refresh, access はメモリ
□ reload してもセッション復帰（/auth/refresh cookie bootstrap）
□ 別ブラウザで同一アカウント → 多重接続警告 → 旧セッション失効が効く（deps の session 照合）
□ クライアント登録
□ キーワード生成（Places + Gemini, 3cr 消費 → credit_usage に記録）
□ 詳細診断（Gemini + GPT-4o + Tavily, 20cr / 引用スコア表示, source=manual）
□ /billing/credit-costs が表示コストと一致（詳細=20 でズレなし）
□ 実装最適化生成（JSON-LD/紹介文/robots/FAQ/WP preset/checklist DL）
□ レポートPDF生成・配信
□ automation スケジュール作成 → next_execution が未来日（当日は翌周期, JST）
□ worker tick が拾い、SKIP LOCKED で二重起動しない／クレジット原子消費
□ クレジット不足時 → warning スキップ・リトライ無し・admin 通知
```

---

## 9. ロールバック手順（問題が出たら即戻す）

v3 は丸ごと残してあるので、戻しは速い。

```bash
# 1. compose の nginx を止める
docker compose stop nginx
# 2. 旧 systemd を復帰（v3 backend/frontend + 旧nginx）
systemctl start llmo-backend llmo-frontend
systemctl reload nginx        # 旧nginx 設定で 443 を戻す
# 3. 確認
curl -I https://llmo.fact-ally.com
```

- DBは `llmo_db`(v3) を一切変更していないため、ロールバックでデータ不整合は起きない。
- `llmo_v4` は残置（再カットオーバー時に再利用）。

---

## 10. カットオーバー後の後片付け（安定確認後）

```
□ 数日〜1週間、worker のログ・credit_usage の記録・通知配信を監視
□ 問題なければ旧 systemd サービス無効化: systemctl disable llmo-backend llmo-frontend
□ 旧 llmo_db は最終バックアップを取得後に破棄（焦らない）
□ 残課題（負債）を session_log/CLAUDE.md で管理:
   - next_execution を String(64) → DateTime(timezone=True) へ（インデックス効率）
   - audit_logs の record_log() 配線（消費・課金・メンバー変更・スケジュールCRUD）
   - クレジット暫定単価（automation 12/6・詳細20）を運用実原価で確定
```

---

## 付録: Phase 9 の流れ（要約）

```
db起動 → CREATE DATABASE llmo_v4 → alembic upgrade head（空DBに17テーブル）
       → 列/テーブル実在確認 → 全サービス起動 → nginx切替+SSL
       → Stripe/LINE確認 → E2E → （NG時ロールバック）→ 安定後に旧構成破棄
```

**この手順なら、テーブル名衝突は構造的に発生しない**（v3 と別DBに作るため）。前回からの「baseline が既存DBで空振りする」問題も、新DB作成で根治する。
