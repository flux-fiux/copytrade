import uuid
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    payer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    payee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("signal_subscriptions.id"))
    payment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # SUBSCRIPTION|PERFORMANCE_FEE|WITHDRAWAL
    amount_usd: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False)
    platform_fee_usd: Mapped[float] = mapped_column(Numeric(20, 2), default=0)
    master_earnings_usd: Mapped[float] = mapped_column(Numeric(20, 2), default=0)
    stripe_payment_id: Mapped[str | None] = mapped_column(String(200))
    stripe_transfer_id: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(15), default="PENDING")  # PENDING|COMPLETED|FAILED|REFUNDED
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
