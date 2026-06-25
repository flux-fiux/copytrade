import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    # Matches Supabase Auth uid
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str | None] = mapped_column(String(50), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    roles: Mapped[list[str]] = mapped_column(ARRAY(String), default=lambda: ["FOLLOWER"])
    kyc_status: Mapped[str] = mapped_column(String(20), default="NONE")  # NONE|PENDING|VERIFIED|REJECTED
    preferred_lang: Mapped[str] = mapped_column(String(10), default="en")
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    risk_tolerance: Mapped[str] = mapped_column(String(10), default="MEDIUM")  # LOW|MEDIUM|HIGH
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100))
    stripe_connect_id: Mapped[str | None] = mapped_column(String(100))  # Master's Connect account
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Master application fields (populated when user submits apply form)
    apply_strategy: Mapped[str | None] = mapped_column(String(200))
    apply_description: Mapped[str | None] = mapped_column(Text)
    apply_trading_style: Mapped[str | None] = mapped_column(String(20))  # SCALPING|SWING|POSITION|MIXED
    apply_monthly_return_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    apply_max_drawdown_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    apply_price_usd: Mapped[float | None] = mapped_column(Numeric(10, 2))
    apply_perf_fee_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    applied_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    tenant: Mapped["Tenant"] = relationship(back_populates="users")  # type: ignore[name-defined]
    mt4_accounts: Mapped[list["MT4Account"]] = relationship(back_populates="user")  # type: ignore[name-defined]
