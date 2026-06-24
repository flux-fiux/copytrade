import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class MT4Account(Base):
    __tablename__ = "mt4_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    meta_api_account_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    broker_name: Mapped[str] = mapped_column(String(100), nullable=False)
    login: Mapped[str] = mapped_column(String(50), nullable=False)
    server: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(10), nullable=False)  # MASTER | FOLLOWER
    platform: Mapped[str] = mapped_column(String(5), default="MT4")  # MT4 | MT5
    connection_status: Mapped[str] = mapped_column(String(20), default="DISCONNECTED")
    balance: Mapped[float | None] = mapped_column(Numeric(20, 2))
    equity: Mapped[float | None] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    leverage: Mapped[int | None] = mapped_column(Integer)
    copy_factory_strategy_id: Mapped[str | None] = mapped_column(String(100))
    last_synced_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="mt4_accounts")  # type: ignore[name-defined]
