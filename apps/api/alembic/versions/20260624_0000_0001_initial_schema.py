"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- tenants (no FK deps) ---
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("subdomain", sa.String(50), nullable=False),
        sa.Column("custom_domain", sa.String(200), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("plan", sa.String(20), nullable=False, server_default="basic"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("subdomain"),
        sa.UniqueConstraint("custom_domain"),
    )

    # --- users (depends on tenants) ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(50), nullable=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("roles", postgresql.ARRAY(sa.String()), nullable=False, server_default="{FOLLOWER}"),
        sa.Column("kyc_status", sa.String(20), nullable=False, server_default="NONE"),
        sa.Column("preferred_lang", sa.String(10), nullable=False, server_default="en"),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
        sa.Column("risk_tolerance", sa.String(10), nullable=False, server_default="MEDIUM"),
        sa.Column("stripe_customer_id", sa.String(100), nullable=True),
        sa.Column("stripe_connect_id", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # --- mt4_accounts (depends on tenants, users) ---
    op.create_table(
        "mt4_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("meta_api_account_id", sa.String(100), nullable=False),
        sa.Column("broker_name", sa.String(100), nullable=False),
        sa.Column("login", sa.String(50), nullable=False),
        sa.Column("server", sa.String(200), nullable=False),
        sa.Column("account_type", sa.String(10), nullable=False),
        sa.Column("platform", sa.String(5), nullable=False, server_default="MT4"),
        sa.Column("connection_status", sa.String(20), nullable=False, server_default="DISCONNECTED"),
        sa.Column("balance", sa.Numeric(20, 2), nullable=True),
        sa.Column("equity", sa.Numeric(20, 2), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("leverage", sa.Integer(), nullable=True),
        sa.Column("encrypted_password", sa.String(500), nullable=True),
        sa.Column("copy_factory_strategy_id", sa.String(100), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("meta_api_account_id"),
    )
    op.create_index("ix_mt4_accounts_user_id", "mt4_accounts", ["user_id"])

    # --- subscription_plans (depends on tenants, users) ---
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_usd", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("billing_cycle", sa.String(10), nullable=False, server_default="MONTHLY"),
        sa.Column("performance_fee_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("max_followers", sa.Integer(), nullable=True),
        sa.Column("stripe_price_id", sa.String(100), nullable=True),
        sa.Column("features", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- signals (depends on tenants, users, mt4_accounts) ---
    op.create_table(
        "signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("mt4_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mt4_accounts.id"), nullable=False),
        sa.Column("signal_type", sa.String(10), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("volume", sa.Numeric(10, 4), nullable=False),
        sa.Column("open_price", sa.Numeric(20, 6), nullable=True),
        sa.Column("close_price", sa.Numeric(20, 6), nullable=True),
        sa.Column("stop_loss", sa.Numeric(20, 6), nullable=True),
        sa.Column("take_profit", sa.Numeric(20, 6), nullable=True),
        sa.Column("profit", sa.Numeric(20, 2), nullable=True),
        sa.Column("pips", sa.Numeric(10, 2), nullable=True),
        sa.Column("mt4_ticket", sa.BigInteger(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="OPEN"),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_signals_master_opened", "signals", ["master_id", "opened_at"])

    # --- trade_history (depends on mt4_accounts, users) ---
    op.create_table(
        "trade_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("mt4_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mt4_accounts.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("mt4_ticket", sa.BigInteger(), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("volume", sa.Numeric(10, 4), nullable=False),
        sa.Column("open_price", sa.Numeric(20, 6), nullable=False),
        sa.Column("close_price", sa.Numeric(20, 6), nullable=True),
        sa.Column("stop_loss", sa.Numeric(20, 6), nullable=True),
        sa.Column("take_profit", sa.Numeric(20, 6), nullable=True),
        sa.Column("profit", sa.Numeric(20, 2), nullable=True),
        sa.Column("commission", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("swap", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("mt4_account_id", "mt4_ticket"),
    )
    op.create_index("ix_trade_history_master_opened", "trade_history", ["master_id", "opened_at"])

    # --- signal_subscriptions (depends on tenants, users, mt4_accounts, subscription_plans) ---
    op.create_table(
        "signal_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("follower_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mt4_accounts.id"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subscription_plans.id"), nullable=True),
        sa.Column("copy_factory_sub_id", sa.String(100), nullable=True),
        sa.Column("lot_multiplier", sa.Numeric(5, 2), nullable=False, server_default="1.0"),
        sa.Column("max_lot_per_trade", sa.Numeric(10, 4), nullable=True),
        sa.Column("max_drawdown_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("allowed_symbols", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(15), nullable=False, server_default="ACTIVE"),
        sa.Column("stripe_subscription_id", sa.String(100), nullable=True),
        sa.Column("performance_fee_hwm", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("subscribed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("follower_account_id", "master_id"),
    )
    op.create_index("ix_subscriptions_follower", "signal_subscriptions", ["follower_id"])
    op.create_index("ix_subscriptions_master", "signal_subscriptions", ["master_id"])

    # --- copy_trades (depends on tenants, signal_subscriptions, signals, users, mt4_accounts) ---
    op.create_table(
        "copy_trades",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("signal_subscriptions.id"), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("signals.id"), nullable=False),
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("follower_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mt4_accounts.id"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("volume", sa.Numeric(10, 4), nullable=False),
        sa.Column("open_price", sa.Numeric(20, 6), nullable=True),
        sa.Column("close_price", sa.Numeric(20, 6), nullable=True),
        sa.Column("slippage_pips", sa.Numeric(10, 2), nullable=True),
        sa.Column("profit", sa.Numeric(20, 2), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="OPEN"),
        sa.Column("fail_reason", sa.Text(), nullable=True),
        sa.Column("mt4_ticket", sa.BigInteger(), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_copy_trades_subscription", "copy_trades", ["subscription_id"])

    # --- leaderboard_scores (depends on tenants, users) ---
    op.create_table(
        "leaderboard_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("total_return_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("monthly_return_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("annualized_return_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("max_drawdown_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("sharpe_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("sortino_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("calmar_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("win_rate_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("profit_factor", sa.Numeric(10, 4), nullable=True),
        sa.Column("avg_rr_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("total_trades", sa.Integer(), nullable=True),
        sa.Column("trading_days", sa.Integer(), nullable=True),
        sa.Column("followers_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("consistency_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("risk_grade", sa.String(5), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "master_id", "period"),
    )
    op.create_index("ix_leaderboard_tenant_period", "leaderboard_scores", ["tenant_id", "period"])

    # --- payments (depends on tenants, users, signal_subscriptions) ---
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("payer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("payee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("signal_subscriptions.id"), nullable=True),
        sa.Column("payment_type", sa.String(20), nullable=False),
        sa.Column("amount_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column("platform_fee_usd", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("master_earnings_usd", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("stripe_payment_id", sa.String(200), nullable=True),
        sa.Column("stripe_transfer_id", sa.String(200), nullable=True),
        sa.Column("status", sa.String(15), nullable=False, server_default="PENDING"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed: default platform tenant
    op.execute("""
        INSERT INTO tenants (id, name, subdomain, plan, is_active, config)
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            'CopyTrade Platform',
            'platform',
            'enterprise',
            true,
            '{}'
        )
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("leaderboard_scores")
    op.drop_table("copy_trades")
    op.drop_table("signal_subscriptions")
    op.drop_table("trade_history")
    op.drop_table("signals")
    op.drop_table("subscription_plans")
    op.drop_table("mt4_accounts")
    op.drop_table("users")
    op.drop_table("tenants")
