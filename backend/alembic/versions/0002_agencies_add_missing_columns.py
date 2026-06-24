"""agencies add missing columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-24

"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('agencies', sa.Column('additional_child_accounts', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('agencies', sa.Column('max_child_accounts', sa.Integer(), nullable=True, server_default='5'))
    op.add_column('agencies', sa.Column('credits_per_child', sa.Integer(), nullable=True, server_default='100'))
    op.add_column('agencies', sa.Column('included_clients', sa.Integer(), nullable=True, server_default='10'))
    op.add_column('agencies', sa.Column('additional_clients', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('agencies', sa.Column('max_clients', sa.Integer(), nullable=True, server_default='10'))


def downgrade() -> None:
    op.drop_column('agencies', 'max_clients')
    op.drop_column('agencies', 'additional_clients')
    op.drop_column('agencies', 'included_clients')
    op.drop_column('agencies', 'credits_per_child')
    op.drop_column('agencies', 'max_child_accounts')
    op.drop_column('agencies', 'additional_child_accounts')
