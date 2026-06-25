"""
ZuluGuard-style automatic drawdown protection.
Runs hourly, pauses subscriptions that breached user-set weekly drawdown limit.
"""
from __future__ import annotations

import datetime
import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.copy_trade import CopyTrade
from app.models.signal_subscription import SignalSubscription
from app.models.user import User
from app.services.email_service import email_service
from app.services.notification_service import notify

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.risk_guard.check_drawdown_limits", bind=True)
def check_drawdown_limits(self) -> dict:
    import asyncio
    return asyncio.run(_async_check())


async def _async_check() -> dict:
    paused = 0
    checked = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SignalSubscription).where(
                SignalSubscription.status == "ACTIVE",
                SignalSubscription.max_drawdown_pct.is_not(None),
            )
        )
        subscriptions = result.scalars().all()
        checked = len(subscriptions)

        week_start = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)

        for sub in subscriptions:
            threshold = float(sub.max_drawdown_pct)
            if threshold <= 0:
                continue

            pnl_result = await db.execute(
                select(func.coalesce(func.sum(CopyTrade.profit), 0)).where(
                    CopyTrade.subscription_id == sub.id,
                    CopyTrade.created_at >= week_start,
                )
            )
            weekly_pnl = float(pnl_result.scalar() or 0)

            base = float(sub.performance_fee_hwm or 10000)
            if base <= 0:
                continue

            drawdown_pct = abs(weekly_pnl) / base * 100 if weekly_pnl < 0 else 0

            if drawdown_pct >= threshold:
                sub.status = "PAUSED_DRAWDOWN"
                sub.pause_reason = f"Weekly drawdown {drawdown_pct:.1f}% exceeded limit {threshold:.0f}%"
                paused += 1
                logger.warning(
                    "Subscription %s paused: weekly drawdown %.1f%% >= limit %.1f%%",
                    sub.id, drawdown_pct, threshold,
                )

                # Look up follower email and master name for alert + notification
                try:
                    follower_result = await db.execute(select(User).where(User.id == sub.follower_id))
                    follower = follower_result.scalar_one_or_none()
                    master_result = await db.execute(select(User).where(User.id == sub.master_id))
                    master = master_result.scalar_one_or_none()
                    master_name = (master.display_name or master.username or "Master") if master else "Master"
                    if follower and follower.email:
                        await email_service.send_drawdown_alert(
                            to_email=follower.email,
                            master_name=master_name,
                            current_drawdown=drawdown_pct,
                            max_drawdown=threshold,
                        )
                    if follower:
                        await notify(
                            db,
                            user_id=follower.id,
                            type="DRAWDOWN",
                            title=f"Auto-paused: {master_name}",
                            body=f"Weekly drawdown {drawdown_pct:.1f}% exceeded your {threshold:.0f}% limit. Copy trading paused.",
                            data={"subscription_id": str(sub.id), "drawdown_pct": drawdown_pct, "threshold": threshold},
                        )
                except Exception as exc:
                    logger.warning("Drawdown alert failed: %s", exc)

        if paused:
            await db.commit()

    return {"checked": checked, "paused": paused}
