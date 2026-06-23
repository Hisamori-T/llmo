"""Firestore compatibility stub — re-exports from postgres.py (v4.0)."""
from .postgres import (  # noqa: F401
    db_add,
    db_delete,
    db_get,
    db_query,
    db_set,
    db_update,
    init_db,
    transaction,
)
