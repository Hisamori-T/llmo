"""schema sync - add missing columns across all tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-24

Adds columns present in models.py but absent from the 0001 baseline migration.
sessions, clients, keyword_sets, reports, invoices, content_sources, content_articles
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── sessions ──────────────────────────────────────────────────────────────
    op.add_column('sessions', sa.Column('session_id', sa.String(255), nullable=True))
    op.add_column('sessions', sa.Column('browser_name', sa.String(255), nullable=True, server_default=''))
    op.add_column('sessions', sa.Column('browser_version', sa.String(50), nullable=True, server_default=''))
    op.add_column('sessions', sa.Column('browser_id', sa.String(255), nullable=True, server_default=''))
    op.add_column('sessions', sa.Column('os', sa.String(100), nullable=True, server_default=''))
    op.add_column('sessions', sa.Column('os_version', sa.String(50), nullable=True, server_default=''))
    op.add_column('sessions', sa.Column('revoke_reason', sa.String(100), nullable=True))
    op.add_column('sessions', sa.Column('last_activity', sa.String(64), nullable=True))
    op.create_unique_constraint('uq_sessions_session_id', 'sessions', ['session_id'])
    op.create_index('ix_sessions_session_id', 'sessions', ['session_id'])

    # ── clients ───────────────────────────────────────────────────────────────
    op.add_column('clients', sa.Column('client_id', sa.String(36), nullable=True))
    op.add_column('clients', sa.Column('contact_phone', sa.String(50), nullable=True, server_default=''))
    op.add_column('clients', sa.Column('note', sa.Text(), nullable=True, server_default=''))
    op.add_column('clients', sa.Column('assigned_staff_ids', postgresql.JSONB(), nullable=True))
    op.add_column('clients', sa.Column('settings', postgresql.JSONB(), nullable=True))
    op.add_column('clients', sa.Column('created_by', sa.String(36), nullable=True))

    # ── keyword_sets ──────────────────────────────────────────────────────────
    op.add_column('keyword_sets', sa.Column('keyword_set_id', sa.String(36), nullable=True))
    op.add_column('keyword_sets', sa.Column('generated_by', sa.String(36), nullable=True))
    op.add_column('keyword_sets', sa.Column('industry', sa.String(100), nullable=True, server_default=''))
    op.add_column('keyword_sets', sa.Column('location', sa.String(100), nullable=True, server_default=''))
    op.add_column('keyword_sets', sa.Column('target_url', sa.String(500), nullable=True, server_default=''))
    op.add_column('keyword_sets', sa.Column('competitor_data', postgresql.JSONB(), nullable=True))
    op.add_column('keyword_sets', sa.Column('market_analysis', postgresql.JSONB(), nullable=True))

    # ── reports ───────────────────────────────────────────────────────────────
    op.add_column('reports', sa.Column('share_url', sa.String(500), nullable=True))

    # ── invoices ──────────────────────────────────────────────────────────────
    op.add_column('invoices', sa.Column('invoice_id', sa.String(36), nullable=True))
    op.add_column('invoices', sa.Column('period_start', sa.String(64), nullable=True))
    op.add_column('invoices', sa.Column('period_end', sa.String(64), nullable=True))
    op.add_column('invoices', sa.Column('pdf_url', sa.String(500), nullable=True))

    # ── content_sources ───────────────────────────────────────────────────────
    op.add_column('content_sources', sa.Column('source_id', sa.String(36), nullable=True))

    # ── content_articles ─────────────────────────────────────────────────────
    op.add_column('content_articles', sa.Column('article_id', sa.String(36), nullable=True))
    op.add_column('content_articles', sa.Column('diagnosis_id', sa.String(36), nullable=True))
    op.add_column('content_articles', sa.Column('title', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('content_articles', 'title')
    op.drop_column('content_articles', 'diagnosis_id')
    op.drop_column('content_articles', 'article_id')
    op.drop_column('content_sources', 'source_id')
    op.drop_column('invoices', 'pdf_url')
    op.drop_column('invoices', 'period_end')
    op.drop_column('invoices', 'period_start')
    op.drop_column('invoices', 'invoice_id')
    op.drop_column('reports', 'share_url')
    op.drop_column('keyword_sets', 'market_analysis')
    op.drop_column('keyword_sets', 'competitor_data')
    op.drop_column('keyword_sets', 'target_url')
    op.drop_column('keyword_sets', 'location')
    op.drop_column('keyword_sets', 'industry')
    op.drop_column('keyword_sets', 'generated_by')
    op.drop_column('keyword_sets', 'keyword_set_id')
    op.drop_column('clients', 'created_by')
    op.drop_column('clients', 'settings')
    op.drop_column('clients', 'assigned_staff_ids')
    op.drop_column('clients', 'note')
    op.drop_column('clients', 'contact_phone')
    op.drop_column('clients', 'client_id')
    op.drop_index('ix_sessions_session_id', table_name='sessions')
    op.drop_constraint('uq_sessions_session_id', 'sessions', type_='unique')
    op.drop_column('sessions', 'last_activity')
    op.drop_column('sessions', 'revoke_reason')
    op.drop_column('sessions', 'os_version')
    op.drop_column('sessions', 'os')
    op.drop_column('sessions', 'browser_id')
    op.drop_column('sessions', 'browser_version')
    op.drop_column('sessions', 'browser_name')
    op.drop_column('sessions', 'session_id')
