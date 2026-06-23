"""Alembic env.py — LLMO Score v4.1."""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# backend/app を sys.path に追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.shared.db.models import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    """DATABASE_URL を取得し、asyncpg を psycopg2 に差し替える（同期ドライバ使用）。"""
    raw = os.environ.get(
        'DATABASE_URL',
        config.get_main_option('sqlalchemy.url', 'postgresql://llmo:llmo_secret@localhost:5432/llmo'),
    )
    # asyncpg → psycopg2（alembic は同期接続のみサポート）
    return raw.replace('postgresql+asyncpg://', 'postgresql+psycopg2://').replace('postgresql+asyncpg:', 'postgresql:')


def run_migrations_offline() -> None:
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg['sqlalchemy.url'] = _get_url()
    connectable = engine_from_config(cfg, prefix='sqlalchemy.', poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
