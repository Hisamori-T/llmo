"""SQLAlchemy models for all LLMO Score tables (v4.1 / PostgreSQL)."""
from sqlalchemy import Boolean, Column, Date, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = 'users'
    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255))
    email_verified = Column(Boolean, default=False)
    display_name = Column(String(255), default='')
    created_at = Column(String(64))
    updated_at = Column(String(64))


class Agency(Base):
    __tablename__ = 'agencies'
    id = Column(String(36), primary_key=True)
    name = Column(String(255))
    owner_user_id = Column(String(36))
    plan = Column(String(50), default='starter')
    billing_cycle = Column(String(50), default='monthly')
    status = Column(String(50), default='trial')
    included_child_accounts = Column(Integer, default=2)
    additional_child_accounts = Column(Integer, default=0)
    max_child_accounts = Column(Integer, default=5)
    credits_per_child = Column(Integer, default=100)
    included_clients = Column(Integer, default=10)
    additional_clients = Column(Integer, default=0)
    max_clients = Column(Integer, default=10)
    stripe_customer_id = Column(String(255))
    branding = Column(JSONB, default=dict)
    created_at = Column(String(64))
    updated_at = Column(String(64))


class AgencyMember(Base):
    __tablename__ = 'agency_members'
    id = Column(String(36), primary_key=True)
    agency_id = Column(String(36))
    user_id = Column(String(36))
    role = Column(String(50), default='admin')
    monthly_credit_limit = Column(Integer, default=100)
    monthly_credit_used = Column(Integer, default=0)
    credit_reset_date = Column(String(64))
    assigned_client_ids = Column(JSONB, default=list)
    active_session_id = Column(String(255))
    status = Column(String(50), default='active')
    invited_by = Column(String(36))
    joined_at = Column(String(64))


class Session(Base):
    __tablename__ = 'sessions'
    id = Column(String(36), primary_key=True)
    session_id = Column(String(255), unique=True, index=True)
    user_id = Column(String(36), index=True)
    agency_id = Column(String(36))
    member_id = Column(String(36))
    browser_name = Column(String(255), default='')
    browser_version = Column(String(50), default='')
    browser_id = Column(String(255), default='')
    os = Column(String(100), default='')
    os_version = Column(String(50), default='')
    ip_address = Column(String(50), default='')
    user_agent = Column(Text, default='')
    status = Column(String(50), default='active')
    revoke_reason = Column(String(100))
    last_activity = Column(String(64))
    created_at = Column(String(64))


class Client(Base):
    __tablename__ = 'clients'
    id = Column(String(36), primary_key=True)
    client_id = Column(String(36))
    agency_id = Column(String(36), index=True)
    name = Column(String(255))
    url = Column(String(500))
    industry = Column(String(100), default='')
    location = Column(String(100), default='')
    contact_name = Column(String(255), default='')
    contact_email = Column(String(255), default='')
    contact_phone = Column(String(50), default='')
    note = Column(Text, default='')
    tags = Column(JSONB, default=list)
    assigned_staff_ids = Column(JSONB, default=list)
    status = Column(String(50), default='active')
    settings = Column(JSONB, default=dict)
    latest_diagnosis_id = Column(String(36))
    latest_score = Column(Float)
    created_by = Column(String(36))
    created_at = Column(String(64))
    updated_at = Column(String(64))


class KeywordSet(Base):
    __tablename__ = 'keyword_sets'
    id = Column(String(36), primary_key=True)
    keyword_set_id = Column(String(36))
    client_id = Column(String(36), index=True)
    agency_id = Column(String(36))
    generated_by = Column(String(36))
    industry = Column(String(100), default='')
    location = Column(String(100), default='')
    target_url = Column(String(500), default='')
    competitor_data = Column(JSONB, default=list)
    keywords = Column(JSONB, default=list)
    market_analysis = Column(JSONB, default=dict)
    created_at = Column(String(64))


