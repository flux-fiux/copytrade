"""create ohlcv hypertable

Revision ID: 20260624_0100
Revises: 20260624_0000_0001
Create Date: 2026-06-24 01:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "20260624_0100"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ohlcv",
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("timeframe", sa.String(5), nullable=False),
        sa.Column("open", sa.Numeric(20, 8), nullable=False),
        sa.Column("high", sa.Numeric(20, 8), nullable=False),
        sa.Column("low", sa.Numeric(20, 8), nullable=False),
        sa.Column("close", sa.Numeric(20, 8), nullable=False),
        sa.Column("volume", sa.Numeric(20, 4), server_default="0"),
        sa.Column("source", sa.String(20), server_default="finnhub"),
        sa.PrimaryKeyConstraint("time", "symbol", "timeframe"),
    )
    op.create_index("idx_ohlcv_symbol_tf_time", "ohlcv", ["symbol", "timeframe", "time"])

    # Convert to TimescaleDB hypertable — no-op on plain PostgreSQL
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
                PERFORM create_hypertable('ohlcv', 'time',
                    chunk_time_interval => INTERVAL '1 month',
                    if_not_exists => TRUE);
                ALTER TABLE ohlcv SET (
                    timescaledb.compress,
                    timescaledb.compress_segmentby = 'symbol,timeframe'
                );
                PERFORM add_compression_policy('ohlcv', INTERVAL '7 days', if_not_exists => TRUE);
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    op.drop_index("idx_ohlcv_symbol_tf_time", "ohlcv")
    op.drop_table("ohlcv")
