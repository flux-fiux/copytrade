import uuid
from sqlalchemy import String, DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.core.database import Base


class SignalSubscription(Base):
    __tablename__ = "signal_subscriptions"
    __table_args__ = (UniqueConstraint("follower_account_id", "master_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    follower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    follower_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mt4_accounts.id"), nullable=False)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"))
    copy_factory_sub_id: Mapped[str | None] = mapped_column(String(100))
    lot_multiplier: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0)
    max_lot_per_trade: Mapped[float | None] = mapped_column(Numeric(10, 4))
    max_drawdown_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    allowed_symbols: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[str] = mapped_column(String(15), default="ACTIVE")  # ACTIVE|PAUSED|CANCELLED
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100))
    performance_fee_hwm: Mapped[float] = mapped_column(Numeric(20, 2), default=0)  # High Water Mark
    subscribed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cancelled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
