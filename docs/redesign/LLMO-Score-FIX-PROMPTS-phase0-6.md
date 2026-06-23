# LLMO Score — Phase 0〜6 修正指示書（Issue ①〜⑫）

**対象 SSOT**: `LLMO-Score-COMPLETE-FINAL-v4.md`（v4.1）
**作成日**: 2026-06-23
**前提**: 現在 Phase 7 着手済み。本書の修正は **Phase 7 と並行/割り込み**で適用する。
**原則**: 1ユニット = 1モジュール（または1領域）。各ユニットは独立して適用でき、それぞれ session_log に「予定→結果」を記録する。

---

## 0. 適用順序（重要）

Phase 7 がスキーマ（api_credits / diagnoses.source / automation_schedules）を追加していくため、**スキーマ基盤の修正を先に入れる**こと。

```
【先にやる（Phase 7 を深掘りする前）】
  FIX-1  shared/db    : Alembic 導入（①）＋ トランザクションヘルパー（⑥下地）   ← 最優先
  FIX-2  billing+audit: credit_usage 台帳・audit_log・credit-costs API（②④）   ← Phase 7-0 と同時推奨

【並行で順次】
  FIX-3  authentication: セッション照合・httpOnly cookie・signupトランザクション（③⑤⑥）
  FIX-4  frontend      : トークン保存方式・クレジット表示（②⑤）
  FIX-5  diagnosis     : 部分成功課金・raw_evidence 保持方針（⑩⑪）
  FIX-6  optimization  : 実装チェックリスト生成（⑧）

【いつでも】
  FIX-7  docs/policy   : シム負債方針・ログ注記・UI未実装の明示（⑦⑨⑫）
```

> なぜ先にFIX-1か: Phase 7-0 の `api_credits` 等を `create_all` で足しても**既存テーブルにカラムは反映されない**（①の核心）。Alembic を先に入れれば Phase 7 のスキーマ追加が全てクリーンなマイグレーションになる。

---

## FIX-1 ── shared/db：Alembic 導入 ＋ トランザクションヘルパー

**対象 Issue**: ①（create_all がカラム追加を反映しない）／⑥の下地
**優先度**: 最高

### 問題と理由
Phase 1 で `init_db()`＝`Base.metadata.create_all()` をスタートアップで実行している。`create_all` は **存在しないテーブルだけを `CREATE TABLE IF NOT EXISTS` で作る**仕様で、**既存テーブルへのカラム追加・型変更は一切行わない**。ところが Phase 2（`tags`/`invited_by`）、Phase 3（`ai_analysis` 等 JSONB 5本）、Phase 5/6（新テーブル）と、毎フェーズでスキーマを変更している。

### 影響
- 一度 DB を作成した後に追加したカラムは**実 DB に存在しない**まま。開発中は volume を作り直していれば顕在化しないが、**実データ投入後に同じことをやると `column ... does not exist` で機能停止**する。
- Phase 7 でさらに `api_credits` / `diagnoses.source` / `automation_schedules` 列を足すため、放置すると不整合が雪だるま式に増える。

### 対策
1. **Alembic を導入**（requirements に既存）。現行 models.py 全体を反映した**ベースライン・マイグレーション**を生成。
2. アプリ起動時の `create_all` は**開発の使い捨て DB 専用**に降格し、本番・ステージングは `alembic upgrade head` で適用する運用にする。
3. 既存開発 DB は pre-launch でデータが無いので **drop & recreate → upgrade head** で揃える。
4. 併せて `postgres.py` に**トランザクション・コンテキストマネージャ**を追加（FIX-3/⑥で使用）。複数テーブルへの書き込みを1トランザクションで囲えるようにする。

