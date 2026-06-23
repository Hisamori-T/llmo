# LLMO Score — SSOT 追記差分（Phase 7 確定事項）

**対象 SSOT**: `LLMO-Score-COMPLETE-FINAL-v4.md`
**適用後バージョン**: v4.0 → **v4.1**
**作成日**: 2026-06-22
**目的**: Phase 7（Automation）実装に先立ち、設計書に未記載だった確定判断を SSOT へ反映する

> 使い方: 各「▼ 追記場所」の指示に従い、下記ブロックを設計書の該当箇所へ貼り込む。既存記述の置換指示がある場合はその行を差し替える。

---

## 0. この差分で確定する判断（一覧）

| # | 確定事項 | 反映先 |
|---|----------|--------|
| 1 | `diagnoses.source` 追加（manual/automation_monthly/automation_weekly, default=manual） | 第6章 Module C |
| 2 | 月次レポートは Reporting の責務。単月版/推移版を件数で出し分け、直近6回分の月次診断を年月集約 | 第6章 Module G、7.3 |
| 3 | スケジューラは worker 内 APScheduler（DBポーリング型 tick）。execution_day 規約・next_execution 初期計算 | 第6章 Module I、7.3 |
| 4 | ハルシネーション検知 = A（2社相反）+ B（前回比急変）を常時、C（一次情報突合）は条件付き | 第6章 Module I、7.3 |
| 5 | 通知先解決 = recipients 指定 → 未指定なら admin 全員。insufficient_credits は admin 限定 | 第6章 Module I、7.3 |
| 6 | 自動実行クレジットは agency 全体枠（`api_credits`）から消費。member_id は監査記録。不足時は warning スキップ・リトライ無し | 第6章 Module H、Module I、7.3 |
| 7 | `api_credits` テーブル新規。リセットは tick 内で遅延評価 | 第6章 Module H |
| 8 | Slack/LINE の webhook/トークンは `agency.settings.notification_channels` に保持し、アクセサで抽象化（シークレットはマスキング） | 第6章 Module I（Notification 5.6 と整合） |

---

## 1. 第6章 Module C: Diagnosis 追記

**▼ 追記場所**: Module C の `diagnoses` テーブル定義に列を1本追加。

```
+ source ENUM('manual','automation_monthly','automation_weekly') NOT NULL DEFAULT 'manual'
```

**▼ 追記文（テーブル定義直後に挿入）**

> **source 列の運用ルール**
> - 既存行・手動診断（既存 router 経由）は `default='manual'` に倒れる。Diagnosis 本体のロジックは変更しない。
> - `source` を明示セットするのは **Automation の execute() のみ**（書き込み側の責務）。月次自動実行は `automation_monthly`、週次監視は `automation_weekly` を渡す。
> - この列は月次レポートの「年月ごと代表値集約」（Module G）と、監視の差分基準特定に用いる。

---

## 2. 第6章 Module G: Reporting 追記

**▼ 追記場所**: Module G の公開API群の直後に「月次レポート仕様」節を追加。

> ### 月次レポート仕様（generate_monthly_report）
>
> **責務分界**: 月次レポートの生成は Reporting の責務。Automation は `generate_monthly_report(client_id, month)` を**呼ぶだけ**で、PDF の中身・テンプレートは関知しない（依存方向: Automation → Reporting）。
>
> **入力**: `automation_logs.diff` ＋ 過去 `diagnoses` の時系列。
>
> **時系列の取得規約**:
> - 「直近6ヶ月」ではなく **「直近6回分の月次診断」** を取得する。
> - 同月に週次監視ぶきの診断が複数存在しうるため、**年月をキーに各月1点へ代表値集約**する。
> - 代表値の選定優先順位: `source='automation_monthly'` の診断 → 無ければその月の最新 `diagnoses`。
>
> **件数による出し分け（最小条件）**:
>
> | 取得できた月次点数 | 出力 | 内容 |
> |---|---|---|
> | 1件（初回月） | 単月版 1-2p | 今月スコア / AI別認識 / 所見 / 来月施策（推移グラフは単点 or 省略） |
> | 2件以上 | 推移版 4-6p | スコア推移グラフ / 前回比 diff / ハルシネーション有無 / 来月施策 |
>
> グラフ部のみ件数で分岐し、その他セクションは共通実装とする。「推移が描けない＝レポート無し」にはしない（月額サービスの体裁を保つ）。
>
> **公開API 追加**: `generateMonthlyReport(client_id, month) → {report_id}`（種別 `monthly`）。

