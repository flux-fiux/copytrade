import asyncio
import logging
from sqlalchemy import select
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)
from app.core.database import AsyncSessionLocal
from app.models.signal_subscription import SignalSubscription
from app.services.risk_guard import risk_guard


@celery_app.task(name="app.workers.risk_guard_tasks.check_all_subscriptions")
def check_all_subscriptions():
    async def _run():
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(SignalSubscription).where(SignalSubscription.status == "ACTIVE")
            )
            subscriptions = result.scalars().all()

            paused = 0
            for sub in subscriptions:
                try:
                    check = await risk_guard.check_subscription(sub, session)
                    if check["breached"]:
                        await risk_guard.pause_subscription(
                            sub,
                            f"Max drawdown {check['limit']}% exceeded (current: {check['current_drawdown']}%)",
                            session,
                        )
                        paused += 1
                except Exception as e:
                    logger.error("[RiskGuard] Error checking %s: %s", sub.id, e)

            logger.info("[RiskGuard] Checked %d subscriptions, paused %d", len(subscriptions), paused)

    asyncio.run(_run())
