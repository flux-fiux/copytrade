"""subscription billing period (crypto renewal)

Revision ID: 20260626_0500
Revises: 20260626_0400
Create Date: 2026-06-26 05:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "20260626_0500"
down_revision = "20260626_0400"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signal_subscriptions", sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signal_subscriptions", sa.Column("last_credited_payment_uuid", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("signal_subscriptions", "last_credited_payment_uuid")
    op.drop_column("signal_subscriptions", "current_period_end")