class Diagnosis(Base):
    __tablename__ = 'diagnoses'
    id = Column(String(36), primary_key=True)
    diagnosis_id = Column(String(36))
    client_id = Column(String(36), index=True)
    agency_id = Column(String(36), index=True)
    member_id = Column(String(36))
    url = Column(String(500), default='')
    keywords = Column(JSONB, default=list)
    type = Column(String(50), default='simple')
    status = Column(String(50), default='pending')
    scores = Column(JSONB)
    ai_analysis = Column(JSONB)        # AI別 mention/quality 結果
    keyword_analysis = Column(JSONB)   # キーワード別スコア
    site_analysis = Column(JSONB)      # schema/robots/sitemap/ssl 分析
    findings = Column(JSONB, default=list)
    recommendations = Column(JSONB, default=list)
    projections = Column(JSONB)        # 6ヶ月/12ヶ月予測
    raw_evidence = Column(JSONB)       # Tavily取得本文・各AI生回答
    source = Column(String(50), default='manual')  # manual | automation_monthly | automation_weekly
    degraded = Column(Boolean, default=False)  # 片側LLM失敗時に True（FIX-5）
    progress_stage = Column(String(32))        # generating_keywords|querying_llms|aggregating|completed|failed
    progress_detail = Column(JSONB)            # {"current": 3, "total": 8} — querying_llms 中のみ
    retain_until = Column(String(64))          # raw_evidence の保持期限（created_at+90日）
    credits_used = Column(Integer, default=5)
    created_at = Column(String(64))
    completed_at = Column(String(64))
    error = Column(Text)


class Report(Base):
    __tablename__ = 'reports'
    id = Column(String(36), primary_key=True)
    report_id = Column(String(36))
    diagnosis_id = Column(String(36), index=True)
    client_id = Column(String(36))
    agency_id = Column(String(36), index=True)
    type = Column(String(50), default='simple')
    status = Column(String(50), default='ready')
    share_token = Column(String(255))
    share_url = Column(String(500))
    credits_used = Column(Integer, default=2)
    created_at = Column(String(64))


class Invoice(Base):
    __tablename__ = 'invoices'
    id = Column(String(36), primary_key=True)
    invoice_id = Column(String(36))
    agency_id = Column(String(36), index=True)
    amount = Column(Integer, default=0)
    currency = Column(String(10), default='jpy')
    status = Column(String(50))
    period_start = Column(String(64))
    period_end = Column(String(64))
    pdf_url = Column(String(500))
    stripe_invoice_id = Column(String(255))
    created_at = Column(String(64))


class ContentSource(Base):
    __tablename__ = 'content_sources'
    id = Column(String(36), primary_key=True)
    source_id = Column(String(36))
    client_id = Column(String(36), index=True)
    agency_id = Column(String(36), index=True)
    member_id = Column(String(36))
    type = Column(String(50))           # interview | doc | url
    title = Column(String(500))
    body = Column(Text, default='')     # 本文テキスト
    source_url = Column(String(500))    # type=url の場合の参照URL
    created_at = Column(String(64))


class ContentArticle(Base):
    __tablename__ = 'content_articles'
    id = Column(String(36), primary_key=True)
    article_id = Column(String(36))
    client_id = Column(String(36), index=True)
    agency_id = Column(String(36), index=True)
    member_id = Column(String(36))
    diagnosis_id = Column(String(36))   # 弱依存（任意）
    target_keyword = Column(String(255))
    title = Column(String(500))
    outline = Column(JSONB)             # [{heading, summary}]
    body_markdown = Column(Text)        # Markdown本文
    geo_checklist = Column(JSONB)       # {citations, numbers, statistics, authority, conclusions}
    source_ids = Column(JSONB)          # 参照した一次情報 ID リスト
    status = Column(String(50), default='draft')  # draft | edited | published
    credits_used = Column(Integer, default=8)
    created_at = Column(String(64))
    updated_at = Column(String(64))


