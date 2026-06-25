"""master ratings & reviews

Revision ID: 20260626_0200
Revises: 20260626_0100
Create Date: 2026-06-26 02:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260626_0200"
down_revision = "20260626_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "master_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("master_id", "reviewer_id", name="uq_review_master_reviewer"),
    )
    op.create_index("ix_master_reviews_tenant_id", "master_reviews", ["tenant_id"])
    op.create_index("ix_master_reviews_master_id", "master_reviews", ["master_id"])

    # RLS — consistent with the other tenant tables (inert until rls_activate.sql).
    op.execute("ALTER TABLE master_reviews ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON master_reviews "
        "USING (tenant_id = current_setting('app.current_tenant', true)::uuid) "
        "WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON master_reviews")
    op.execute("ALTER TABLE master_reviews DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_master_reviews_master_id", "master_reviews")
    op.drop_index("ix_master_reviews_tenant_id", "master_reviews")
    op.drop_table("master_reviews")
