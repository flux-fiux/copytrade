"""End-to-end tenant-isolation verification.

Spins the real schema + RLS onto a THROWAWAY Postgres, seeds two tenants, and
asserts a tenant can neither read, update, nor insert another tenant's rows —
plus that the app-layer ORM filter scopes SELECTs. Safe: refuses to run against
a Supabase / production URL.

Run against a disposable DB, e.g.:
    docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres --name rlspg postgres:16
    RLS_TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/postgres \
        python scripts/verify_rls.py
    docker rm -f rlspg
"""
import asyncio
import os
import sys
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Import the app so models register and the ORM event hooks attach.
import app.models  # noqa: F401
from app.core.database import Base
from app.core import tenant_context as tc
from app.models import Tenant, User

URL = os.environ.get("RLS_TEST_DATABASE_URL")
APP_ROLE_URL_TMPL = None  # derived below

TENANT_TABLES = [
    "users", "mt4_accounts", "signals", "trade_history", "signal_subscriptions",
    "copy_trades", "leaderboard_scores", "subscription_plans", "payments", "notifications",
]
APP_PW = "rls_test_pw"
ok = True


def check(label: str, cond: bool):
    global ok
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    if not cond:
        ok = False


def _guard(url: str):
    if not url:
        sys.exit("Set RLS_TEST_DATABASE_URL to a disposable Postgres (asyncpg URL).")
    if "supabase" in url or "pooler" in url:
        sys.exit("Refusing to run against a Supabase/pooler URL. Use a throwaway DB.")


async def main():
    _guard(URL)
    owner = create_async_engine(URL, isolation_level="AUTOCOMMIT")

    # 1) Schema + RLS + dedicated role (as owner/superuser).
    async with owner.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    async with owner.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with owner.connect() as conn:
        for t in TENANT_TABLES:
            await conn.exec_driver_sql(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
            await conn.exec_driver_sql(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")
            await conn.exec_driver_sql(
                f"CREATE POLICY tenant_isolation ON {t} "
                f"USING (tenant_id = current_setting('app.current_tenant', true)::uuid) "
                f"WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)"
            )
        await conn.exec_driver_sql("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY")
        await conn.exec_driver_sql("ALTER TABLE tenants FORCE ROW LEVEL SECURITY")
        await conn.exec_driver_sql(
            "CREATE POLICY tenant_self ON tenants "
            "USING (id = current_setting('app.current_tenant', true)::uuid)"
        )
        await conn.exec_driver_sql(
            f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') "
            f"THEN CREATE ROLE app_tenant LOGIN PASSWORD '{APP_PW}' NOBYPASSRLS; END IF; END $$;"
        )
        await conn.exec_driver_sql(
            "ALTER ROLE app_tenant SET app.current_tenant = '00000000-0000-0000-0000-000000000000'"
        )
        await conn.exec_driver_sql("GRANT USAGE ON SCHEMA public TO app_tenant")
        await conn.exec_driver_sql(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant"
        )

    # 2) Seed two tenants, each with one user.
    A, B = uuid.uuid4(), uuid.uuid4()
    ua, ub = uuid.uuid4(), uuid.uuid4()
    Session = async_sessionmaker(owner, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        s.add_all([
            Tenant(id=A, name="Alpha", subdomain="alpha"),
            Tenant(id=B, name="Bravo", subdomain="bravo"),
            User(id=ua, tenant_id=A, email="a@alpha.io"),
            User(id=ub, tenant_id=B, email="b@bravo.io"),
        ])
        await s.commit()

    # 3) DB-layer RLS — connect as the non-bypass app_tenant role.
    base = URL.split("://", 1)[1].split("@", 1)[1]
    app_url = f"postgresql+asyncpg://app_tenant:{APP_PW}@{base}"
    app_eng = create_async_engine(app_url, isolation_level="AUTOCOMMIT")
    print("DB-layer (Postgres RLS, role=app_tenant):")
    async with app_eng.connect() as c:
        await c.exec_driver_sql(f"SET app.current_tenant = '{A}'")
        n = (await c.exec_driver_sql("SELECT count(*) FROM users")).scalar()
        check("tenant A sees only its own users (=1)", n == 1)
        nt = (await c.exec_driver_sql("SELECT count(*) FROM tenants")).scalar()
        check("tenant A sees only its own tenant row (=1)", nt == 1)

        await c.exec_driver_sql(f"SET app.current_tenant = '{B}'")
        n = (await c.exec_driver_sql("SELECT count(*) FROM users")).scalar()
        check("tenant B sees only its own users (=1)", n == 1)

        await c.exec_driver_sql("SET app.current_tenant = '00000000-0000-0000-0000-000000000000'")
        n = (await c.exec_driver_sql("SELECT count(*) FROM users")).scalar()
        check("nil tenant sees nothing (=0, fail-closed)", n == 0)

        # cross-tenant UPDATE blocked
        await c.exec_driver_sql(f"SET app.current_tenant = '{A}'")
        r = await c.exec_driver_sql(f"UPDATE users SET display_name='x' WHERE id='{ub}'")
        check("tenant A cannot update tenant B's row (0 affected)", r.rowcount == 0)

        # cross-tenant INSERT blocked by WITH CHECK
        blocked = False
        try:
            await c.exec_driver_sql(
                f"INSERT INTO users (id, tenant_id, email) VALUES "
                f"('{uuid.uuid4()}', '{B}', 'evil@x.io')"
            )
        except Exception:
            blocked = True
        check("tenant A cannot insert a row for tenant B (WITH CHECK)", blocked)
    await app_eng.dispose()

    # 4) App-layer ORM filter (independent of DB role).
    print("App-layer (do_orm_execute filter):")
    async with Session() as s:
        tc.set_current_tenant(A)
        rows = (await s.execute(select(User))).scalars().all()
        check("ctx=A → ORM select(User) returns only A's rows",
              len(rows) == 1 and all(u.tenant_id == A for u in rows))
        tc.reset_current_tenant()
        rows = (await s.execute(select(User))).scalars().all()
        check("ctx=None → ORM returns all (filter inert)", len(rows) == 2)

    await owner.dispose()
    print("\n" + ("✅ ALL ISOLATION CHECKS PASSED" if ok else "❌ ISOLATION CHECKS FAILED"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(main())
