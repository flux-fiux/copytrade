"""add cryptomus payment fields

Revision ID: 20260624_0200
Revises: 20260624_0100
Create Date: 2026-06-24 02:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "20260624_0200"
down_revision = "20260624_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signal_subscriptions",
        sa.Column("cryptomus_payment_uuid", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("signal_subscriptions", "cryptomus_payment_uuid")
