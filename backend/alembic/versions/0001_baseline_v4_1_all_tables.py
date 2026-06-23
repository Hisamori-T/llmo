"""baseline v4.1 - all tables

Revision ID: 0001
Revises:
Create Date: 2026-06-23

Baseline migration: captures all tables defined in models.py at v4.1.
Run: alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────
    op.create_table('users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255)),
        sa.Column('email_verified', sa.Boolean(), default=False),
        sa.Column('display_name', sa.String(255), default=''),
        sa.Column('created_at', sa.String(64)),
        sa.Column('updated_at', sa.String(64)),
    )

    # ── agencies ───────────────────────────────────────────────────────────
    op.create_table('agencies',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255)),
        sa.Column('owner_user_id', sa.String(36)),
        sa.Column('plan', sa.String(50), default='starter'),
        sa.Column('billing_cycle', sa.String(50), default='monthly'),
        sa.Column('status', sa.String(50), default='trial'),
        sa.Column('included_child_accounts', sa.Integer(), default=2),
        sa.Column('stripe_customer_id', sa.String(255)),
        sa.Column('stripe_subscription_id', sa.String(255)),
        sa.Column('current_period_end', sa.String(64)),
        sa.Column('branding', postgresql.JSONB()),
        sa.Column('settings', postgresql.JSONB()),
        sa.Column('created_at', sa.String(64)),
        sa.Column('updated_at', sa.String(64)),
    )

    # ── agency_members ─────────────────────────────────────────────────────
    op.create_table('agency_members',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), nullable=False, index=True),
        sa.Column('user_id', sa.String(36), nullable=False, index=True),
        sa.Column('email', sa.String(255)),
        sa.Column('name', sa.String(255)),
        sa.Column('role', sa.String(50), default='staff'),
        sa.Column('monthly_credit_limit', sa.Integer(), default=100),
        sa.Column('monthly_credit_used', sa.Integer(), default=0),
        sa.Column('credit_reset_date', sa.String(64)),
        sa.Column('active_session_id', sa.String(36)),
        sa.Column('assigned_client_ids', postgresql.JSONB()),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('invited_by', sa.String(36)),
        sa.Column('joined_at', sa.String(64)),
    )

    # ── sessions ───────────────────────────────────────────────────────────
    op.create_table('sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False, index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('access_token_jti', sa.String(64)),
        sa.Column('refresh_token_hash', sa.String(255)),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('ip_address', sa.String(64)),
        sa.Column('user_agent', sa.String(500)),
        sa.Column('created_at', sa.String(64)),
        sa.Column('expires_at', sa.String(64)),
        sa.Column('last_active_at', sa.String(64)),
    )

    # ── clients ────────────────────────────────────────────────────────────
    op.create_table('clients',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), nullable=False, index=True),
        sa.Column('name', sa.String(255)),
        sa.Column('url', sa.String(500)),
        sa.Column('industry', sa.String(255)),
        sa.Column('location', sa.String(255)),
        sa.Column('contact_name', sa.String(255)),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('latest_diagnosis_id', sa.String(36)),
        sa.Column('latest_score', sa.Float()),
        sa.Column('tags', postgresql.JSONB()),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('created_at', sa.String(64)),
        sa.Column('updated_at', sa.String(64)),
    )

    # ── keyword_sets ───────────────────────────────────────────────────────
    op.create_table('keyword_sets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('keywords', postgresql.JSONB()),
        sa.Column('created_at', sa.String(64)),
    )

    # ── diagnoses ──────────────────────────────────────────────────────────
    op.create_table('diagnoses',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('diagnosis_id', sa.String(36)),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('url', sa.String(500), default=''),
        sa.Column('keywords', postgresql.JSONB()),
        sa.Column('type', sa.String(50), default='simple'),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('scores', postgresql.JSONB()),
        sa.Column('ai_analysis', postgresql.JSONB()),
        sa.Column('keyword_analysis', postgresql.JSONB()),
        sa.Column('site_analysis', postgresql.JSONB()),
        sa.Column('findings', postgresql.JSONB()),
        sa.Column('recommendations', postgresql.JSONB()),
        sa.Column('projections', postgresql.JSONB()),
        sa.Column('raw_evidence', postgresql.JSONB()),
        sa.Column('source', sa.String(50), default='manual'),
        sa.Column('degraded', sa.Boolean(), default=False),
        sa.Column('retain_until', sa.String(64)),
        sa.Column('credits_used', sa.Integer(), default=5),
        sa.Column('created_at', sa.String(64)),
        sa.Column('completed_at', sa.String(64)),
        sa.Column('error', sa.Text()),
    )

    # ── reports ────────────────────────────────────────────────────────────
    op.create_table('reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_id', sa.String(36)),
        sa.Column('diagnosis_id', sa.String(36), index=True),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('type', sa.String(50)),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('share_token', sa.String(64), index=True),
        sa.Column('credits_used', sa.Integer(), default=0),
        sa.Column('created_at', sa.String(64)),
    )

    # ── invoices ───────────────────────────────────────────────────────────
    op.create_table('invoices',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('amount', sa.Integer()),
        sa.Column('currency', sa.String(10), default='jpy'),
        sa.Column('status', sa.String(50)),
        sa.Column('stripe_invoice_id', sa.String(255)),
        sa.Column('stripe_payment_intent_id', sa.String(255)),
        sa.Column('description', sa.String(500)),
        sa.Column('created_at', sa.String(64)),
    )

    # ── api_credits ────────────────────────────────────────────────────────
    op.create_table('api_credits',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), nullable=False, unique=True, index=True),
        sa.Column('monthly_limit', sa.Integer(), nullable=False, default=0),
        sa.Column('monthly_used', sa.Integer(), nullable=False, default=0),
        sa.Column('last_reset', sa.String(10)),
    )

    # ── automation_schedules ───────────────────────────────────────────────
    op.create_table('automation_schedules',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), nullable=False, index=True),
        sa.Column('client_id', sa.String(36), nullable=False, index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('schedule_type', sa.String(50), nullable=False),
        sa.Column('execution_day', sa.Integer()),
        sa.Column('execution_time', sa.String(5), default='09:00'),
        sa.Column('channels', postgresql.JSONB()),
        sa.Column('recipients', postgresql.JSONB()),
        sa.Column('tasks', postgresql.JSONB()),
        sa.Column('last_execution', sa.String(64)),
        sa.Column('next_execution', sa.String(64), index=True),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('created_at', sa.String(64)),
    )

    # ── automation_logs ────────────────────────────────────────────────────
    op.create_table('automation_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('schedule_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('executed_at', sa.String(64)),
        sa.Column('diff', postgresql.JSONB()),
        sa.Column('alert_level', sa.String(50), default='none'),
        sa.Column('hallucination_findings', postgresql.JSONB()),
        sa.Column('tasks_completed', postgresql.JSONB()),
        sa.Column('tasks_failed', postgresql.JSONB()),
        sa.Column('credits_consumed', sa.Integer(), default=0),
        sa.Column('error_details', sa.Text()),
    )

    # ── optimizations ──────────────────────────────────────────────────────
    op.create_table('optimizations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('optimization_id', sa.String(36)),
        sa.Column('diagnosis_id', sa.String(36), index=True),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('status', sa.String(50), default='running'),
        sa.Column('json_ld', postgresql.JSONB()),
        sa.Column('ai_summary', sa.Text()),
        sa.Column('robots_txt', sa.Text()),
        sa.Column('faq_structure', postgresql.JSONB()),
        sa.Column('wp_preset', postgresql.JSONB()),
        sa.Column('checklist', postgresql.JSONB()),
        sa.Column('credits_used', sa.Integer(), default=10),
        sa.Column('created_at', sa.String(64)),
        sa.Column('completed_at', sa.String(64)),
        sa.Column('error', sa.Text()),
    )

    # ── content_sources ────────────────────────────────────────────────────
    op.create_table('content_sources',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('type', sa.String(50)),
        sa.Column('title', sa.String(500)),
        sa.Column('body', sa.Text()),
        sa.Column('source_url', sa.String(500)),
        sa.Column('created_at', sa.String(64)),
    )

    # ── content_articles ───────────────────────────────────────────────────
    op.create_table('content_articles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('client_id', sa.String(36), index=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('member_id', sa.String(36)),
        sa.Column('target_keyword', sa.String(255)),
        sa.Column('outline', postgresql.JSONB()),
        sa.Column('body_markdown', sa.Text()),
        sa.Column('geo_checklist', postgresql.JSONB()),
        sa.Column('source_ids', postgresql.JSONB()),
        sa.Column('status', sa.String(50), default='draft'),
        sa.Column('credits_used', sa.Integer(), default=8),
        sa.Column('created_at', sa.String(64)),
        sa.Column('updated_at', sa.String(64)),
    )

    # ── credit_usage ───────────────────────────────────────────────────────
    op.create_table('credit_usage',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), nullable=False, index=True),
        sa.Column('member_id', sa.String(36), index=True),
        sa.Column('initiated_by', sa.String(36)),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('usage_type', sa.String(100)),
        sa.Column('resource_id', sa.String(36)),
        sa.Column('client_id', sa.String(36)),
        sa.Column('balance_after', sa.Integer()),
        sa.Column('created_at', sa.String(64)),
    )

    # ── audit_logs ─────────────────────────────────────────────────────────
    op.create_table('audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('agency_id', sa.String(36), index=True),
        sa.Column('user_id', sa.String(36), index=True),
        sa.Column('action', sa.String(100)),
        sa.Column('resource_type', sa.String(100)),
        sa.Column('resource_id', sa.String(36)),
        sa.Column('details', postgresql.JSONB()),
        sa.Column('created_at', sa.String(64)),
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('credit_usage')
    op.drop_table('content_articles')
    op.drop_table('content_sources')
    op.drop_table('optimizations')
    op.drop_table('automation_logs')
    op.drop_table('automation_schedules')
    op.drop_table('api_credits')
    op.drop_table('invoices')
    op.drop_table('reports')
    op.drop_table('diagnoses')
    op.drop_table('keyword_sets')
    op.drop_table('clients')
    op.drop_table('sessions')
    op.drop_table('agency_members')
    op.drop_table('agencies')
    op.drop_table('users')
