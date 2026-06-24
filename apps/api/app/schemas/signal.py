import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    master_id: uuid.UUID
    signal_type: str
    symbol: str
    direction: str
    volume: Decimal
    open_price: Decimal | None
    close_price: Decimal | None
    profit: Decimal | None
    pips: Decimal | None
    mt4_ticket: int
    opened_at: datetime
    closed_at: datetime | None
    tags: list[str]


class SignalIngest(BaseModel):
    meta_api_account_id: str
    master_id: str
    signal_type: Literal["OPEN", "CLOSE", "MODIFY"]
    symbol: str
    direction: Literal["BUY", "SELL"]
    volume: float
    open_price: float | None = None
    close_price: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    profit: float | None = None
    mt4_ticket: int | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None
