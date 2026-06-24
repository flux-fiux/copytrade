import json
import time as _time
from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis as AsyncRedis
from app.core.config import settings
from app.core.auth import get_current_user
from app.core.database import get_db
from app.services.market_data import market_data_service
from app.services.ohlcv_service import ohlcv_service

router = APIRouter()

_redis: AsyncRedis | None = None


def _get_redis() -> AsyncRedis | None:
    global _redis
    if _redis is None and settings.REDIS_URL:
        try:
            _redis = AsyncRedis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            pass
    return _redis


async def _cache_get(key: str) -> dict | None:
    r = _get_redis()
    if not r:
        return None
    try:
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def _cache_set(key: str, data: dict | list, ttl: int) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, json.dumps(data))
    except Exception:
        pass


@router.get("/quote")
async def get_quote(symbol: str = Query(..., min_length=1, max_length=20)):
    cache_key = f"quote:{symbol.upper()}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await market_data_service.get_quote(symbol.upper())
    except Exception as e:
        raise HTTPException(502, detail=f"Market data error: {e}")
    await _cache_set(cache_key, data, ttl=5)
    return data


@router.get("/candles")
async def get_candles(
    symbol: str = Query("EURUSD"),
    timeframe: str = Query("1h"),
    limit: int = Query(300, le=1000),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"candles:{symbol.upper()}:{timeframe}:{limit}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached
    try:
        candles = await ohlcv_service.get_candles(db, symbol, timeframe, limit)
    except Exception as e:
        raise HTTPException(502, detail=f"Market data error: {e}")
    result = {"symbol": symbol.upper(), "timeframe": timeframe, "candles": candles}
    if candles:
        await _cache_set(cache_key, result, ttl=60)
    return result


@router.post("/candles/backfill")
async def trigger_backfill(
    symbol: str = Query("EURUSD"),
    timeframe: str = Query("1d"),
    days: int = Query(90, le=365),
    _: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = int(_time.time())
    candles = await ohlcv_service.fetch_from_finnhub(symbol, timeframe, now - 86400 * days, now)
    n = await ohlcv_service.upsert_candles(db, candles)
    return {"inserted": n, "symbol": symbol.upper(), "timeframe": timeframe, "days": days}


@router.get("/search")
async def search_symbols(q: str = Query(..., min_length=1)):
    try:
        return await market_data_service.search_symbols(q)
    except Exception as e:
        raise HTTPException(502, detail=f"Search error: {e}")


@router.get("/news")
async def get_news(symbol: str = Query(...), limit: int = Query(10, ge=1, le=50)):
    cache_key = f"news:{symbol.upper()}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await market_data_service.get_news(symbol.upper(), limit)
    except Exception as e:
        raise HTTPException(502, detail=f"News error: {e}")
    await _cache_set(cache_key, data, ttl=300)
    return data


@router.get("/calendar")
async def get_economic_calendar(
    from_date: str = Query(default=""),
    to_date: str = Query(default=""),
):
    import datetime
    today = datetime.date.today()
    if not from_date:
        from_date = str(today)
    if not to_date:
        to_date = str(today + datetime.timedelta(days=7))
    cache_key = f"calendar:{from_date}:{to_date}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await market_data_service.get_economic_calendar(from_date, to_date)
    except Exception as e:
        raise HTTPException(502, detail=f"Calendar error: {e}")
    await _cache_set(cache_key, data, ttl=3600)
    return data
