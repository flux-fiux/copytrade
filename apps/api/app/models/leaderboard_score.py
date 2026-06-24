import uuid
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class LeaderboardScore(Base):
    __tablename__ = "leaderboard_scores"
    __table_args__ = (UniqueConstraint("tenant_id", "master_id", "period"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # ALL_TIME|1Y|6M|3M|1M

    # Return metrics
    total_return_pct: Mapped[float | None] = mapped_column(Numeric(10, 4))
    monthly_return_pct: Mapped[float | None] = mapped_column(Numeric(10, 4))
    annualized_return_pct: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Risk metrics
    max_drawdown_pct: Mapped[float | None] = mapped_column(Numeric(10, 4))
    sharpe_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))
    sortino_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))
    calmar_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Trade quality
    win_rate_pct: Mapped[float | None] = mapped_column(Numeric(10, 4))
    profit_factor: Mapped[float | None] = mapped_column(Numeric(10, 4))
    avg_rr_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4))
    avg_trade_duration_hours: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_trades: Mapped[int | None] = mapped_column(Integer)
    trading_days: Mapped[int | None] = mapped_column(Integer)

    # Community metrics
    followers_count: Mapped[int] = mapped_column(Integer, default=0)
    consistency_score: Mapped[float | None] = mapped_column(Numeric(5, 2))  # 0-100
    risk_grade: Mapped[str | None] = mapped_column(String(5))  # A+/A/B+/B/C/D

    calculated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
