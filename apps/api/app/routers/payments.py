"""CryptoMus payment router — crypto subscription payments."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.config import settings
from app.models.signal_subscription import SignalSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.services.cryptomus_service import cryptomus_service

router = APIRouter()


class CreatePaymentRequest(BaseModel):
    subscription_id: uuid.UUID
    currency: str = "USDT"
    network: str = "TRON"


@router.post("/create")
async def create_payment(
    payload: CreatePaymentRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SignalSubscription).where(SignalSubscription.id == payload.subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if str(sub.follower_id) != current_user["sub"]:
        raise HTTPException(403, "Not authorized")

    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.master_id == sub.master_id)
    )
    plan = plan_result.scalar_one_or_none()
    amount = float(plan.price_usd) if plan else 29.0

    order_id = f"sub_{sub.id}_{uuid.uuid4().hex[:8]}"
    callback_url = f"{settings.API_BASE_URL}/api/v1/payments/webhook"
    success_url = f"{settings.FRONTEND_URL}/dashboard/subscriptions?success=1"

    payment = await cryptomus_service.create_payment(
        amount=amount,
        currency=payload.currency,
        network=payload.network,
        order_id=order_id,
        callback_url=callback_url,
        success_url=success_url,
    )

    sub.cryptomus_payment_uuid = payment.get("uuid")
    await db.commit()

    return {
        "payment_url": payment.get("url"),
        "payment_uuid": payment.get("uuid"),
        "amount": amount,
        "currency": payload.currency,
        "network": payload.network,
        "address": payment.get("address"),
    }


@router.post("/webhook")
async def payment_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    if not cryptomus_service.verify_webhook(dict(body)):
        raise HTTPException(400, "Invalid webhook signature")

    status = body.get("status")
    order_id = body.get("order_id", "")

    if status == "paid" and order_id.startswith("sub_"):
        parts = order_id.split("_")
        if len(parts) >= 2:
            try:
                sub_id = uuid.UUID(parts[1])
                result = await db.execute(
                    select(SignalSubscription).where(SignalSubscription.id == sub_id)
                )
                sub = result.scalar_one_or_none()
                if sub and sub.status != "ACTIVE":
                    sub.status = "ACTIVE"
                    await db.commit()
            except (ValueError, Exception):
                pass

    return {"received": True}


@router.get("/status/{payment_uuid}")
async def check_payment_status(
    payment_uuid: str,
    current_user: dict = Depends(get_current_user),
):
    return await cryptomus_service.get_payment_status(payment_uuid)