### 📋 コピペ用プロンプト
```
FIX-1: shared/db に Alembic マイグレーション基盤とトランザクションヘルパーを導入します。
session_log に「### 作業内容（予定）」を先に追記してから着手してください。

背景（問題）:
- 現在 init_db()=Base.metadata.create_all() でテーブルを作っているが、これは既存テーブルへの
  カラム追加を反映しない。Phase 2/3/5/6 で追加したカラムが実DBに無い恐れがあり、
  実データ投入後に "column does not exist" で壊れる。Phase 7 でさらにスキーマを足す前に基盤を整える。

作業:
1. alembic init を実行し、env.py を以下に合わせて設定:
   - target_metadata = Base.metadata（app.shared.db.models から import）
   - sqlalchemy.url は config.database_url を参照（マイグレーション実行は同期ドライバ psycopg2 を使用。
     非同期URLしか無ければ env.py 内で +asyncpg を +psycopg2 等に置換する）
2. 現行 models.py 全テーブル・全カラムを反映した「ベースライン」リビジョンを autogenerate で作成。
3. backend/app/main.py の lifespan: create_all は「DEV_AUTO_CREATE=true のときのみ」に限定し、
   既定では実行しない（本番は alembic upgrade head を別途実行する想定）。
4. backend/app/shared/db/postgres.py に async トランザクションヘルパーを追加:
   @asynccontextmanager async def transaction(): 1つの AsyncSession を yield し、
   正常時 commit / 例外時 rollback。複数 db_* 操作を同一トランザクションで実行できるようにする。
5. README か CLAUDE.md に「スキーマ変更時は必ず alembic revision --autogenerate → upgrade head」を明記。

制約: shared/db 以外は変更しない（main.py の create_all 分岐のみ例外的に触る）。
DoD: alembic upgrade head で全テーブル・全カラムが作成される / 既存カラム漏れが解消 /
     transaction() ヘルパーが利用可能。作業後 session_log に結果を追記。
```

---

## FIX-2 ── billing + audit_log：クレジット台帳・監査ログ・単価API

**対象 Issue**: ④（credit_usage 台帳・audit_log が無い）／②の backend 側（単価API）
**優先度**: 高（Phase 7-0 と同時推奨）

### 問題と理由
現在クレジット消費は `agency_members.monthly_credit_used` の**カウンタ更新のみ**で、「いつ・誰が・何に・何クレジット使ったか」の**台帳が存在しない**。Core の `audit_log` も Phase 1 時点でスタブのまま。SSOT（Billing）は `credit_usage(initiated_by …)` を定義しており、Phase 7 の自動実行も `initiated_by` 記録を要求する。

### 影響
- 顧客から「なぜ20cr減ったのか」と問われても**追跡・説明ができない**（課金紛争リスク）。
- 自動実行（Phase 7）が始まると消費イベントが増え、台帳が無いとデバッグも不能。
- ②のフロント表示ズレ（15/20）も、単価を返す API が無いためフロントがハードコードに頼っている根本原因。

### 対策
1. `credit_usage` 台帳テーブルを新規作成（SSOT 準拠）。`consume_credit()` 実行時に必ず1行記録。
2. `audit_logs` テーブルと最小の記録関数を実装（最低限：クレジット消費・課金・メンバー変更）。
3. `GET /billing/credit-costs` を追加し、`plans.py` のクレジット単価を返す（②のフロント修正がこれを参照）。
4. ※`api_credits`（agency全体枠）追加と同じ Phase 7-0 でまとめて入れると効率的。

### 📋 コピペ用プロンプト
```
FIX-2: billing と audit_log にクレジット台帳・監査ログ・単価APIを追加します。
（Phase 7-0 の api_credits 追加と同じセッションでまとめてよい）
session_log に「予定」を先に記入。

背景（問題）:
- クレジット消費が agency_members のカウンタ更新のみで、消費台帳が無い。誰が何に使ったか追えず
  課金紛争に対応できない。audit_log はスタブのまま。フロントは単価をハードコード(15)している。

作業:
1. shared/db/models.py に credit_usage を追加（FIX-1 適用済み前提で alembic revision を作る）:
   credit_usage(id PK, agency_id FK, child_account_id/ member_id FK NULL, amount, usage_type,
                resource_id, client_id NULL, balance_after, initiated_by NULL, created_at)
2. billing/services.py の consume_credit（check_and_deduct）を、消費成功時に credit_usage へ1行
   INSERT するよう修正。initiated_by を引数で受け取る（自動実行は schedule.member_id を渡す）。
3. shared/db/models.py に audit_logs を追加し、core/audit_log に record_log(user_id, action,
   resource_type, resource_id, details) を実装。最低限クレジット消費・課金Webhook・メンバー変更で呼ぶ。
4. billing/router.py に GET /billing/credit-costs を追加し、plans.py の単価表をそのまま返す。

制約: 変更は billing と audit_log（+models/alembic）に限定。consume_credit の呼び出し側シグネチャ
      変更がある場合は呼び出し元の引数追加のみ行い、ロジックは変えない。
DoD: 診断/最適化/記事生成のたびに credit_usage に行が残る / audit_logs に主要操作が残る /
     GET /billing/credit-costs が plans.py と一致した単価を返す。
```

---

## FIX-3 ── authentication / deps：セッション照合・httpOnly・トランザクション

**対象 Issue**: ③（失効が効かない恐れ）／⑤の backend 側（refresh を httpOnly cookie に）／⑥（signup 非トランザクション）
**優先度**: 高

