import asyncio
import json
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.signal_subscription import SignalSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User
from app.services.email_service import email_service
from app.services.notification_service import notify

router = APIRouter()


async def _parse_event(request: Request) -> dict:
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not settings.STRIPE_WEBHOOK_SECRET:
        try:
            return json.loads(payload)
        except Exception:
            raise HTTPException(400, "Invalid payload")
    try:
        return stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid Stripe signature")


async def _sub_by_stripe(sid: str, db: AsyncSession) -> SignalSubscription | None:
    r = await db.execute(select(SignalSubscription).where(SignalSubscription.stripe_subscription_id == sid))
    return r.scalar_one_or_none()


async def _get_user(user_id, db: AsyncSession) -> User | None:
    r = await db.execute(select(User).where(User.id == user_id))
    return r.scalar_one_or_none()


async def _master_name(sub: SignalSubscription, db: AsyncSession) -> str:
    m = await _get_user(sub.master_id, db)
    return (m.display_name or m.username or "Master") if m else "Master"


async def _follower_count(master_id, db: AsyncSession) -> int:
    return await db.scalar(
        select(func.count()).select_from(SignalSubscription)
        .where(SignalSubscription.master_id == master_id, SignalSubscription.status == "ACTIVE")
    ) or 0


async def _plan_price(sub: SignalSubscription, db: AsyncSession) -> float:
    if sub.plan_id:
        plan = await db.get(SubscriptionPlan, sub.plan_id)
        if plan:
            return float(plan.price_usd)
    return 0.0


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    event = await _parse_event(request)
    etype: str = event.get("type", "")
    obj: dict = event.get("data", {}).get("object", {})

    # Payment succeeded → activate + email follower + notify master of new follower
    if etype == "invoice.payment_succeeded":
        sid = obj.get("subscription")
        if sid:
            sub = await _sub_by_stripe(sid, db)
            if sub and sub.status == "PENDING":
                sub.status = "ACTIVE"
                name = await _master_name(sub, db)
                await notify(db, user_id=sub.follower_id, type="SUBSCRIPTION",
                             title=f"Subscription activated — {name}",
                             body="Payment confirmed. Copy trading is now active.",
                             data={"subscription_id": str(sub.id)})
                await db.commit()

                follower = await _get_user(sub.follower_id, db)
                master = await _get_user(sub.master_id, db)
                price = await _plan_price(sub, db)
                if follower:
                    asyncio.create_task(email_service.send_subscription_confirmed(
                        to_email=follower.email, master_name=name,
                        price_usd=price, lot_multiplier=float(sub.lot_multiplier or 1),
                        max_drawdown=float(sub.max_drawdown_pct or 20),
                    ))
                if master:
                    follower_name = (follower.display_name or follower.username or "A trader") if follower else "A trader"
                    count = await _follower_count(sub.master_id, db)
                    asyncio.create_task(email_service.send_new_follower(
                        to_email=master.email, follower_name=follower_name,
                        price_usd=price, total_followers=count,
                    ))

    # Payment failed → pause + email follower
    elif etype == "invoice.payment_failed":
        sid = obj.get("subscription")
        attempt = int(obj.get("attempt_count", 1))
        if sid:
            sub = await _sub_by_stripe(sid, db)
            if sub and sub.status == "ACTIVE":
                sub.status = "PAUSED"
                sub.pause_reason = f"Payment failed (attempt {attempt})"
                name = await _master_name(sub, db)
                await notify(db, user_id=sub.follower_id, type="SUBSCRIPTION",
                             title=f"Payment failed — {name}",
                             body=f"Card charge failed (attempt {attempt}). Copy trading paused until payment succeeds.",
                             data={"subscription_id": str(sub.id), "attempt": attempt})
                await db.commit()

                follower = await _get_user(sub.follower_id, db)
                if follower:
                    asyncio.create_task(email_service.send_payment_failed(
                        to_email=follower.email, master_name=name, attempt=attempt,
                    ))

    # Subscription cancelled via Stripe portal or API
    elif etype == "customer.subscription.deleted":
        sid = obj.get("id")
        if sid:
            sub = await _sub_by_stripe(sid, db)
            if sub and sub.status != "CANCELLED":
                sub.status = "CANCELLED"
                name = await _master_name(sub, db)
                await notify(db, user_id=sub.follower_id, type="SUBSCRIPTION",
                             title=f"Subscription cancelled — {name}",
                             body="Your subscription ended. Copy trading has stopped.",
                             data={"subscription_id": str(sub.id)})
                await db.commit()

    # Subscription reactivated after failed payment resolved
    elif etype == "customer.subscription.updated":
        sid = obj.get("id")
        if sid and obj.get("status") == "active":
            sub = await _sub_by_stripe(sid, db)
            if sub and sub.status == "PAUSED" and "Payment" in (sub.pause_reason or ""):
                sub.status = "ACTIVE"
                sub.pause_reason = None
                name = await _master_name(sub, db)
                await notify(db, user_id=sub.follower_id, type="SUBSCRIPTION",
                             title=f"Subscription resumed — {name}",
                             body="Payment succeeded. Copy trading is active again.",
                             data={"subscription_id": str(sub.id)})
                await db.commit()

                follower = await _get_user(sub.follower_id, db)
                if follower:
                    price = await _plan_price(sub, db)
                    asyncio.create_task(email_service.send_subscription_confirmed(
                        to_email=follower.email, master_name=name,
                        price_usd=price, lot_multiplier=float(sub.lot_multiplier or 1),
                        max_drawdown=float(sub.max_drawdown_pct or 20),
                    ))

    return {"received": True}
