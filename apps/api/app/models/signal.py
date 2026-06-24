import uuid
from sqlalchemy import String, DateTime, ForeignKey, Numeric, BigInteger, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.core.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mt4_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mt4_accounts.id"), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(10), nullable=False)   # OPEN | CLOSE | MODIFY
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)      # BUY | SELL
    volume: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    open_price: Mapped[float | None] = mapped_column(Numeric(20, 6))
    close_price: Mapped[float | None] = mapped_column(Numeric(20, 6))
    stop_loss: Mapped[float | None] = mapped_column(Numeric(20, 6))
    take_profit: Mapped[float | None] = mapped_column(Numeric(20, 6))
    profit: Mapped[float | None] = mapped_column(Numeric(20, 2))
    pips: Mapped[float | None] = mapped_column(Numeric(10, 2))
    mt4_ticket: Mapped[int] = mapped_column(BigInteger, nullable=False)
    opened_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="OPEN")       # OPEN | CLOSED | CANCELLED
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