### 問題と理由
- **③**: `deps.py` は `jwt.decode` のみで、**セッションテーブルを照合していない可能性**がある。アクセストークンが TTL（数十分〜1時間）切れるまで、DB 上で失効・強制ログアウトしたセッションでも保護 API を通してしまう。「1ブラウザのみ／旧セッション失効」の前提が崩れる。
- **⑤(backend)**: フロントが refresh token を localStorage に置くのは XSS で盗まれる。サーバ側で **httpOnly + Secure + SameSite cookie** として発行すれば JS から読めなくなる。
- **⑥**: signup が User→Agency→AdminMember→Session を個別書き込みしており、途中失敗で**孤児レコード**が残り得る。

### 対策
1. `deps.py` の認証依存で、JWT 検証に加え **`session_id`（クレームまたは X-Session-Id ヘッダ）を DB 照合**し、status=active かつ未失効でなければ 401。負荷が気になるなら短 TTL アクセストークン＋セッションキャッシュで緩和。方針（照合 or 短TTL）を session_log に明記。
2. login / refresh で **refresh_token を httpOnly Cookie** で返す。`/auth/refresh` は Cookie から読む。access_token はメモリ保持（フロントは FIX-4 で対応）。CSRF 対策として SameSite=Lax 以上、必要なら CSRF トークン併用。
3. signup を FIX-1 の `transaction()` で囲み、失敗時に全ロールバック。

### 📋 コピペ用プロンプト
```
FIX-3: authentication と認証依存(deps.py) を堅牢化します。FIX-1 のトランザクションヘルパー前提。
session_log に「予定」を先に記入。

背景（問題）:
- deps.py が jwt.decode のみでセッションをDB照合していない疑い。失効・強制ログアウトが
  アクセストークンTTL切れまで効かず、「1ブラウザのみ」制御が崩れる。
- refresh token を localStorage 保存しており XSS リスク（サーバ側を httpOnly cookie 化する）。
- signup の複数テーブル書き込みが非トランザクションで孤児レコードの恐れ。

作業:
1. shared/api/deps.py: get_current_user で JWT 検証後、session_id(クレーム or X-Session-Id) を
   sessions テーブルで照合。status!=active / 失効済みなら 401。
   （照合コスト回避のため access_token TTL を短縮し refresh 前提にする選択も可。採用方針をコメント明記）
2. core/authentication/services.py: login/refresh で refresh_token を
   httpOnly + Secure + SameSite=Lax の Cookie として Set-Cookie。/auth/refresh は Cookie から取得。
   access_token は従来どおりレスポンスボディで返す（フロントはメモリ保持に変更予定）。
3. core/authentication/services.py: signup を FIX-1 の transaction() で囲み、
   User→Agency→AgencyMember→Session を1トランザクションに。例外時はロールバック。

制約: 変更は authentication / deps / (cookie設定に伴う) config のみ。フロントは FIX-4 で別途対応。
DoD: 失効済みセッションのトークンで保護APIが401になる / refresh が httpOnly cookie 経由で成功 /
     signup 途中失敗で部分レコードが残らない。
```

---

## FIX-4 ── frontend：トークン保存方式・クレジット表示

**対象 Issue**: ⑤の frontend 側／②の frontend 側
**優先度**: 高（FIX-2・FIX-3 の後）

### 問題と理由
- **⑤**: `api.ts` / `auth-context.tsx` が access/refresh を localStorage 保存。FIX-3 で refresh を httpOnly cookie 化したら、**フロントは refresh を保持しない**設計に合わせる。access は**メモリ（変数/Context）保持**にし、リロード時は `/auth/refresh`（cookie）で復元。
- **②**: `diagnoses/new/page.tsx` が「詳細15cr」をハードコード。backend は20crに変更済みで**表示と実消費がズレている**。

### 対策
1. refresh の localStorage 保存を廃止。access token はメモリ保持、起動時に refresh で再取得。
2. クレジット単価を `GET /billing/credit-costs`（FIX-2）から取得して表示。ハードコード撤廃。
3. melta-ui トークン準拠を維持（独自デザイン生成禁止）。

