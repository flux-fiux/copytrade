"""add performance indexes on hot query paths

Revision ID: 20260625_0100
Revises: 20260624_0200
Create Date: 2026-06-25 01:00:00
"""
from alembic import op

revision = "20260625_0100"
down_revision = "20260624_0200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # signals — leaderboard & signal feed queries
    op.create_index("idx_signal_master_opened", "signals", ["master_id", "opened_at"])
    op.create_index("idx_signal_mt4_ticket", "signals", ["mt4_ticket"])
    op.create_index("idx_signal_status", "signals", ["status"])

    # copy_trades — follower dashboard queries
    op.create_index("idx_ct_follower_created", "copy_trades", ["follower_id", "created_at"])
    op.create_index("idx_ct_subscription", "copy_trades", ["subscription_id"])
    op.create_index("idx_ct_status", "copy_trades", ["status"])

    # signal_subscriptions — follower subscription lookups
    op.create_index("idx_ss_follower_status", "signal_subscriptions", ["follower_id", "status"])
    op.create_index("idx_ss_master_status", "signal_subscriptions", ["master_id", "status"])

    # leaderboard_scores — ranking queries
    op.create_index("idx_lb_period_return", "leaderboard_scores", ["period", "total_return_pct"])
    op.create_index("idx_lb_tenant_period", "leaderboard_scores", ["tenant_id", "period"])

    # mt4_accounts — master lookup
    op.create_index("idx_mt4_user_type", "mt4_accounts", ["user_id", "account_type"])


def downgrade() -> None:
    op.drop_index("idx_signal_master_opened", "signals")
    op.drop_index("idx_signal_mt4_ticket", "signals")
    op.drop_index("idx_signal_status", "signals")
    op.drop_index("idx_ct_follower_created", "copy_trades")
    op.drop_index("idx_ct_subscription", "copy_trades")
    op.drop_index("idx_ct_status", "copy_trades")
    op.drop_index("idx_ss_follower_status", "signal_subscriptions")
    op.drop_index("idx_ss_master_status", "signal_subscriptions")
    op.drop_index("idx_lb_period_return", "leaderboard_scores")
    op.drop_index("idx_lb_tenant_period", "leaderboard_scores")
    op.drop_index("idx_mt4_user_type", "mt4_accounts")
