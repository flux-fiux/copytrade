import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.signal_subscription import SignalSubscription

router = APIRouter()


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        # Dev mode: parse event directly without signature verification
        import json
        try:
            event = json.loads(payload)
        except Exception:
            raise HTTPException(400, "Invalid payload")
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(400, "Invalid signature")

    event_type = event.get("type", "")

    if event_type == "invoice.payment_succeeded":
        stripe_sub_id = event["data"]["object"].get("subscription")
        if stripe_sub_id:
            result = await db.execute(
                select(SignalSubscription).where(
                    SignalSubscription.stripe_subscription_id == stripe_sub_id
                )
            )
            sub = result.scalar_one_or_none()
            if sub and sub.status == "PENDING":
                sub.status = "ACTIVE"
                await db.commit()

    elif event_type == "customer.subscription.deleted":
        stripe_sub_id = event["data"]["object"].get("id")
        if stripe_sub_id:
            result = await db.execute(
                select(SignalSubscription).where(
                    SignalSubscription.stripe_subscription_id == stripe_sub_id
                )
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = "CANCELLED"
                await db.commit()

    return {"received": True}