class ApiCredits(Base):
    __tablename__ = 'api_credits'
    id = Column(String(36), primary_key=True)
    agency_id = Column(String(36), unique=True, nullable=False, index=True)
    monthly_limit = Column(Integer, nullable=False, default=0)
    monthly_used = Column(Integer, nullable=False, default=0)
    last_reset = Column(String(10))  # YYYY-MM-DD


class AutomationSchedule(Base):
    __tablename__ = 'automation_schedules'
    id = Column(String(36), primary_key=True)
    agency_id = Column(String(36), index=True, nullable=False)
    client_id = Column(String(36), index=True, nullable=False)
    member_id = Column(String(36))                    # 作成者（監査用）
    schedule_type = Column(String(50), nullable=False)  # weekly | monthly | custom
    execution_day = Column(Integer)                   # monthly:1-28 / weekly:0-6(Python weekday)
    execution_time = Column(String(5), default='09:00')  # HH:MM (Asia/Tokyo固定)
    channels = Column(JSONB)                          # ["email","slack","line"]
    recipients = Column(JSONB)                        # {user_ids:[...], extra_emails:[...]}
    tasks = Column(JSONB)
    last_execution = Column(String(64))
    next_execution = Column(String(64), index=True)
    status = Column(String(50), default='active')     # active | paused
    created_at = Column(String(64))


class AutomationLog(Base):
    __tablename__ = 'automation_logs'
    id = Column(String(36), primary_key=True)
    schedule_id = Column(String(36), index=True)
    agency_id = Column(String(36), index=True)
    client_id = Column(String(36), index=True)
    executed_at = Column(String(64))
    diff = Column(JSONB)                              # 前回比（スコア増減・新規ネガ言及）
    alert_level = Column(String(50), default='none')  # none | positive | warning | critical
    hallucination_findings = Column(JSONB)
    tasks_completed = Column(JSONB)
    tasks_failed = Column(JSONB)
    credits_consumed = Column(Integer, default=0)
    error_details = Column(Text)


class Optimization(Base):
    __tablename__ = 'optimizations'
    id = Column(String(36), primary_key=True)
    optimization_id = Column(String(36))
    diagnosis_id = Column(String(36), index=True)
    client_id = Column(String(36), index=True)
    agency_id = Column(String(36), index=True)
    member_id = Column(String(36))
    status = Column(String(50), default='running')
    json_ld = Column(JSONB)         # schema.org 構造化データ
    ai_summary = Column(Text)       # AI向け会社紹介文
    robots_txt = Column(Text)       # robots.txt 推奨設定
    faq_structure = Column(JSONB)   # FAQ構成案 [{question, answer}]
    wp_preset = Column(JSONB)       # WordPress plugin preset (Yoast/SchemaPro)
    checklist = Column(JSONB)       # 実装手順チェックリスト [{step, target, action, done}]（FIX-6）
    credits_used = Column(Integer, default=10)
    created_at = Column(String(64))
    completed_at = Column(String(64))
    error = Column(Text)


class CreditUsage(Base):
    """クレジット消費台帳（FIX-2）。"""
    __tablename__ = 'credit_usage'
    id = Column(String(36), primary_key=True)
    agency_id = Column(String(36), index=True, nullable=False)
    member_id = Column(String(36), index=True)   # 消費者（手動操作）
    initiated_by = Column(String(36))            # 自動実行時はスケジュール作成者
    amount = Column(Integer, nullable=False)
    usage_type = Column(String(100))             # simple_diagnosis / detailed_diagnosis / etc.
    resource_id = Column(String(36))             # diagnosis_id / optimization_id 等
    client_id = Column(String(36))
    balance_after = Column(Integer)
    created_at = Column(String(64))


class AuditLog(Base):
    """監査ログ（FIX-2）。"""
    __tablename__ = 'audit_logs'
    id = Column(String(36), primary_key=True)
    agency_id = Column(String(36), index=True)
    user_id = Column(String(36), index=True)
    action = Column(String(100))                 # credit_consumed / member_invited / billing_webhook 等
    resource_type = Column(String(100))
    resource_id = Column(String(36))
    details = Column(JSONB)
    created_at = Column(String(64))