### 📋 コピペ用プロンプト
```
FIX-4: フロントの認証トークン保存とクレジット表示を修正します。FIX-2/FIX-3 適用済み前提。
session_log に「予定」を先に記入。デザインは melta-ui トークン準拠（独自生成禁止）。

背景（問題）:
- refresh token を localStorage 保存（XSS リスク）。バックエンドが httpOnly cookie 化したので合わせる。
- diagnoses/new で詳細診断コストが 15cr ハードコードだが、実消費は 20cr で表示がズレている。

作業:
1. lib/api.ts / lib/auth-context.tsx:
   - refresh_token の localStorage 保存・読込を削除（cookie 任せ）。
   - access_token はメモリ（Context state）保持に変更。アプリ起動時に POST /auth/refresh（cookie）で
     access を復元するブートストラップを実装。401時の自動リフレッシュも cookie 経由に。
2. app/dashboard/diagnoses/new/page.tsx:
   - 「シンプル5cr / 詳細15cr」のハードコードを撤廃し、GET /billing/credit-costs から取得して表示。
3. ログアウト時はサーバの cookie 失効（/auth/logout）も呼ぶ。

制約: 変更はフロントの認証・診断作成画面まわりに限定。
DoD: localStorage に refresh_token が残らない / リロードしても cookie で復帰 /
     詳細診断の表示コストが backend(20cr) と一致。
```

---

## FIX-5 ── diagnosis：部分成功時の課金・raw_evidence 保持方針

**対象 Issue**: ⑩（部分成功課金）／⑪（raw_evidence 肥大化）
**優先度**: 中

### 問題と理由
- **⑩**: detailed 診断は Gemini+GPT-4o 並列で「片方失敗でも継続」する設計。だが**片方しか返らない or 両方失敗でも満額20cr引く**と、SSOT 7.3「有効な結果が得られた場合のみ消費」に反する。
- **⑪**: `raw_evidence`（Tavily 本文＋各AI生回答）を診断ごとに JSONB 保存。Automation（週次/月次）で件数が急増し、**DB が肥大化**する。

### 対策
1. 課金は「事前チェック＋成功後 commit」。**有効な LLM 結果が0件なら課金せず failed**、1件以上なら課金（必要なら degraded フラグ）。FIX-2 の credit_usage にも結果状態を残す。
2. `raw_evidence` に保持方針を導入：保存はするが**保持期間（例 90日）**を設け、Automation worker で期限切れを purge。または raw は要約＋ハッシュのみ保存に縮小（方針を session_log に明記）。

### 📋 コピペ用プロンプト
```
FIX-5: diagnosis の部分成功課金と raw_evidence 保持方針を修正します。
session_log に「予定」を先に記入。

背景（問題）:
- detailed 診断は片方LLM失敗でも継続するが、満額課金だと「有効な結果が得られた場合のみ消費」
  (SSOT 7.3) に反する。
- raw_evidence(Tavily本文+各AI生回答)を毎回保存しており、自動実行で DB が肥大化する。

作業:
1. modules/diagnosis/services.py（detailed）:
   - 有効な LLM 応答が 0 件 → クレジットを消費せず status=failed で終了（理由を記録）。
   - 1 件以上 → 従来通り課金。ただし片側欠落時は diagnoses に degraded=true 相当のフラグを残す。
   - 課金は「実行前チェック → 成功確定後に consume」の順序を厳守。
2. raw_evidence 保持方針:
   - diagnoses に retain_until（created_at + 90日）を持たせる、もしくは保存内容を要約＋元URL＋ハッシュに
     縮小する。どちらを採るか session_log に明記して実装。
   - 期限purgeは Phase 7 の worker tick に「retain_until 経過分の raw_evidence を NULL 化」する軽処理を足す
     （実処理は Phase 7b、本FIXでは方針確定とカラム/設計の用意まで）。

制約: 変更は diagnosis（+models/alembic）に限定。billing 連携は consume 呼び出し方法のみ。
DoD: 有効結果0件で課金されない / 片側失敗が記録される / raw_evidence の肥大化対策方針が
     スキーマ/コードに反映されている。
```

---

## FIX-6 ── optimization：実装チェックリスト生成

**対象 Issue**: ⑧（SSOT Module E の checklist が未実装）
**優先度**: 中

### 問題と理由
SSOT Module E は成果物として JSON-LD / 紹介文 / robots.txt / FAQ に加え **`checklist`（実装チェックリスト）** を定義しているが、Phase 5 の生成物は5種でチェックリストが含まれていない。代理店が「貼るだけ」を実務で回すための手順書が欠ける。

### 対策
`Optimization` に `checklist` JSONB を追加し、`_generate_artifacts()` で「実装手順チェックリスト」を生成（例：JSON-LD を head に設置 → robots.txt 差し替え → FAQ ページ作成 → 反映確認、の各ステップ）。ダウンロード対象にも追加。FIX-1 適用後に alembic revision で列追加すること。

