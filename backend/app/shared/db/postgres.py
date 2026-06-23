"""PostgreSQL async engine + Firestore-compatible compatibility layer."""
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from sqlalchemy import inspect, select, update, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from .models import (
    Agency,
    AgencyMember,
    ApiCredits,
    AuditLog,
    AutomationLog,
    AutomationSchedule,
    Base,
    Client,
    ContentArticle,
    ContentSource,
    CreditUsage,
    Diagnosis,
    Invoice,
    KeywordSet,
    Optimization,
    Report,
    Session,
    User,
)

_engine = None
_session_factory: async_sessionmaker[AsyncSession] = None

_COLLECTION_MAP = {
    'users': User,
    'agencies': Agency,
    'agency_members': AgencyMember,
    'sessions': Session,
    'clients': Client,
    'keywords': KeywordSet,
    'keyword_sets': KeywordSet,
    'diagnoses': Diagnosis,
    'reports': Report,
    'invoices': Invoice,
    'api_credits': ApiCredits,
    'automation_schedules': AutomationSchedule,
    'automation_logs': AutomationLog,
    'optimizations': Optimization,
    'content_sources': ContentSource,
    'content_articles': ContentArticle,
    'credit_usage': CreditUsage,
    'audit_logs': AuditLog,
}


def get_engine():
    global _engine, _session_factory
    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    get_engine()
    return _session_factory


async def init_db() -> None:
    """開発用の自動テーブル作成。本番は alembic upgrade head を使用すること。"""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def transaction() -> AsyncIterator[AsyncSession]:
    """複数 db_* 操作を1トランザクションで囲むコンテキストマネージャ。

    使用例:
        async with transaction() as sess:
            await sess.execute(...)  # 生SQL
            # または db_* 関数にはまだセッション注入未対応のため
            # 直接 ORM を使う場合に利用する
        # 正常終了で commit、例外で rollback
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _model_to_dict(row) -> dict:
    mapper = inspect(type(row))
    d = {col.key: getattr(row, col.key) for col in mapper.attrs}
    d['_id'] = d.get('id')
    return d


def _get_model(collection: str):
    model = _COLLECTION_MAP.get(collection)
    if model is None:
        raise ValueError(f'Unknown collection: {collection}')
    return model


def _apply_filter(model, field: str, op: str, value):
    col = getattr(model, field, None)
    if col is None:
        return None
    if op in ('==', '='):
        return col == value
    if op == '!=':
        return col != value
    if op == '>':
        return col > value
    if op == '>=':
        return col >= value
    if op == '<':
        return col < value
    if op == '<=':
        return col <= value
    if op == 'in':
        return col.in_(value)
    if op == 'array_contains':
        return col.contains([value])
    return None


async def db_get(collection: str, doc_id: str) -> Optional[dict]:
    model = _get_model(collection)
    factory = get_session_factory()
    async with factory() as session:
        result = await session.get(model, doc_id)
        return _model_to_dict(result) if result else None


async def db_set(collection: str, doc_id: str, data: dict) -> None:
    model = _get_model(collection)
    factory = get_session_factory()
    row_data = {k: v for k, v in data.items() if hasattr(model, k)}
    row_data['id'] = doc_id
    # Exclude PK from set_ — PostgreSQL rejects updating the conflict column
    set_data = {k: v for k, v in row_data.items() if k != 'id'}
    stmt = (
        pg_insert(model)
        .values(**row_data)
        .on_conflict_do_update(index_elements=['id'], set_=set_data)
    )
    async with factory() as session:
        await session.execute(stmt)
        await session.commit()


async def db_update(collection: str, doc_id: str, data: dict) -> None:
    model = _get_model(collection)
    factory = get_session_factory()
    update_data = {k: v for k, v in data.items() if hasattr(model, k) and k != 'id'}
    if not update_data:
        return
    stmt = update(model).where(model.id == doc_id).values(**update_data)
    async with factory() as session:
        await session.execute(stmt)
        await session.commit()


async def db_delete(collection: str, doc_id: str) -> None:
    model = _get_model(collection)
    factory = get_session_factory()
    stmt = delete(model).where(model.id == doc_id)
    async with factory() as session:
        await session.execute(stmt)
        await session.commit()


async def db_add(collection: str, data: dict) -> str:
    model = _get_model(collection)
    factory = get_session_factory()
    new_id = data.get('id') or str(uuid.uuid4())
    row_data = {k: v for k, v in data.items() if hasattr(model, k)}
    row_data['id'] = new_id
    stmt = pg_insert(model).values(**row_data).on_conflict_do_nothing()
    async with factory() as session:
        await session.execute(stmt)
        await session.commit()
    return new_id


async def db_query(
    collection: str,
    filters: list = None,
    limit: int = 100,
    order_by: str = None,
    desc: bool = False,
) -> list:
    model = _get_model(collection)
    factory = get_session_factory()
    stmt = select(model)
    if filters:
        for field, op, value in filters:
            clause = _apply_filter(model, field, op, value)
            if clause is not None:
                stmt = stmt.where(clause)
    if order_by:
        col = getattr(model, order_by, None)
        if col is not None:
            stmt = stmt.order_by(col.desc() if desc else col.asc())
    if limit:
        stmt = stmt.limit(limit)
    async with factory() as session:
        result = await session.execute(stmt)
        return [_model_to_dict(row) for row in result.scalars().all()]
