# LLMO Score v4.0 — VSCode Claude Code 実装指示書（REBUILD PROMPT）

**作成日**: 2026-06-22
**対象**: VSCode 上の Claude Code
**SSOT**: `LLMO-Score-COMPLETE-FINAL-v4.md`（v4.0設計書／本書と必ずセットで参照）
**目的**: 稼働中の v3.0.0 を壊さずに、v4.0設計へ段階的にリビルドする

---

## 0. このドキュメントの使い方

1. プロジェクトルートに **v4.0設計書** と **本書** を置く。
2. まず「§2 絶対ルール」を `CLAUDE.md` に反映（設計書 第11章の内容）。
3. **Phase 0 から順に**、§6 のコピペ用プロンプトを1つずつ Claude Code に渡す。
4. 1 Phase = 原則1モジュール。完了条件（DoD）を満たすまで次へ進まない。
5. 不明点が出たら Claude Code は**推測せず質問**する。

> ⚠️ 本番（llmo.fact-ally.com / v3.0.0）は稼働中。**作業は git ブランチ `v4-rebuild` 上で行い、Phase 9 のカットオーバーまで本番に触れない。** main/master への直接 push・破壊的操作は禁止。

---

## 1. 前提と参照ファイル

| 種別 | 参照先 |
|------|--------|
| 設計の正本 | `LLMO-Score-COMPLETE-FINAL-v4.md` |
| 作業ログ | `backend/docs/session_log.md`（追記のみ） |
| アーキ規約 | `backend/CLAUDE.md`（設計書 第11章） |
| デザインSSOT | melta-ui トークン（`G:/マイドライブ/antigravity/Claudcode/melta-ui-main/`）独自デザイン生成禁止 |
| 現行コード | v3.0.0（VPS 116.80.96.175、systemd 稼働中） |

### 主要な変更の前提（v3.0.0 → v4.0）
- 認証: **Firebase Auth 廃止 → 自前 JWT**
- DB: **Firestore 廃止 → PostgreSQL（Docker）**
- 診断: **Gemini単体 → Gemini 2.5 + GPT-4o 多LLM + Tavily**
- 新規モジュール: **Optimization（STEP2）/ Content（③）**
- Automation 強化（差分・ハルシネーション検知・**LINE Messaging API**）
- デプロイ: **systemd → docker-compose**

---

## 2. 絶対ルール（CLAUDE.md に反映）

### 禁止
- ❌ 他モジュールの DB テーブルへ直接アクセス（公開 Service API 経由のみ）
- ❌ 1回の変更で複数モジュールを変更
- ❌ 推測実装（仕様が曖昧なら質問）
- ❌ `session_log.md` の上書き・削除
- ❌ main/master への直接 push・破壊的操作
- ❌ Firebase / Firestore の新規利用
- ❌ LINE Notify の利用（終了済み。Messaging API を使う）
- ❌ melta-ui トークンを無視した独自デザイン

### 必須
- ✅ 1回の変更は1モジュールのみ
- ✅ 着手前に `session_log.md` へ「作業内容（予定）」、完了後に「作業結果」を追記
- ✅ 各モジュールに 責務・保持データ・公開API・依存・将来再利用例 を明記
- ✅ モジュールは独立フォルダ（`backend/app/modules/<name>/`）
- ✅ 新機能は 設計 → 承認 → 実装 の順
- ✅ PostgreSQL は SQLAlchemy(async)、認証は自前 JWT で実装

---

## 3. 最初にやること（Phase 0 の前段：現状分析）

Claude Code が最初に行う「①現状分析」。コードを書く前に**調査レポートのみ**を出す。

調査対象:
1. 現行 `backend/app/` のフォルダ構成・モジュール境界
2. Firestore 依存箇所の洗い出し（`google-cloud-firestore` / `firebase` import を全列挙）
3. Firebase Auth 依存箇所（frontend の client SDK 含む）
4. shared 化すべき共通機能（DB アクセス、LLM 呼び出し、PDF、通知）
5. 本番に**実データがあるか**（移行が必要か、初期スキーマで開始してよいか）

→ 影響範囲・移行リスク・推奨着手順を**レポートとして出力**し、承認を得てから Phase 0 に進む。

---

## 4. 環境・シークレット準備（新規追加ぶん）

v4.0 で新たに必要になるキー。`.env` に追加:

