# LLMO Score - 再設計指示

## ⚠️ 重要：過去の設計書は全て破棄

これまでに作成した以下の設計書・コードは **すべて破棄** してください。
過去の設計はビジネスモデルの前提が間違っていました。

破棄対象：
- 過去に作成した全ての設計書（app-design.md, pricing-and-report-design.md 等）
- 過去の設計に基づいて実装したコード
- 過去のモジュール構成・フォルダ構成
- 過去の課金設計・ユーザーモデル

**過去の設計で参照・流用してよいものはありません。**

---

## 📄 新しい設計書

以下のファイルが唯一の正式な設計書です。
このファイルの内容に **完全に従って** ゼロから再構築してください。

```
G:\マイドライブ\antigravity\LLMO_Score\docs\design document\LLMO-Score-COMPLETE-FINAL.md
```

まずこのファイルを読み込み、全体を把握してから作業を開始してください。

---

## 🔄 何が変わったか

過去の設計と今回の設計は根本的に異なります。

### ビジネスモデルの変更

```
❌ 過去: 一般の中小企業が直接使う SaaS
✅ 今回: Web制作会社（代理店）が使う B2B SaaS

❌ 過去: 中小企業が自分で診断を実行
✅ 今回: 代理店の従業員がクライアントのURLを診断

❌ 過去: 中小企業に直接課金
✅ 今回: 代理店に月額サブスクで課金
```

### アカウント構造の変更

```
❌ 過去: 1アカウント = 1ユーザー
✅ 今回: 親アカウント（代理店）+ 子アカウント（従業員）

❌ 過去: 同時ログイン不可
✅ 今回: 子アカウントごとに独立セッション（同時ログインOK）

❌ 過去: アカウント数で課金
✅ 今回: 子アカウント数 × 1子あたりクレジットで課金
```

### 診断フローの変更

```
❌ 過去: 企業名 + 業種を入力して診断
✅ 今回: クライアントのURL + キーワードで診断

❌ 過去: キーワードはユーザーが手入力
✅ 今回: キーワードジェネレーターが自動提案（Google Places + Gemini）
```

### モジュール構成の変更

```
❌ 過去: Diagnosis, Reporting, Organization, Billing の4モジュール
✅ 今回: Agency, Client, Diagnosis, Keyword, Reporting, Billing, Automation の7モジュール
```

---

## 📋 実装指示

### 作業開始前の必須手順

1. `G:\マイドライブ\antigravity\LLMO_Score\docs\design document\LLMO-Score-COMPLETE-FINAL.md` を読み込む
2. 過去に作成したコード・設計ファイルをすべて削除する
3. `docs/session_log.md` を新規作成する
4. 作業内容（予定）を `docs/session_log.md` に記入する
5. 実装を開始する

### 実装順序（設計書 第10章に準拠）

```
Phase 1（Week 1-2）: Core層
  1. Authentication Module
  2. User Management Module
  3. Session Management Module（親子アカウント対応）
  4. Authorization Module（Admin/Staff/Viewer）
  5. Audit Log Module
  6. Notification Module
  7. Payment Module
  8. File Management Module
  9. Settings Module

Phase 2（Week 2）: 基盤 Business Modules
  10. Agency Module（代理店管理）
  11. Client Module（クライアント + URL管理）

Phase 3（Week 2-3）: 主要 Business Modules
  12. Keyword Module（Google Places + Gemini）
  13. Diagnosis Module（URL診断 + Gemini）
  14. Reporting Module（PDF + 代理店ブランディング + 配信）

Phase 4（Week 3-4）: 課金・自動化
  15. Billing Module（親子アカウント + クレジット + Stripe）
  16. Automation Module（月次自動実行）

Phase 5（Week 4）: 統合テスト・デプロイ
```

### 開発ルール（必ず守ること）

1. **1回の変更は1モジュールのみ**
2. **作業前に** `docs/session_log.md` に「作業内容（予定）」を記入
3. **作業後に** `docs/session_log.md` に「作業結果」を追記
4. 他モジュールのDBへ直接アクセス禁止（Service API経由のみ）
5. 推測実装禁止（不明点は質問する）
6. `session_log.md` の上書き・削除禁止

### フォルダ構成（設計書 第4章に準拠）

```
llmo-score/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── authentication/
│   │   │   ├── authorization/
│   │   │   ├── user_management/
│   │   │   ├── session_management/
│   │   │   ├── audit_log/
│   │   │   ├── notification/
│   │   │   ├── payment/
│   │   │   ├── file_management/
│   │   │   └── settings/
│   │   ├── modules/
│   │   │   ├── agency/
│   │   │   ├── client/
│   │   │   ├── diagnosis/
│   │   │   ├── keyword/
│   │   │   ├── reporting/
│   │   │   ├── billing/
│   │   │   └── automation/
│   │   ├── shared/
│   │   │   ├── api/
│   │   │   ├── db/
│   │   │   ├── utils/
│   │   │   └── constants/
│   │   ├── main.py
│   │   └── config.py
│   ├── tests/
│   ├── docs/
│   │   ├── architecture/
│   │   │   └── module-plan.md
│   │   └── session_log.md
│   ├── requirements.txt
│   ├── Dockerfile
│   └── CLAUDE.md
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   └── dashboard/
│   │       ├── clients/
│   │       ├── diagnoses/
│   │       ├── keywords/
│   │       ├── reports/
│   │       ├── billing/
│   │       ├── automation/
│   │       └── settings/
│   ├── components/
│   │   ├── core/
│   │   ├── modules/
│   │   └── shared/
│   ├── lib/
│   └── types/
│
└── CLAUDE.md
```

---

## ✅ 成功基準

- [ ] 過去の設計・コードが完全に削除されている
- [ ] 新しいフォルダ構成が設計書通りに作成されている
- [ ] 代理店（親アカウント）+ 子アカウントの認証が動作する
- [ ] 子アカウントごとの独立セッションが動作する
- [ ] クライアントのURL登録・管理ができる
- [ ] キーワードジェネレーターが動作する（Google Places + Gemini）
- [ ] URL診断が動作する（Gemini）
- [ ] レポートPDFが代理店ロゴ入りで生成される
- [ ] 子アカウント別のクレジット管理が動作する
- [ ] Stripe サブスク課金が動作する
- [ ] 月次自動実行が動作する
- [ ] docs/session_log.md に全作業が記録されている

---

**設計書を読み込んだ上で、Phase 1 から開始してください。**
