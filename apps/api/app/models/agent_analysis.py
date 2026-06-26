import uuid
from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AgentAnalysis(Base):
    """A run of the TradingAgents multi-agent analysis for one symbol/date.

    Heavy + slow (many LLM calls), so it runs in a Celery task; this row tracks
    status and stores the agents' reports + final decision when done.
    """

    __tablename__ = "agent_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(16), nullable=False, default="stock")  # stock|crypto|forex
    trade_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD analyzed

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")  # PENDING|RUNNING|DONE|FAILED
    decision: Mapped[str | None] = mapped_column(String(16))  # BUY|SELL|HOLD
    reports: Mapped[dict | None] = mapped_column(JSONB)  # per-agent reports keyed by stage
    error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
