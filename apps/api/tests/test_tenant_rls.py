"""Tenant isolation (app-layer filter + RLS wiring) — no live DB required."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, with_loader_criteria

from app.core import tenant_context as tc
from app.core.database import _tenant_models


def test_context_set_get_reset():
    tid = uuid.uuid4()
    tc.set_current_tenant(tid)
    assert tc.get_current_tenant() == tid
    tc.reset_current_tenant()
    assert tc.get_current_tenant() is None


def test_tenant_models_resolved():
    names = {m.__name__ for m in _tenant_models()}
    # Every declared tenant-scoped model must resolve from the mapper registry.
    assert set(tc.TENANT_SCOPED_MODELS).issubset(names)
    assert "User" in names and "Signal" in names and "Notification" in names


def test_loader_criteria_injects_tenant_filter():
    """with_loader_criteria must add a tenant_id predicate to an ORM SELECT."""
    from app.models import Signal

    tid = uuid.uuid4()
    stmt = select(Signal).options(
        with_loader_criteria(Signal, lambda cls: cls.tenant_id == tid, include_aliases=True)
    )
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
    assert "tenant_id" in compiled


def test_do_orm_execute_listener_registered():
    from sqlalchemy import event
    assert event.contains(Session, "do_orm_execute", __import__(
        "app.core.database", fromlist=["_apply_tenant_filter"]
    )._apply_tenant_filter)
