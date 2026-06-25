"""add missing columns: pause fields, wallet, email prefs, user timestamps

Revision ID: 20260625_0300
Revises: 20260625_0200
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "20260625_0300"
down_revision = "20260625_0200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # signal_subscriptions — pause tracking
    op.add_column("signal_subscriptions",
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signal_subscriptions",
        sa.Column("pause_reason", sa.String(500), nullable=True))

    # users — wallet & notification prefs
    op.add_column("users",
        sa.Column("wallet_address", sa.String(200), nullable=True))
    op.add_column("users",
        sa.Column("email_notify_signals", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users",
        sa.Column("email_notify_billing", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users",
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"))
    op.add_column("users",
        sa.Column("risk_tolerance", sa.String(10), nullable=False, server_default="MEDIUM"))


def downgrade() -> None:
    op.drop_column("signal_subscriptions", "paused_at")
    op.drop_column("signal_subscriptions", "pause_reason")
    op.drop_column("users", "wallet_address")
    op.drop_column("users", "email_notify_signals")
    op.drop_column("users", "email_notify_billing")
    op.drop_column("users", "timezone")
    op.drop_column("users", "risk_tolerance")
