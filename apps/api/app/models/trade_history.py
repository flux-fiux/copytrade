import uuid
from sqlalchemy import String, DateTime, ForeignKey, Numeric, BigInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class TradeHistory(Base):
    __tablename__ = "trade_history"
    __table_args__ = (UniqueConstraint("mt4_account_id", "mt4_ticket"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mt4_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mt4_accounts.id"), nullable=False)
    master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mt4_ticket: Mapped[int] = mapped_column(BigInteger, nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    open_price: Mapped[float] = mapped_column(Numeric(20, 6), nullable=False)
    close_price: Mapped[float | None] = mapped_column(Numeric(20, 6))
    stop_loss: Mapped[float | None] = mapped_column(Numeric(20, 6))
    take_profit: Mapped[float | None] = mapped_column(Numeric(20, 6))
    profit: Mapped[float | None] = mapped_column(Numeric(20, 2))
    commission: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    swap: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    opened_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
