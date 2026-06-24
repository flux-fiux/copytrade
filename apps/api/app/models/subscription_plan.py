import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_usd: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    billing_cycle: Mapped[str] = mapped_column(String(10), default="MONTHLY")
    performance_fee_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    max_followers: Mapped[int | None] = mapped_column(Integer)
    stripe_price_id: Mapped[str | None] = mapped_column(String(100))
    features: Mapped[list] = mapped_column(JSONB, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
