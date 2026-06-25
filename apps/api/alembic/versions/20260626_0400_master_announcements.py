"""master announcements

Revision ID: 20260626_0400
Revises: 20260626_0300
Create Date: 2026-06-26 04:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260626_0400"
down_revision = "20260626_0300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "master_announcements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_master_announcements_tenant_id", "master_announcements", ["tenant_id"])
    op.create_index("ix_master_announcements_master_id", "master_announcements", ["master_id"])
    op.execute("ALTER TABLE master_announcements ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON master_announcements "
        "USING (tenant_id = current_setting('app.current_tenant', true)::uuid) "
        "WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON master_announcements")
    op.execute("ALTER TABLE master_announcements DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_master_announcements_master_id", "master_announcements")
    op.drop_index("ix_master_announcements_tenant_id", "master_announcements")
    op.drop_table("master_announcements")
