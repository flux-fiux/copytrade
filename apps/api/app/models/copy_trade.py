import uuid
from sqlalchemy import String, DateTime, ForeignKey, Numeric, BigInteger, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CopyTrade(Base):
    __tablename__ = "copy_trades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    subscription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signal_subscriptions.id"), nullable=False)
    signal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signals.id"), nullable=False)
    follower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    follower_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mt4_accounts.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)  # actual executed volume
    open_price: Mapped[float | None] = mapped_column(Numeric(20, 6))
    close_price: Mapped[float | None] = mapped_column(Numeric(20, 6))
    slippage_pips: Mapped[float | None] = mapped_column(Numeric(10, 2))
    profit: Mapped[float | None] = mapped_column(Numeric(20, 2))
    status: Mapped[str] = mapped_column(String(10), default="OPEN")  # OPEN|CLOSED|FAILED|BLOCKED
    fail_reason: Mapped[str | None] = mapped_column(Text)
    mt4_ticket: Mapped[int | None] = mapped_column(BigInteger)
    opened_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
