"""Celery tasks for OHLCV data backfill and hourly refresh."""
import asyncio
from datetime import datetime, timezone
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.services.ohlcv_service import ohlcv_service

SYMBOLS = ["AAPL", "EURUSD", "BTCUSD", "XAUUSD", "GBPUSD", "USDJPY", "SPX", "NAS100"]
TIMEFRAMES = ["1h", "4h", "1d"]


@celery_app.task(name="app.workers.ohlcv_tasks.refresh_ohlcv")
def refresh_ohlcv():
    """Fetch latest candles for watched symbols — runs every hour."""
    async def _run():
        async with AsyncSessionLocal() as session:
            now = int(datetime.now(timezone.utc).timestamp())
            count = 0
            for symbol in SYMBOLS:
                for tf in TIMEFRAMES:
                    try:
                        candles = await ohlcv_service.fetch_from_finnhub(
                            symbol, tf, now - 3600 * 24 * 7, now
                        )
                        count += await ohlcv_service.upsert_candles(session, candles)
                    except Exception as e:
                        print(f"[OHLCV] Error {symbol}/{tf}: {e}")
            print(f"[OHLCV] Refreshed {count} candles for {len(SYMBOLS)} symbols")
    asyncio.run(_run())


@celery_app.task(name="app.workers.ohlcv_tasks.backfill_ohlcv")
def backfill_ohlcv(symbol: str = "EURUSD", timeframe: str = "1h", days: int = 90):
    """Backfill historical candles for a specific symbol."""
    async def _run():
        async with AsyncSessionLocal() as session:
            now = int(datetime.now(timezone.utc).timestamp())
            candles = await ohlcv_service.fetch_from_finnhub(
                symbol, timeframe, now - 86400 * days, now
            )
            n = await ohlcv_service.upsert_candles(session, candles)
            print(f"[OHLCV] Backfilled {n} candles for {symbol}/{timeframe}")
    asyncio.run(_run())
