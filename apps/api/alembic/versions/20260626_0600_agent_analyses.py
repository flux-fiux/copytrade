"""agent_analyses — TradingAgents multi-agent analysis runs

Revision ID: 20260626_0600
Revises: 20260626_0500
Create Date: 2026-06-26 06:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260626_0600"
down_revision = "20260626_0500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("asset_type", sa.String(16), nullable=False, server_default="stock"),
        sa.Column("trade_date", sa.String(10), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("decision", sa.String(16), nullable=True),
        sa.Column("reports", postgresql.JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_agent_analyses_tenant_id", "agent_analyses", ["tenant_id"])
    op.create_index("ix_agent_analyses_user_id", "agent_analyses", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_analyses_user_id", table_name="agent_analyses")
    op.drop_index("ix_agent_analyses_tenant_id", table_name="agent_analyses")
    op.drop_table("agent_analyses")
