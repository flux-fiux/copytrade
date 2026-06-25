import uuid
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class SubscriptionPlanCreate(BaseModel):
    name: str = "Standard"
    price_usd: float
    performance_fee_pct: float = 0.0
    features: list[str] = []


class SubscriptionPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    master_id: uuid.UUID
    name: str
    price_usd: Decimal
    performance_fee_pct: Decimal
    stripe_price_id: str | None
    features: list
    is_active: bool


class SubscribeRequest(BaseModel):
    master_id: str
    plan_id: str | None = None
    follower_account_id: str | None = None
    lot_multiplier: float = 1.0
    max_drawdown_pct: float = 20.0


class SubscribeResponse(BaseModel):
    subscription_id: str
    client_secret: str | None
    status: str


class MySubscriptionOut(BaseModel):
    id: str
    master_id: str
    master_username: str | None = None
    master_grade: str | None = None
    price_usd: float | None = None
    status: str
    lot_multiplier: float
    created_at: str
    next_billing_date: str | None = None
    pnl: float | None = None
    return_pct: float | None = None
    pause_reason: str | None = None
