from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, with_loader_criteria
from app.core.config import settings
from app.core.tenant_context import get_current_tenant, TENANT_SCOPED_MODELS

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.DEBUG and settings.APP_ENV == "development"),
    pool_size=20,
    max_overflow=40,
)

# 同步引擎供 Celery 任务使用（asyncpg → psycopg2 URL）
_sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
sync_engine = create_engine(_sync_url, pool_size=5, max_overflow=10)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False, autoflush=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


# ── Tenant isolation (двойная защита) ──────────────────────────────────────
# Both hooks are no-ops unless the request set a tenant in the ContextVar, so
# cross-tenant background workers (which never set it) are unaffected and keep
# relying on their explicit tenant_id filters + a BYPASSRLS connection role.
_tenant_model_cache: list | None = None


def _tenant_models() -> list:
    global _tenant_model_cache
    if _tenant_model_cache is None:
        import app.models  # noqa: F401 — ensure every mapped class is registered
        reg = {m.class_.__name__: m.class_ for m in Base.registry.mappers}
        resolved = [reg[n] for n in TENANT_SCOPED_MODELS if n in reg]
        # Don't cache a partial result (e.g. if called before models loaded).
        if len(resolved) < len(TENANT_SCOPED_MODELS):
            return resolved
        _tenant_model_cache = resolved
    return _tenant_model_cache


@event.listens_for(Session, "do_orm_execute")
def _apply_tenant_filter(state) -> None:
    """App layer: auto-add `tenant_id = :ctx` to every ORM SELECT."""
    if not state.is_select or state.is_column_load or state.is_relationship_load:
        return
    tenant_id = get_current_tenant()
    if tenant_id is None:
        return
    for model in _tenant_models():
        state.statement = state.statement.options(
            with_loader_criteria(
                model, lambda cls: cls.tenant_id == tenant_id, include_aliases=True
            )
        )


@event.listens_for(Session, "after_begin")
def _set_rls_guc(session, transaction, connection) -> None:
    """DB layer: scope Postgres RLS policies to the current tenant per tx."""
    if not settings.RLS_ENABLED:
        return
    tenant_id = get_current_tenant()
    if tenant_id is None:
        return
    # tenant_id is a uuid.UUID → canonical text, no injection surface.
    connection.exec_driver_sql(f"SET LOCAL app.current_tenant = '{tenant_id}'")


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
