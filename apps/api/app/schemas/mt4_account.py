import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class MT4AccountConnect(BaseModel):
    broker_name: str
    login: str
    password: str
    server: str
    account_type: str = "FOLLOWER"  # MASTER | FOLLOWER
    platform: str = "MT4"           # MT4 | MT5


class MT4AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    broker_name: str
    login: str
    server: str
    account_type: str
    platform: str
    connection_status: str
    balance: Decimal | None
    equity: Decimal | None
    currency: str
    created_at: datetime


class MT4AccountSyncOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    connection_status: str
    balance: Decimal | None
    equity: Decimal | None
    currency: str
    last_synced_at: datetime | None
