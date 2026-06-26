import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.signal_subscription import SignalSubscription
from app.models.notification import Notification

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.subscription_expiry_tasks.expire_due_subscriptions")
def expire_due_subscriptions():
    """Crypto subscriptions are one-time payments per period. Downgrade ACTIVE
    subs whose paid period has elapsed to EXPIRED — signal distribution and copy
    execution both filter on status==ACTIVE, so this stops copying immediately."""
    async def _run():
        async with AsyncSessionLocal() as session:
            now = datetime.now(timezone.utc)
            rows = (
                await session.execute(
                    select(SignalSubscription).where(
                        SignalSubscription.status == "ACTIVE",
                        SignalSubscription.current_period_end.is_not(None),
                        SignalSubscription.current_period_end < now,
                    )
                )
            ).scalars().all()

            for sub in rows:
                sub.status = "EXPIRED"
                session.add(Notification(
                    tenant_id=sub.tenant_id,
                    user_id=sub.follower_id,
                    type="SUBSCRIPTION",
                    title="Subscription expired",
                    body="Your copy-trading subscription has expired. Renew to resume copying.",
                ))
            if rows:
                await session.commit()
            logger.info("[Expiry] Expired %d subscriptions", len(rows))

    asyncio.run(_run())
