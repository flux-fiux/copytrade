"""OHLCV data service — fetches, stores, and queries candlestick data."""
from datetime import datetime, timezone
from typing import Optional
import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.ohlcv import OHLCV

TIMEFRAME_SECONDS = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
}

FINNHUB_RESOLUTION = {
    "1m": "1", "5m": "5", "15m": "15", "30m": "30",
    "1h": "60", "4h": "240", "1d": "D", "1w": "W",
}


class OHLCVService:
    async def fetch_from_finnhub(
        self,
        symbol: str,
        timeframe: str,
        from_ts: int,
        to_ts: int,
    ) -> list[dict]:
        if not settings.FINNHUB_API_KEY:
            return self._generate_mock_candles(symbol, timeframe, from_ts, to_ts)

        resolution = FINNHUB_RESOLUTION.get(timeframe, "D")
        params = {
            "symbol": symbol,
            "resolution": resolution,
            "from": from_ts,
            "to": to_ts,
            "token": settings.FINNHUB_API_KEY,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://finnhub.io/api/v1/stock/candle", params=params)
            data = resp.json()

        if data.get("s") != "ok" or not data.get("t"):
            return self._generate_mock_candles(symbol, timeframe, from_ts, to_ts)

        candles = []
        vol_list = data.get("v", [0] * len(data["t"]))
        for i, ts in enumerate(data["t"]):
            candles.append({
                "time": datetime.fromtimestamp(ts, tz=timezone.utc),
                "symbol": symbol.upper(),
                "timeframe": timeframe,
                "open": float(data["o"][i]),
                "high": float(data["h"][i]),
                "low": float(data["l"][i]),
                "close": float(data["c"][i]),
                "volume": float(vol_list[i]),
                "source": "finnhub",
            })
        return candles

    def _generate_mock_candles(
        self, symbol: str, timeframe: str, from_ts: int, to_ts: int
    ) -> list[dict]:
        import random, hashlib
        seed = int(hashlib.md5(symbol.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)

        interval_s = TIMEFRAME_SECONDS.get(timeframe, 3600)
        base_price = rng.uniform(1.05, 1.35) if "USD" in symbol else rng.uniform(100, 5000)

        candles = []
        ts = from_ts
        price = base_price
        while ts <= to_ts:
            change = rng.uniform(-0.005, 0.005)
            open_p = price
            close_p = price * (1 + change)
            high_p = max(open_p, close_p) * rng.uniform(1.0, 1.003)
            low_p = min(open_p, close_p) * rng.uniform(0.997, 1.0)
            candles.append({
                "time": datetime.fromtimestamp(ts, tz=timezone.utc),
                "symbol": symbol.upper(),
                "timeframe": timeframe,
                "open": round(open_p, 5),
                "high": round(high_p, 5),
                "low": round(low_p, 5),
                "close": round(close_p, 5),
                "volume": round(rng.uniform(100, 10000), 2),
                "source": "mock",
            })
            price = close_p
            ts += interval_s
        return candles

    async def upsert_candles(self, session: AsyncSession, candles: list[dict]) -> int:
        if not candles:
            return 0
        stmt = pg_insert(OHLCV).values(candles)
        stmt = stmt.on_conflict_do_update(
            index_elements=["time", "symbol", "timeframe"],
            set_={
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "volume": stmt.excluded.volume,
            },
        )
        await session.execute(stmt)
        await session.commit()
        return len(candles)

    async def get_candles(
        self,
        session: AsyncSession,
        symbol: str,
        timeframe: str,
        limit: int = 300,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> list[dict]:
        q = select(OHLCV).where(
            OHLCV.symbol == symbol.upper(),
            OHLCV.timeframe == timeframe,
        )
        if from_dt:
            q = q.where(OHLCV.time >= from_dt)
        if to_dt:
            q = q.where(OHLCV.time <= to_dt)
        q = q.order_by(OHLCV.time.desc()).limit(limit)

        result = await session.execute(q)
        rows = result.scalars().all()

        if not rows:
            now = int(datetime.now(timezone.utc).timestamp())
            interval_s = TIMEFRAME_SECONDS.get(timeframe, 3600)
            from_ts = now - interval_s * limit
            candles = await self.fetch_from_finnhub(symbol, timeframe, from_ts, now)
            await self.upsert_candles(session, candles)
            return sorted(
                [{"time": c["time"].isoformat(), "open": c["open"], "high": c["high"],
                  "low": c["low"], "close": c["close"], "volume": c["volume"]}
                 for c in candles],
                key=lambda x: x["time"],
            )

        return sorted(
            [{"time": r.time.isoformat(), "open": float(r.open), "high": float(r.high),
              "low": float(r.low), "close": float(r.close), "volume": float(r.volume)}
             for r in rows],
            key=lambda x: x["time"],
        )

    async def get_latest_candle(
        self, session: AsyncSession, symbol: str, timeframe: str
    ) -> Optional[dict]:
        q = select(OHLCV).where(
            OHLCV.symbol == symbol.upper(),
            OHLCV.timeframe == timeframe,
        ).order_by(OHLCV.time.desc()).limit(1)
        result = await session.execute(q)
        row = result.scalar_one_or_none()
        if not row:
            return None
        return {"time": row.time.isoformat(), "open": float(row.open), "high": float(row.high),
                "low": float(row.low), "close": float(row.close), "volume": float(row.volume)}


ohlcv_service = OHLCVService()
