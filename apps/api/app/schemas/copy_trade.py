import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CopyTradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_id: uuid.UUID
    signal_id: uuid.UUID
    follower_id: uuid.UUID
    follower_account_id: uuid.UUID
    symbol: str
    direction: str
    volume: float
    open_price: float | None
    close_price: float | None
    slippage_pips: float | None
    profit: float | None
    status: str
    fail_reason: str | None
    mt4_ticket: int | None
    opened_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