```
# 既存（流用）
GEMINI_API_KEY=...
GOOGLE_PLACES_API_KEY=...
STRIPE_SECRET_KEY=...        STRIPE_WEBHOOK_SECRET=...
SENDGRID_API_KEY=...

# 新規
OPENAI_API_KEY=...           # GPT-4o（多LLM診断）
TAVILY_API_KEY=...           # 実Webクロール
LINE_CHANNEL_ACCESS_TOKEN=...# LINE Messaging API（公式アカウント要・無料枠 月200通）
LINE_CHANNEL_SECRET=...

# 認証（Firebase廃止に伴う自前JWT）
JWT_SECRET=...               JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL=3600        REFRESH_TOKEN_TTL=2592000

# PostgreSQL（Docker）
DATABASE_URL=postgresql+asyncpg://llmo:***@db:5432/llmo
```

Firebase 系（`FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`）は段階的に削除。

---

## 5. Phase 一覧と完了条件（DoD）

| Phase | 対象 | 完了条件 |
|-------|------|----------|
| 0 | 共通基盤（docker-compose / PostgreSQL / 自前JWT / shared/db） | `docker compose up` で api/web/db 起動、signup→login→refresh が JWT で成功、Firebase import ゼロ |
| 1 | Core 移行（session/user/audit/notification/payment/file/settings） | 全 Core が PostgreSQL 永続化で動作、通知に line チャネル追加 |
| 2 | agency / client / billing | 親子アカウント・クレジット消費が PostgreSQL で動作 |
| 3 | shared/llm（Gemini+GPT-4o）+ Tavily + diagnosis 再設計 | 多LLM同時クエリ＋引用スコア＋サイト分析が出力、raw_evidence保存 |
| 4 | keyword / reporting | キーワード生成・各レポートPDF（ブランディング）動作 |
| 5 | optimization（STEP2・新規） | JSON-LD/紹介文/robots/FAQ/WPプリセット/チェックリストを生成・エクスポート |
| 6 | content（③・新規） | 一次情報登録→GEO5原則記事生成→編集→保存 |
| 7 | automation（STEP3・強化） | スケジュール実行・差分・ハルシネーション検知・email/slack/line配信・月次レポート |
| 8 | frontend | API向き先変更、optimizations/contents 画面追加、melta-ui準拠 |
| 9 | 統合・カットオーバー | docker-compose 本番切替、SSL、E2E（代理店フロー全体）、旧systemd停止 |

各 Phase で「②モジュール設計書」は v4.0設計書を参照。新規（5,6）は着手前に**データモデル・API・フォルダ構成・依存のみ**を出して承認を得る（コード前）。

---

## 6. コピペ用プロンプト（Phase ごとに1つずつ渡す）

### ▶ 起動プロンプト（最初の1回）

```
あなたはこのリポジトリの実装担当です。まず LLMO-Score-COMPLETE-FINAL-v4.md（SSOT）と
LLMO-Score-v4-REBUILD-PROMPT.md（本指示書）を読み込んでください。

最初のタスクは「§3 現状分析」のみです。コードは書かないでください。
- 現行 backend/app/ の構成とモジュール境界
- Firestore / Firebase Auth 依存箇所の全列挙（ファイルパス付き）
- shared 化候補（DB/LLM/PDF/通知）
- 本番に実データがあるか（初期スキーマで開始可か）
これらを影響範囲・移行リスク・推奨着手順としてレポートにまとめ、私の承認を待ってください。
session_log.md には「作業内容（予定）＝現状分析」を先に追記してから始めてください。
```

### ▶ Phase 共通テンプレート（{N} と {対象} を埋めて使う）

```
Phase {N}: {対象モジュール} を実装します。SSOT（v4.0設計書）の該当章に厳密に従ってください。

手順:
1. session_log.md に「### 作業内容（予定）」を追記（着手前・必須）
2. {対象} の 責務・保持データ(PostgreSQLテーブル)・公開API・依存・将来再利用例 を確認
3. backend/app/.../{対象}/ 配下に models/schemas/services/router を実装
4. 他モジュールへは Service API 経由のみ（DB直参照禁止）
5. 完了条件（本指示書 §5 の DoD）を満たすことを確認
6. session_log.md に「### 作業結果」「### 変更ファイル」「### 次のアクション」を追記

制約: 1回の変更はこのモジュールのみ。Firebase/Firestore は使わない。
曖昧な点は推測せず質問してください。実装後、DoD を満たしたか自己チェック結果を報告してください。
```

