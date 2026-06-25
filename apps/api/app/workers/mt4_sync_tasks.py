import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.mt4_account import MT4Account
from app.services.metaapi import metaapi_service

logger = logging.getLogger(__name__)

_META_STATUS_MAP = {
    "CONNECTED": "CONNECTED",
    "CONNECTING": "CONNECTING",
    "DISCONNECTED": "DISCONNECTED",
    "DISCONNECTING": "DISCONNECTED",
}


@celery_app.task(name="app.workers.mt4_sync_tasks.sync_all_accounts")
def sync_all_accounts():
    """Poll MetaAPI for every MT4 account and update connection_status, balance, equity."""
    async def _run():
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(MT4Account))
            accounts = result.scalars().all()

            updated = 0
            errors = 0
            for account in accounts:
                try:
                    info = await metaapi_service.get_account_information(
                        account.meta_api_account_id
                    )
                    raw_status = info.get("connectionStatus", "DISCONNECTED")
                    new_status = _META_STATUS_MAP.get(raw_status.upper(), "DISCONNECTED")

                    account.connection_status = new_status
                    if "balance" in info:
                        account.balance = float(info["balance"])
                    if "equity" in info:
                        account.equity = float(info["equity"])
                    account.last_synced_at = datetime.now(timezone.utc)
                    updated += 1
                except Exception as e:
                    errors += 1
                    logger.warning(
                        "[MT4Sync] account %s (%s) error: %s",
                        account.id,
                        account.meta_api_account_id,
                        e,
                    )

            await session.commit()
            logger.info(
                "[MT4Sync] Synced %d accounts (%d errors)", updated, errors
            )
            return {"updated": updated, "errors": errors}

    return asyncio.run(_run())
