"""add subscription mode and make follower_account nullable

Revision ID: 20260625_0400
Revises: 20260625_0300
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "20260625_0400"
down_revision = "20260625_0300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "signal_subscriptions",
        sa.Column("mode", sa.String(10), nullable=False, server_default="live"),
    )
    op.alter_column(
        "signal_subscriptions",
        "follower_account_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "signal_subscriptions",
        "follower_account_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.drop_column("signal_subscriptions", "mode")