---

## 3. 第6章 Module I: Automation 追記（中核）

**▼ 置換**: `automation_schedules` テーブル定義を以下で差し替え（`execution_day` 規約の明確化と `recipients` / `execution_time` 追加）。

```
automation_schedules(
  id PK, agency_id FK, client_id FK, member_id FK,        -- member_id=作成者（監査用）
  schedule_type ENUM('weekly','monthly','custom'),
  execution_day  INT,        -- monthly:1-28 / weekly:0-6（0=Mon..6=Sun, Python weekday準拠）
  execution_time TIME DEFAULT '09:00',                    -- Asia/Tokyo 固定実行時刻
  channels  JSONB,           -- 送信チャネル選択 ["email","slack","line"]
  recipients JSONB NULL,      -- {user_ids:[...], extra_emails:[...]} 未指定→admin全員にフォールバック
  tasks     JSONB,
  last_execution TIMESTAMPTZ, next_execution TIMESTAMPTZ,
  status ENUM('active','paused'), created_at TIMESTAMPTZ
)
```

**▼ 追記文（テーブル群の直後に4つの仕様節を追加）**

> ### I-1. スケジューラ方式（worker 内 APScheduler / DBポーリング型）
> - 定期ジョブは **api コンテナと分離した専用 worker コンテナ**で実行（重い多LLM処理を API から隔離）。
> - worker は **1分間隔の tick** で `next_execution <= now()` の `active` 行を拾うディスパッチャ型。`automation_schedules` が**スケジュールの正本**。
> - 多重発火防止: 取得は **`FOR UPDATE SKIP LOCKED`**（将来 worker 複数化しても重複実行しない）。
> - レート/原価制御: 同時実行を **`Semaphore`（初期3）** で絞る。タイムゾーンは **`Asia/Tokyo`**。
> - cron 構文は使用しない（DB駆動の動的スケジュールのため）。将来 Celery/Dramatiq へ移す場合も「tick が `automation_service.execute()` を呼ぶ」境界を保てば呼び出し元差し替えのみで済む。
>
> ### I-2. execution_day 規約と next_execution 初期計算
> - **monthly**: `execution_day` は **1〜28 の整数**（29以上はバリデーションで拒否。将来「月末」は `-1` センチネルで別扱い）。
> - **weekly**: `execution_day` は **0〜6（0=月 … 6=日、Python `date.weekday()` 準拠）**。cron/JS の日=0系と取り違えないこと。
> - **next_execution 初期値**: 「**作成日以降の最初の該当日**」（未来日）。**作成時の即時実行はしない**（予期せぬクレジット消費・初回手動診断との重複を回避）。当日が `execution_day` と一致する場合は**翌周期**へ送る。
> - 時刻は `execution_time`（既定 JST 09:00）で固定し、tick の1分粒度とズレないようにする。
> - 即時に1回走らせたい要件は、自動スケジュールとは経路を分け `executeManually(schedule_id)`（公開API）で対応する。
>
> ### I-3. ハルシネーション検知ロジック（hallucination_findings の確定仕様）
> 基本は **A＋B を常時**、**C は一次情報がある場合のみ**の条件付き。
>
> | type | 判定 | 前提 | severity/alert |
> |------|------|------|----------------|
> | `conflict` | 同一キーワードで Gemini と GPT-4o の `mention` が割れる／事実主張（住所・代表名・事業内容等）が矛盾 | 常時（2社回答） | warning |
> | `regression` | 前回 `mentioned → not_mentioned` への転落、スコア大幅下落、新規ネガティブ文脈の出現 | 常時（前回診断あれば） | critical（転落時） |
> | `factual_mismatch` | AI回答が一次情報 `content_sources` と矛盾 | `content_sources` がある場合のみ | warning |
>
> 実装注意:
> - `conflict` の一次判定は**構造化フィールド（`mention`/`quality`）の食い違い**で行う（文字列一致では拾えない）。事実主張レベルの矛盾抽出は「2回答が矛盾する事実を列挙せよ」と**LLMに判定させる追加1回呼び出し**で補完し、その原価をクレジットに織り込む。
> - `factual_mismatch` は誤検知が出やすいため**補助フラグ**に留め、検知の前提条件には置かない。
>
> ```
> hallucination_findings = [
>   {type:"conflict",         keyword, gemini, gpt4o, severity},
>   {type:"regression",       keyword, prev:"mentioned", now:"not_mentioned"},
>   {type:"factual_mismatch", keyword, source_id, ai_claim, fact}
> ]
> ```
>
> ### I-4. 通知チャネルと送信先解決
> - **チャネル資格情報（Slack webhook URL / LINE チャネルトークン）は `agency.settings.notification_channels`** に代理店単位で保持し、**Notification Module のアクセサ `get_channel_config(agency_id, type)` 経由でのみ参照**する（保存先を呼び出し側に漏らさない。将来テーブル化しても呼び出し側無変更）。`automation_schedules.channels` には**送信先チャネルの選択のみ**を持たせ、URL 実体は持たせない。
> - シークレットはログ出力・APIレスポンスから**マスキング**必須。
> - **送信先（宛先）の解決**:
>   ```
>   targets = recipients.user_ids があればそれ
>             無ければ agency の admin ロール全員（フォールバック）
>           + recipients.extra_emails（顧客等・代理店外アドレス、任意）
>   ```
> - **アラート種別ごとの出し分け**:
>   ```
>   critical / warning（順位下落・ネガ情報）→ recipients → admin
>   insufficient_credits（クレジット不足）   → admin に限定（課金権限者）＋アップグレード誘導
>   月次レポート配信                          → recipients → admin（＋顧客送付時は extra_emails）
>   ```

