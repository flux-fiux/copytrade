import uuid
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    custom_domain: Mapped[str | None] = mapped_column(String(200), unique=True)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    plan: Mapped[str] = mapped_column(String(20), default="basic")  # basic|pro|enterprise
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="tenant")  # type: ignore[name-defined]
