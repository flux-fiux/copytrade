"""add master apply fields to users

Revision ID: 20260625_0200
Revises: 20260625_0100
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "20260625_0200"
down_revision = "20260625_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("apply_strategy", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("apply_description", sa.Text, nullable=True))
    op.add_column("users", sa.Column("apply_trading_style", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("apply_monthly_return_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("users", sa.Column("apply_max_drawdown_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("users", sa.Column("apply_price_usd", sa.Numeric(10, 2), nullable=True))
    op.add_column("users", sa.Column("apply_perf_fee_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("users", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for col in ["apply_strategy", "apply_description", "apply_trading_style",
                "apply_monthly_return_pct", "apply_max_drawdown_pct",
                "apply_price_usd", "apply_perf_fee_pct", "applied_at"]:
        op.drop_column("users", col)
