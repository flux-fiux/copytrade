"""NOWPayments crypto payment router — crypto subscription payments."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.config import settings
from app.models.signal_subscription import SignalSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.services.nowpayments_service import nowpayments_service

router = APIRouter()


class CreatePaymentRequest(BaseModel):
    subscription_id: uuid.UUID
    currency: str = "USDT"
    network: str = "BSC"  # BEP20 — far lower network fee than TRON on NOWPayments


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

    payment = await nowpayments_service.create_payment(
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
    raw = await request.body()
    try:
        body = json.loads(raw)
    except Exception:
        raise HTTPException(400, "Invalid payload")

    signature = request.headers.get("x-nowpayments-sig", "")
    if not nowpayments_service.verify_webhook(body, signature):
        raise HTTPException(400, "Invalid webhook signature")

    payment_status = body.get("payment_status")
    order_id = body.get("order_id", "") or ""
    payment_id = str(body.get("payment_id", ""))

    # NOWPayments marks a fully-paid invoice as "finished". Anything else: ack & ignore.
    if payment_status != "finished" or not order_id.startswith("sub_"):
        return {"received": True}

    parts = order_id.split("_")
    if len(parts) < 2:
        return {"received": True}
    try:
        sub_id = uuid.UUID(parts[1])
    except ValueError:
        # Malformed order_id — nothing actionable; ack so NOWPayments stops retrying.
        return {"received": True}

    # IMPORTANT: from here, do NOT swallow exceptions. On a real error we must return
    # 5xx so NOWPayments retries — otherwise a paid user silently gets nothing.
    # Lock the row so concurrent IPN retries can't double-credit.
    result = await db.execute(
        select(SignalSubscription).where(SignalSubscription.id == sub_id).with_for_update()
    )
    sub = result.scalar_one_or_none()
    if not sub or not payment_id:
        return {"received": True}

    # Bind this webhook to the invoice WE created for this subscription — reject a
    # forged/replayed webhook pointing at someone else's subscription id.
    invoice_id = str(body.get("invoice_id", "") or "")
    if sub.cryptomus_payment_uuid and invoice_id and invoice_id != str(sub.cryptomus_payment_uuid):
        raise HTTPException(400, "Payment does not match subscription invoice")

    # Guard under/partial payment — don't grant a full period for less than invoiced.
    # Prices are quoted in the pay stablecoin (USDT), so amounts are directly comparable.
    try:
        price_amount = float(body.get("price_amount") or 0)
        actually_paid = float(body.get("actually_paid") or body.get("pay_amount") or 0)
    except (TypeError, ValueError):
        price_amount, actually_paid = 0.0, 0.0
    if price_amount > 0 and actually_paid > 0 and actually_paid < price_amount * 0.97:
        return {"received": True}

    # Idempotent (row locked above): skip if this payment was already credited.
    if sub.last_credited_payment_uuid != payment_id:
        now = datetime.now(timezone.utc)
        base = sub.current_period_end if (sub.current_period_end and sub.current_period_end > now) else now
        sub.current_period_end = base + timedelta(days=30)
        sub.status = "ACTIVE"
        sub.last_credited_payment_uuid = payment_id
    await db.commit()
    return {"received": True}


@router.get("/status/{payment_uuid}")
async def check_payment_status(
    payment_uuid: str,
    current_user: dict = Depends(get_current_user),
):
    return await nowpayments_service.get_payment_status(payment_uuid)