---

## 4. 第6章 Module H: Billing 追記

**▼ 追記場所**: Module H の保持データに `api_credits` の確定定義を追加（SSOT 既出の項目を実装確定形へ）。

```
api_credits(
  id PK, agency_id FK UNIQUE,        -- 1代理店1行
  monthly_limit INT,                  -- プラン由来（設計書3.1「代理店全体クレジット/月」）
  monthly_used  INT DEFAULT 0,
  last_reset    DATE
)
```

**▼ 追記文**

> **api_credits の運用ルール（自動実行枠）**
> - 自動実行（Automation）のクレジットは**この代理店全体枠から消費**する。per-member の `agency_members.monthly_credit_used/limit`（手動枠）とは**別管理**とし、自動実行が手動作業の枠を食い潰さないようにする。
> - `monthly_limit` の初期値は**プラン（設計書3.1）由来**。プラン変更時に Billing が更新する。
> - **月次リセットは専用ジョブを増やさず、worker の tick 内で遅延評価**する：`last_reset` が当月でなければ `monthly_used=0`、`last_reset=今月` に更新。
> - 監査: 自動実行の消費は `credit_usage` に **`initiated_by = automation_schedules.member_id`（作成者）** を記録する。引き当て先は agency 枠、記録上の責任者は作成者、という分離。
>
> **公開API 追記**:
> ```
> consume_credit(agency_id, amount, usage_type, resource_id, initiated_by) → {remaining}
>   # usage_type 例: "automation_monthly" / "automation_weekly"
>   # 自動実行は agency 全体枠(api_credits)に引き当て、initiated_by を監査記録
> getAgencyCredits(agency_id) → {monthly_limit, monthly_used, remaining, last_reset}
> ```

