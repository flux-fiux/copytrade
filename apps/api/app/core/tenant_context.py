"""Per-request tenant context.

A ContextVar holds the resolved tenant_id for the current request/task. Two
layers read it:
  1. Application layer — a SQLAlchemy ``do_orm_execute`` hook adds a tenant
     filter to every ORM SELECT (see core/database.py).
  2. Database layer — an ``after_begin`` hook issues ``SET LOCAL`` so Postgres
     RLS policies (``current_setting('app.current_tenant')``) enforce isolation.

ContextVars are task-local under asyncio, so each request gets its own value.
"""
import uuid
from contextvars import ContextVar

_current_tenant: ContextVar[uuid.UUID | None] = ContextVar("current_tenant", default=None)

# Nil UUID — used as the GUC value when no tenant is resolved so RLS policies
# match no rows (fail-closed) instead of leaking across tenants.
NIL_TENANT = uuid.UUID("00000000-0000-0000-0000-000000000000")

# ORM models that carry a tenant_id and must be auto-scoped at the app layer.
# (Listed by class name to avoid importing models here and risking import cycles;
# resolved lazily in core/database.py.)
TENANT_SCOPED_MODELS = [
    "User", "MT4Account", "Signal", "TradeHistory", "SignalSubscription",
    "CopyTrade", "LeaderboardScore", "SubscriptionPlan", "Payment", "Notification",
    "MasterReview",
]


def set_current_tenant(tenant_id: uuid.UUID | None) -> None:
    _current_tenant.set(tenant_id)


def get_current_tenant() -> uuid.UUID | None:
    return _current_tenant.get()


def reset_current_tenant() -> None:
    _current_tenant.set(None)
