"""
Monthly performance fee settlement — High Water Mark (HWM) method.
Runs on the 1st of each month at UTC 02:00.
Platform takes 20% of performance fees; remaining 80% is transferred to Master.
"""
import logging
import datetime
import uuid

from sqlalchemy import select, func

from app.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.copy_trade import CopyTrade
from app.models.payment import Payment
from app.models.signal_subscription import SignalSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User
from app.services.notification_service import notify
from app.services.stripe_service import stripe_service

logger = logging.getLogger(__name__)

PLATFORM_TAKE_RATE = 0.20  # platform keeps 20% of performance fees
MIN_TRANSFER_CENTS = 100   # $1 minimum to avoid Stripe micro-transfer fees
BATCH_SIZE = 50


@celery_app.task(name="app.workers.settlement_tasks.monthly_settlement", bind=True, max_retries=2)
def monthly_settlement(self) -> dict:
    import asyncio
    return asyncio.run(_run_settlement())


async def _run_settlement() -> dict:
    month_label = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")
    settled = 0
    skipped = 0
    total_perf_fees = 0.0
    total_master_payouts = 0.0

    async with AsyncSessionLocal() as db:
        # Load active subscriptions that have a plan with performance fees
        result = await db.execute(
            select(SignalSubscription, SubscriptionPlan)
            .join(SubscriptionPlan, SignalSubscription.plan_id == SubscriptionPlan.id)
            .where(
                SignalSubscription.status == "ACTIVE",
                SubscriptionPlan.performance_fee_pct > 0,
            )
        )
        rows = result.all()

        batch_count = 0
        for sub, plan in rows:
            try:
                settled_flag = await _settle_one(db, sub, plan, month_label)
                if settled_flag:
                    settled += 1
                    total_perf_fees += settled_flag["perf_fee"]
                    total_master_payouts += settled_flag["master_payout"]
                else:
                    skipped += 1
                batch_count += 1
                if batch_count % BATCH_SIZE == 0:
                    await db.commit()
            except Exception as exc:
                logger.error("Settlement failed for subscription %s: %s", sub.id, exc)
                skipped += 1

        if batch_count % BATCH_SIZE != 0:
            await db.commit()

    logger.info(
        "Monthly settlement %s complete: settled=%d skipped=%d perf_fees=$%.2f master_payouts=$%.2f",
        month_label, settled, skipped, total_perf_fees, total_master_payouts,
    )
    return {
        "month": month_label,
        "settled": settled,
        "skipped": skipped,
        "total_perf_fees_usd": round(total_perf_fees, 2),
        "total_master_payouts_usd": round(total_master_payouts, 2),
    }


async def _settle_one(db, sub: SignalSubscription, plan: SubscriptionPlan, month_label: str) -> dict | None:
    # Idempotency guard: skip if a COMPLETED payment already exists for this sub+month
    existing = await db.scalar(
        select(Payment).where(
            Payment.subscription_id == sub.id,
            Payment.payment_type == "PERFORMANCE_FEE",
            Payment.description == f"Performance fee {month_label}",
            Payment.status == "COMPLETED",
        )
    )
    if existing:
        logger.info("Already settled sub %s for %s — skipping", sub.id, month_label)
        return None

    # True HWM: sum ALL copy trades (including losses) for cumulative net P&L.
    # Charging on gross-only would overcharge when losses partially offset gains.
    pnl_result = await db.scalar(
        select(func.coalesce(func.sum(CopyTrade.profit), 0))
        .where(CopyTrade.subscription_id == sub.id)
    )
    cumulative_pnl = float(pnl_result or 0)

    # HWM is a one-way ratchet — never moves down on losing periods.
    hwm = float(sub.performance_fee_hwm or 0)
    profit_above_hwm = max(0.0, cumulative_pnl - hwm)

    if profit_above_hwm <= 0:
        return None

    perf_fee_pct = float(plan.performance_fee_pct) / 100
    perf_fee_amount = profit_above_hwm * perf_fee_pct
    platform_cut = perf_fee_amount * PLATFORM_TAKE_RATE
    master_cut = perf_fee_amount * (1 - PLATFORM_TAKE_RATE)

    # Load master for Stripe Connect id
    master = await db.scalar(select(User).where(User.id == sub.master_id))
    follower = await db.scalar(select(User).where(User.id == sub.follower_id))

    stripe_transfer_id: str | None = None
    master_cut_cents = int(master_cut * 100)
    if master and master.stripe_connect_id and master_cut_cents >= MIN_TRANSFER_CENTS:
        try:
            stripe_transfer_id = await stripe_service.transfer_to_master(
                amount_cents=master_cut_cents,
                connect_account_id=master.stripe_connect_id,
                description=f"Performance fee settlement {month_label} — sub {sub.id}",
            )
        except Exception as exc:
            logger.warning("Stripe transfer failed for master %s: %s", sub.master_id, exc)

    # Record payment
    payment = Payment(
        tenant_id=sub.tenant_id,
        payer_id=sub.follower_id,
        payee_id=sub.master_id,
        subscription_id=sub.id,
        payment_type="PERFORMANCE_FEE",
        amount_usd=perf_fee_amount,
        platform_fee_usd=platform_cut,
        master_earnings_usd=master_cut,
        stripe_transfer_id=stripe_transfer_id,
        status="COMPLETED" if stripe_transfer_id else "PENDING",
        description=f"Performance fee {month_label}",
    )
    db.add(payment)

    # Advance the HWM (one-way ratchet: never decrease)
    sub.performance_fee_hwm = cumulative_pnl

    # Notify master
    if master:
        await notify(
            db,
            user_id=master.id,
            type="PAYMENT",
            title=f"Performance fee received — {month_label}",
            body=f"You received ${master_cut:.2f} in performance fees from follower #{str(sub.follower_id)[:8]}.",
            data={"amount_usd": master_cut, "month": month_label, "subscription_id": str(sub.id)},
        )

    # Notify follower
    if follower:
        master_name = (master.display_name or master.username or "your Master") if master else "your Master"
        await notify(
            db,
            user_id=follower.id,
            type="PAYMENT",
            title=f"Performance fee charged — {month_label}",
            body=f"${perf_fee_amount:.2f} performance fee charged for copying {master_name}.",
            data={"amount_usd": perf_fee_amount, "month": month_label, "subscription_id": str(sub.id)},
        )

    logger.info(
        "Settled sub %s: profit_above_hwm=$%.2f perf_fee=$%.2f master_payout=$%.2f transfer=%s",
        sub.id, profit_above_hwm, perf_fee_amount, master_cut, stripe_transfer_id or "PENDING",
    )
    return {"perf_fee": perf_fee_amount, "master_payout": master_cut}
