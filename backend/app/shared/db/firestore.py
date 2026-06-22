import asyncio
import os
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore as fs
from google.cloud.firestore_v1 import Query

_initialized = False


def _init_firebase() -> None:
    global _initialized
    if _initialized:
        return
    json_path = os.path.join(
        os.path.dirname(__file__), '..', '..', '..', 'firebase-adminsdk.json'
    )
    json_path = os.path.normpath(json_path)
    if not firebase_admin._apps:
        cred = credentials.Certificate(json_path) if os.path.exists(json_path) else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    _initialized = True


def _db():
    _init_firebase()
    return fs.client()


async def db_get(collection: str, doc_id: str) -> Optional[dict]:
    def _sync():
        doc = _db().collection(collection).document(doc_id).get()
        return {'_id': doc.id, **doc.to_dict()} if doc.exists else None
    return await asyncio.to_thread(_sync)


async def db_set(collection: str, doc_id: str, data: dict) -> None:
    def _sync():
        _db().collection(collection).document(doc_id).set(data)
    await asyncio.to_thread(_sync)


async def db_update(collection: str, doc_id: str, data: dict) -> None:
    def _sync():
        _db().collection(collection).document(doc_id).update(data)
    await asyncio.to_thread(_sync)


async def db_delete(collection: str, doc_id: str) -> None:
    def _sync():
        _db().collection(collection).document(doc_id).delete()
    await asyncio.to_thread(_sync)


async def db_add(collection: str, data: dict) -> str:
    def _sync():
        _, ref = _db().collection(collection).add(data)
        return ref.id
    return await asyncio.to_thread(_sync)


async def db_query(
    collection: str,
    filters: list = None,
    limit: int = 100,
    order_by: str = None,
    desc: bool = False,
) -> list:
    def _sync():
        q = _db().collection(collection)
        if filters:
            for field, op, value in filters:
                q = q.where(field, op, value)
        if order_by:
            direction = Query.DESCENDING if desc else Query.ASCENDING
            q = q.order_by(order_by, direction=direction)
        if limit:
            q = q.limit(limit)
        return [{'_id': d.id, **d.to_dict()} for d in q.get()]
    return await asyncio.to_thread(_sync)
