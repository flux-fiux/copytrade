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
    plan_id: str
    follower_account_id: str


class SubscribeResponse(BaseModel):
    subscription_id: str
    client_secret: str | None
    status: str


class MySubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    master_id: uuid.UUID
    status: str
    stripe_subscription_id: str | None
    lot_multiplier: Decimal
    subscribed_at: str

    @classmethod
    def from_orm_with_date(cls, obj):
        return cls(
            id=obj.id,
            master_id=obj.master_id,
            status=obj.status,
            stripe_subscription_id=obj.stripe_subscription_id,
            lot_multiplier=obj.lot_multiplier,
            subscribed_at=obj.subscribed_at.isoformat() if obj.subscribed_at else "",
        )
