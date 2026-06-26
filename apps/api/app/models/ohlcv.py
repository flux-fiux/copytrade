from datetime import datetime
from sqlalchemy import String, Numeric, Index, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class OHLCV(Base):
    """TimescaleDB hypertable for OHLCV candlestick data."""
    __tablename__ = "ohlcv"

    # tz-aware: queries bound with timezone.utc datetimes, so the column must match.
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), primary_key=True)
    timeframe: Mapped[str] = mapped_column(String(5), primary_key=True)  # 1m,5m,15m,1h,4h,1d,1w

    open: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(20, 4), default=0)
    source: Mapped[str] = mapped_column(String(20), default="finnhub")

    __table_args__ = (
        Index("idx_ohlcv_symbol_tf_time", "symbol", "timeframe", "time"),
    )