### ▶ Phase 0（共通基盤）専用

```
Phase 0: 共通基盤を構築します。
- docker-compose.yml（api / web / db(postgres) / worker / nginx）
- backend/app/shared/db/（SQLAlchemy async engine, session, Base）
- core/authentication を Firebase Auth から「自前JWT（PyJWT + argon2）」へ差し替え
  （v1/v2 方式を復活。signup/login/refresh/verifyEmail/resetPassword）
- Firebase / Firestore の import を全廃（残存があれば一覧で報告）

DoD: docker compose up で api/web/db 起動、signup→login→refresh が JWT で成功、
Firebase import ゼロ。完了後 session_log に結果を追記。
```

### ▶ Phase 3（診断コア・最重要）専用

```
Phase 3: 診断コアを再設計します。SSOT 第6章 Module C と第7章 7.1 に従う。
1. shared/llm/ に多LLMオーケストレータを実装（Gemini 2.5 と GPT-4o を同一I/F、
   asyncio.gather で並列、timeout/retry/コスト計測）
2. Tavily 連携で対象URL+キーワードの実Web情報を取得
3. 各AI回答を mention(mentioned/partial/not) と quality(0-3) で判定
4. 引用スコア（keyword_score / overall / ai_awareness / competitive / geo / eeat / growth）を算出
5. サイト構造分析（schema/robots/sitemap/faq/ssl/速度）を併走
6. diagnoses テーブルに scores/ai_analysis/keyword_analysis/site_analysis/findings/
   recommendations/projections/raw_evidence を保存

旧 Gemini 単体実装は置き換える。simple は Gemini 単体要約のまま、detailed を多LLM化。
DoD: detailed 診断で2社のAI別認識・引用スコア・改善提案が出力されること。
```

### ▶ Phase 5 / 6（新規モジュール）専用の前段

```
Phase {5|6}: {optimization|content} は新規モジュールです。
まず実装前に、データモデル(PostgreSQL)・公開API・フォルダ構成・依存関係・拡張案のみを
提示してください（コードは書かない）。私の承認後に実装に進みます。
SSOT 第6章 Module {E|F} と第7章 {7.2|（GEO5原則）} を根拠にすること。
```

---

## 7. 移行時の落とし穴（必ず留意）

- **Firebase 除去はフロントにも及ぶ**: `lib/firebase.ts`、`NEXT_PUBLIC_FIREBASE_*`、auth-context の Firebase 依存を JWT ベースへ置換。クッキー/ヘッダ（X-Session-Id）方式は流用可。
- **データ移行**: 本番が pre-launch でテストデータのみなら、PostgreSQL 初期スキーマで作り直してよい（要・現状分析で確認）。実データがあれば移行スクリプトを別途設計。
- **多LLMのコスト/レイテンシ**: GPT-4o 追加で原価・所要時間が増える。並列化必須、失敗時は片側結果でも継続（部分成功を許容）。クレジット単価は暫定値（設計書3.2）で実装し、運用後に調整。
- **LINE**: 公式アカウント作成→Messaging API 有効化→チャネルトークン取得が前提。無料枠 月200通のため、アラートは critical/warning を優先送信。
- **PDF**: 現行 ReportLab を流用。新レポート種別（実装最適化・コンテンツ）を追加する場合はテンプレート分離。
- **本番切替（Phase 9）**: docker-compose を起動・検証後に nginx の向き先を切替え、旧 systemd サービスを停止。ロールバック手順を session_log に残す。

---

## 8. 完了の定義（プロジェクト DoD）

- [ ] Firebase 依存ゼロ（backend / frontend とも）
- [ ] PostgreSQL（Docker）で全モジュール動作
- [ ] 詳細診断が Gemini + GPT-4o の多LLM + Tavily で引用スコアを出力
- [ ] STEP2（Optimization）・Content・STEP3（Automation/LINE）が動作
- [ ] 代理店フロー（登録→キーワード→診断→最適化→レポート→監視）が E2E で通る
- [ ] docker-compose による本番稼働、SSL 有効
- [ ] session_log に全 Phase の予定/結果が記録されている

---

**実装は Phase 0 → 9 の順で、1モジュールずつ。SSOT（v4.0設計書）と本指示書のルールを常に優先すること。**