### 📋 コピペ用プロンプト
```
FIX-6: optimization に実装チェックリスト生成を追加します。FIX-1 適用済み前提（列追加は alembic）。
session_log に「予定」を先に記入。

背景（問題）:
- SSOT Module E は checklist（実装チェックリスト）を成果物に含むが、Phase 5 では未生成。
  代理店が「貼るだけ」を実務で進めるための手順書が欠けている。

作業:
1. shared/db/models.py: Optimization に checklist JSONB を追加（alembic revision）。
2. modules/optimization/services.py の _generate_artifacts():
   - 生成済み成果物（JSON-LD/robots/FAQ/紹介文）に対応する「実装手順チェックリスト」を生成。
     各ステップ: {step, target_file_or_location, action, done:false} の配列。
3. router の GET /optimizations/{id}/download/{artifact} の artifact に checklist を追加。

制約: 変更は optimization（+models/alembic）に限定。
DoD: 最適化生成時に checklist が作られ、ダウンロードできる。
```

---

## FIX-7 ── docs / policy：シム負債方針・ログ注記・UI 未実装の明示

**対象 Issue**: ⑦（Firestore風シムの負債）／⑫（ログのv3/v4混在）／⑨（Optimization/Content の UI 未実装）
**優先度**: 低（ただし早めに）

### 問題と理由
- **⑦**: `db_get/db_set/db_query` の Firestore 風シムは移行を速めたが、JOIN・トランザクション・整合性を捨てている。既に `db_set` の upsert で PK 除外バグを踏んでいる。重い集計（Phase 7a 月次レポートの時系列集約、差分算出）をシムで書くと脆い。
- **⑫**: session_log が v3.0.0 build と v4-rebuild の Phase 番号を混在表記しており、後続が迷う。
- **⑨**: Optimization / Content はバックエンドのみで dashboard UI が無い（Phase 8 予定）。営業デモ前に認識が必要。

### 対策
方針・注記の文書化のみ（コード変更なし）。CLAUDE.md にシム使用方針を追記し、session_log とフロント計画に注記を入れる。

### 📋 コピペ用プロンプト
```
FIX-7: ドキュメント/方針を更新します（コード変更なし）。session_log に「予定」を先に記入。

作業:
1. backend/CLAUDE.md に追記:
   「新規の集計・結合・複数テーブル更新（例: 月次レポートの時系列集約、差分算出、signup）は
    db_* シムを使わず、SQLAlchemy ORM/生SQL＋transaction() で実装する。db_* シムは
    単純な単一レコードの get/set 用途に限定する。」
2. docs/session_log.md 冒頭に注記:
   「v3.0.0 build の記録は 〜2026-06-22 の前半。v4-rebuild は『Phase 0: 共通基盤』以降。
    Phase 番号は v4-rebuild 系を正とする。」
3. フロント計画（Phase 8）のメモに「Optimization / Content は現状バックエンドのみ。
   dashboard/optimizations・dashboard/contents の UI は Phase 8 で追加。デモ時は API 直叩き」と明記。

制約: ドキュメントのみ。コード・スキーマは変更しない。
DoD: CLAUDE.md にシム方針 / session_log に v3/v4 注記 / Phase 8 メモに UI 未実装の明示。
```

---

## 付録：Issue → FIX 対応表

| Issue | 内容 | 対応 FIX | モジュール/領域 |
|------|------|----------|----------------|
| ① | create_all がカラム追加を反映しない | FIX-1 | shared/db |
| ② | クレジット表示と消費の不一致(15/20) | FIX-2(API)+FIX-4(表示) | billing / frontend |
| ③ | セッション失効が効かない恐れ | FIX-3 | authentication/deps |
| ④ | credit_usage 台帳・audit_log 無し | FIX-2 | billing / audit_log |
| ⑤ | refresh token を localStorage 保存 | FIX-3(backend)+FIX-4(front) | authentication / frontend |
| ⑥ | signup が非トランザクション | FIX-1(helper)+FIX-3(適用) | shared/db / authentication |
| ⑦ | Firestore風シムの技術的負債 | FIX-7 | docs/policy |
| ⑧ | Optimization に checklist 無し | FIX-6 | optimization |
| ⑨ | Optimization/Content の UI 未実装 | FIX-7 | docs（Phase 8で実装） |
| ⑩ | 多LLM部分成功時の課金 | FIX-5 | diagnosis |
| ⑪ | raw_evidence の肥大化 | FIX-5 | diagnosis（purgeは7b） |
| ⑫ | ログのv3/v4混在 | FIX-7 | docs |

---

**運用メモ**: 各 FIX は独立適用可能だが、依存関係は FIX-1 →（FIX-2/FIX-3/FIX-6）、FIX-3 → FIX-4、FIX-2 → FIX-4 の順。Phase 7 の `api_credits`/`diagnoses.source`/`automation_schedules` 追加は FIX-1 導入後の alembic revision として行うこと。
