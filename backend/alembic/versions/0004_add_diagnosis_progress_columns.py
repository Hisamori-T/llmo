"""add diagnosis progress columns

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-25

Adds progress_stage and progress_detail to diagnoses table for BackgroundTask progress gauge.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('diagnoses', sa.Column('progress_stage', sa.String(32), nullable=True))
    op.add_column('diagnoses', sa.Column('progress_detail', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('diagnoses', 'progress_detail')
    op.drop_column('diagnoses', 'progress_stage')
