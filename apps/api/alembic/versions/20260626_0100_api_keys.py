"""broker integration api keys

Revision ID: 20260626_0100
Revises: 20260625_0600
Create Date: 2026-06-26 01:00:00

Note: api_keys is deliberately NOT placed under RLS — it is the lookup table
that resolves the tenant from a key hash (bootstrap), and its rows are guarded
by the unguessable hash + explicit tenant_id filters in the admin endpoints.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260626_0100"
down_revision = "20260625_0600"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("prefix", sa.String(16), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_api_keys_tenant_id", "api_keys", ["tenant_id"])
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_api_keys_key_hash", "api_keys")
    op.drop_index("ix_api_keys_tenant_id", "api_keys")
    op.drop_table("api_keys")