---

## 5. 第7章 7.3: STEP3 監視・保守（確定版に差し替え）

**▼ 置換**: 7.3 の処理フローを以下の確定版で差し替え。

> ## 7.3 STEP3: 監視・保守（確定仕様）
>
> **実行基盤**: 専用 worker コンテナ内の APScheduler（DBポーリング型 tick・1分間隔・`Asia/Tokyo`）。`automation_schedules` を正本とし、`next_execution <= now()` の `active` 行を `FOR UPDATE SKIP LOCKED` で取得、`Semaphore` で同時実行を制御。
>
> **execute(schedule_id) の処理順**:
> ```
> 0. クレジット事前チェック（診断を走らせる前に api_credits 残量を確認）
>    └ 不足 → 診断を実行しない。automation_logs に alert_level="warning",
>             reason="insufficient_credits" を記録。next_execution を次の本来の周期へ前進
>             （毎分 tick で同じ行を掴まない）。admin に不足通知＋アップグレード誘導。終了。
> 1. 再診断（多LLM: Gemini 2.5 + GPT-4o ＋ Tavily）。diagnoses に source="automation_monthly"
>    （週次は "automation_weekly"）で保存。
> 2. 前回診断との差分算出（スコア増減・順位変動）。
> 3. ハルシネーション検知（7.3-I3: conflict / regression / factual_mismatch）。
> 4. alert_level 判定 → critical/warning は即時アラート配信（送信先解決は I-4）。
> 5. クレジット消費を commit（成功後に consume。途中失敗時は課金しない）。
> 6. 月次タイミングのみ: reporting.generate_monthly_report() を呼び出し、サマリーPDFを生成・配信。
>    （週次はアラートのみ。月次でサマリーPDF、と分離）
> 7. next_execution / last_execution を更新。
> 8.（任意・将来）採用コンテンツのパターンを knowledge_base に蓄積（RAG）→ Content の精度向上。
> ```
>
> **クレジット挙動の要点**:
> - 引き当て先は **agency 全体枠（api_credits）**。member 個人枠ではない。
> - **事前チェック＋成功後 commit**。残量不足はエラーではなく状態なので**リトライしない**（毎分失敗ログの量産と、枠回復時の一斉発火による原価暴発を防止）。
> - 部分成功（片側 LLM 失敗等）の課金可否は別途規定（原則: 有効な結果が得られた場合のみ消費）。
>
> **LINE 実装メモ（再掲）**: LINE Notify は 2025/3 終了。LINE 公式アカウント＋Messaging API の `POST https://api.line.me/v2/bot/message/push` を使用。無料枠 月200通のため、アラートは critical/warning を優先送信。

---

## 6. 適用後の作業（参考・実装フェーズ）

この差分を SSOT へ反映後、実装は次の順で進める（rebuild prompt 側にも反映）。

```
Phase 7-0: スキーマ前提（models のみ・ロジック無し）
  7-0a. Billing:    api_credits テーブル新規
  7-0b. Diagnosis:  diagnoses.source 列追加（default='manual'）
  7-0c. Automation: automation_schedules に execution_day/execution_time/channels/recipients 確定
Phase 7a:  Reporting:  generate_monthly_report（単月/推移の出し分け・直近6回分の月次診断を年月集約）
Phase 7b:  Automation: worker内APScheduler・tick・差分・ハルシネーション検知(A+B+条件付きC)・
                       クレジット(agency枠/不足時warningスキップ)・通知(recipients→admin fallback)・月次配信
```

**バージョン**: 反映後の設計書冒頭を `バージョン: 4.1` に更新し、変更履歴に「v4.1: Phase 7（Automation）確定仕様を反映」を追記する。
