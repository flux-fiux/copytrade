"""tenant RLS: add missing tenant_id columns + enable row-level security

Revision ID: 20260625_0600
Revises: 20260625_0500
Create Date: 2026-06-25 06:00:00

Safe to apply while the app connects as the table owner / a BYPASSRLS role:
ENABLE RLS + policies have NO effect for such roles. Isolation only becomes
enforced once you run docs/rls_activate.sql (FORCE RLS + dedicated app role) and
point the API's DATABASE_URL at that role with RLS_ENABLED=true.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260625_0600"
down_revision = "20260625_0500"
branch_labels = None
depends_on = None

# Tables with a tenant_id column that must be tenant-isolated. ohlcv (global
# market data) is intentionally excluded.
TENANT_TABLES = [
    "users", "mt4_accounts", "signals", "trade_history", "signal_subscriptions",
    "copy_trades", "leaderboard_scores", "subscription_plans", "payments", "notifications",
]


def upgrade() -> None:
    # 1) Add tenant_id to the two tables that lacked it (nullable first).
    op.add_column("notifications", sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("trade_history", sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))

    # 2) Backfill from the owning user.
    op.execute("UPDATE notifications n SET tenant_id = u.tenant_id FROM users u WHERE u.id = n.user_id")
    op.execute("UPDATE trade_history th SET tenant_id = u.tenant_id FROM users u WHERE u.id = th.master_id")

    # 3) Lock down: FK + index + NOT NULL.
    for tbl, src in (("notifications", "user_id"), ("trade_history", "master_id")):
        op.alter_column(tbl, "tenant_id", nullable=False)
        op.create_index(f"ix_{tbl}_tenant_id", tbl, ["tenant_id"])
        op.create_foreign_key(f"fk_{tbl}_tenant", tbl, "tenants", ["tenant_id"], ["id"])

    # 4) Enable RLS + tenant-isolation policy on every tenant table.
    #    current_setting(..., true) returns NULL (not an error) when unset, so an
    #    unscoped connection sees no rows (fail-closed).
    for tbl in TENANT_TABLES:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {tbl}
              USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
              WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
            """
        )

    # 5) The tenants table itself: a tenant may only see its own row.
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_self ON tenants "
        "USING (id = current_setting('app.current_tenant', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_self ON tenants")
    op.execute("ALTER TABLE tenants DISABLE ROW LEVEL SECURITY")
    for tbl in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {tbl}")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY")
    for tbl in ("notifications", "trade_history"):
        op.drop_constraint(f"fk_{tbl}_tenant", tbl, type_="foreignkey")
        op.drop_index(f"ix_{tbl}_tenant_id", tbl)
        op.drop_column(tbl, "tenant_id")
