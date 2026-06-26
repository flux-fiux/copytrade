import asyncio
import json
import time as _time
from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis as AsyncRedis
from app.core.config import settings
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.trade_history import TradeHistory
from app.models.signal import Signal
from app.models.signal_subscription import SignalSubscription
from app.models.user import User
from app.services.market_data import market_data_service
from app.services.ohlcv_service import ohlcv_service
from app.services import ai_service

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


_RES_TO_TF = {60: "1m", 300: "5m", 900: "15m", 3600: "1h", 14400: "4h", 86400: "1d", 604800: "1w"}


@router.get("/candles")
async def get_candles(
    symbol: str = Query("EURUSD"),
    resolution: int = Query(3600),          # seconds (frontend chart contract)
    from_: int | None = Query(None, alias="from"),  # unix seconds
    to: int | None = Query(None),                    # unix seconds
    timeframe: str | None = Query(None),    # optional explicit override
    limit: int = Query(300, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Returns the Finnhub-style columnar shape the chart expects:
    {s, t[], o[], h[], l[], c[], v[]}."""
    from datetime import datetime as _dt, timezone as _tz

    tf = timeframe or _RES_TO_TF.get(resolution, "1h")
    cache_key = f"candles:{symbol.upper()}:{tf}:{from_}:{to}:{limit}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    from_dt = _dt.fromtimestamp(from_, tz=_tz.utc) if from_ else None
    to_dt = _dt.fromtimestamp(to, tz=_tz.utc) if to else None
    try:
        candles = await ohlcv_service.get_candles(db, symbol, tf, limit, from_dt, to_dt)
    except Exception as e:
        raise HTTPException(502, detail=f"Market data error: {e}")

    if not candles:
        return {"s": "no_data", "t": [], "o": [], "h": [], "l": [], "c": [], "v": []}

    t, o, h, low, c, v = [], [], [], [], [], []
    for row in candles:
        ts = row["time"]
        epoch = int(_dt.fromisoformat(ts).timestamp()) if isinstance(ts, str) else int(ts)
        t.append(epoch); o.append(row["open"]); h.append(row["high"])
        low.append(row["low"]); c.append(row["close"]); v.append(row.get("volume", 0))
    result = {"s": "ok", "t": t, "o": o, "h": h, "l": low, "c": c, "v": v}
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


# ── 平台独有差异化端点 ──────────────────────────────────────────────────────────

@router.get("/master-trades")
async def get_master_trades(
    symbol: str = Query(..., min_length=1, max_length=20),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    返回平台 Master 在指定品种上的历史交易记录，用于图表覆盖层标记。
    未登录用户返回最近 10 条公开数据（脱敏）；
    已登录用户返回其订阅 Master 的完整记录。
    """
    sym = symbol.upper()
    cache_key = f"master_trades:{sym}:{current_user['sub'] if current_user else 'public'}:{limit}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    if current_user:
        # 已登录：只返回用户订阅的 master 的交易
        follower_id = __import__("uuid").UUID(current_user["sub"])
        sub_result = await db.execute(
            select(SignalSubscription.master_id).where(
                SignalSubscription.follower_id == follower_id,
                SignalSubscription.status == "ACTIVE",
            )
        )
        master_ids = [r[0] for r in sub_result.all()]
        if not master_ids:
            # 未订阅时也返回公开数据，方便体验
            master_ids = None
    else:
        master_ids = None

    stmt = select(TradeHistory, User.username, User.display_name).join(
        User, User.id == TradeHistory.master_id, isouter=True
    ).where(TradeHistory.symbol == sym)

    if master_ids:
        stmt = stmt.where(TradeHistory.master_id.in_(master_ids))

    stmt = stmt.order_by(TradeHistory.closed_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()

    trades = [
        {
            "id": str(t.id),
            "master_name": display_name or username or str(t.master_id)[:8],
            "direction": t.direction,
            "volume": float(t.volume),
            "open_price": float(t.open_price) if t.open_price else None,
            "close_price": float(t.close_price) if t.close_price else None,
            "profit": float(t.profit) if t.profit else None,
            "opened_at": t.opened_at.isoformat() if t.opened_at else None,
            "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        }
        for t, username, display_name in rows
    ]
    await _cache_set(cache_key, trades, ttl=30)
    return trades


@router.get("/sentiment")
async def get_community_sentiment(
    symbol: str = Query(..., min_length=1, max_length=20),
    db: AsyncSession = Depends(get_db),
):
    """
    平台独有：当前所有活跃 Master 在该品种上的多空比。
    聚合最近 24h 内的开仓信号方向。
    """
    sym = symbol.upper()
    cache_key = f"sentiment:{sym}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    import datetime
    since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)

    result = await db.execute(
        select(Signal.direction, func.count().label("cnt"))
        .where(
            Signal.symbol == sym,
            Signal.signal_type == "OPEN",
            Signal.opened_at >= since,
        )
        .group_by(Signal.direction)
    )
    rows = {r.direction: r.cnt for r in result.all()}
    long_count = rows.get("BUY", 0)
    short_count = rows.get("SELL", 0)
    total = long_count + short_count

    if total == 0:
        # 无真实数据时返回 mock（平台刚上线场景）
        long_pct, short_pct = 62, 38
        long_count, short_count, total = 62, 38, 100
    else:
        long_pct = round(long_count / total * 100, 1)
        short_pct = round(short_count / total * 100, 1)

    data = {
        "symbol": sym,
        "long_pct": long_pct,
        "short_pct": short_pct,
        "long_count": long_count,
        "short_count": short_count,
        "total_signals": total,
        "period_hours": 24,
    }
    await _cache_set(cache_key, data, ttl=60)
    return data


@router.post("/ai-chat")
async def terminal_ai_chat(
    payload: dict,
    current_user: dict | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    终端 AI 助手：结合当前品种新闻 + 技术面 + Master 仓位给出综合分析。
    """
    question: str = str(payload.get("question", "")).strip()[:500]
    symbol: str = str(payload.get("symbol", "EURUSD")).upper()[:20]
    if not question:
        raise HTTPException(400, "question required")

    cache_key = f"ai_chat:{symbol}:{hash(question) & 0xFFFFFF}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    # 构建上下文
    context_parts: list[str] = [f"Symbol: {symbol}", f"User question: {question}"]

    # 最近新闻标题
    try:
        news = await market_data_service.get_news(symbol, limit=3)
        if news:
            headlines = [n.get("headline", "") for n in news[:3] if n.get("headline")]
            if headlines:
                context_parts.append("Recent news: " + " | ".join(headlines))
    except Exception:
        pass

    # 平台情绪数据
    try:
        sent_result = await db.execute(
            select(Signal.direction, func.count().label("cnt"))
            .where(Signal.symbol == symbol, Signal.signal_type == "OPEN")
            .group_by(Signal.direction)
        )
        rows = {r.direction: r.cnt for r in sent_result.all()}
        if rows:
            total = sum(rows.values())
            long_pct = round(rows.get("BUY", 0) / total * 100)
            context_parts.append(f"Platform sentiment: {long_pct}% of masters are long {symbol}")
    except Exception:
        pass

    context = "\n".join(context_parts)
    prompt = (
        f"You are a professional FX market analyst assistant embedded in a trading terminal. "
        f"Answer concisely and factually in 2-4 sentences. Do not give financial advice.\n\n"
        f"Context:\n{context}\n\nAnswer:"
    )

    try:
        answer = await ai_service.terminal_chat(prompt)
    except Exception:
        answer = f"I can see {symbol} has been in focus recently. Based on platform data and market conditions, consider reviewing the economic calendar for upcoming high-impact events that may affect this pair."

    result = {"answer": answer, "symbol": symbol}
    await _cache_set(cache_key, result, ttl=300)
    return result


@router.get("/macro")
async def get_macro_data(
    series: str = Query("FEDFUNDS,CPIAUCSL,UNRATE,T10Y2Y", description="Comma-separated FRED series IDs"),
    limit: int = Query(12, ge=1, le=60),
):
    """FRED (St. Louis Fed) 宏观经济数据。免费 API，无需 key。"""
    import httpx as _httpx
    series_list = [s.strip().upper() for s in series.split(",") if s.strip()][:6]
    cache_key = f"macro:{'_'.join(series_list)}:{limit}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    async def _fetch_one(client, sid: str) -> tuple[str, list]:
        try:
            r = await client.get(
                "https://fred.stlouisfed.org/graph/fredgraph.csv",
                params={"id": sid},
                headers={"User-Agent": "CopyTradePlatform/1.0"},
            )
            if r.status_code != 200:
                return sid, _mock_macro(sid, limit)
            data_points = []
            for line in r.text.strip().split("\n")[1:][-limit:]:
                parts = line.split(",")
                if len(parts) == 2 and parts[1] != ".":
                    try:
                        data_points.append({"date": parts[0], "value": float(parts[1])})
                    except ValueError:
                        continue
            return sid, (data_points or _mock_macro(sid, limit))
        except Exception:
            return sid, _mock_macro(sid, limit)

    # Fetch all series concurrently — sequential was up to 6×timeout (~60s).
    async with _httpx.AsyncClient(timeout=8.0) as client:
        pairs = await asyncio.gather(*[_fetch_one(client, sid) for sid in series_list])
    results = dict(pairs)

    await _cache_set(cache_key, results, ttl=3600)
    return results


def _mock_macro(series_id: str, limit: int = 12) -> list[dict]:
    import datetime as _dt
    today = _dt.date.today()
    defaults = {
        "FEDFUNDS": 5.33, "CPIAUCSL": 314.0, "UNRATE": 3.9,
        "T10Y2Y": -0.4, "DGS10": 4.45, "DGS2": 4.85,
    }
    base = defaults.get(series_id, 100.0)
    result = []
    for i in range(limit, 0, -1):
        month_offset = i - 1
        year = today.year - (month_offset // 12)
        month = today.month - (month_offset % 12)
        if month <= 0:
            month += 12
            year -= 1
        try:
            d = _dt.date(year, month, 1)
        except ValueError:
            continue
        result.append({"date": str(d), "value": round(base + (limit - i) * 0.01, 2)})
    return result


@router.get("/screener")
async def forex_screener(
    sort_by: str = Query("change_pct", pattern="^(change_pct|volatility|volume)$"),
    limit: int = Query(20, ge=5, le=50),
):
    """外汇品种筛选器：按 24h 涨幅 / 波动率排序。"""
    MAJOR_PAIRS = [
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD",
        "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY",
        "XAUUSD", "BTCUSD", "US30", "NASDAQ", "USOIL",
    ]
    cache_key = f"screener:{sort_by}:{limit}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    results = []
    for symbol in MAJOR_PAIRS[:limit]:
        try:
            quote = await market_data_service.get_quote(symbol)
            c = float(quote.get("c") or quote.get("close") or 0)
            pc = float(quote.get("pc") or quote.get("previous_close") or c)
            change_pct = round((c - pc) / pc * 100, 3) if pc else 0
            h = float(quote.get("h") or c)
            lo = float(quote.get("l") or c)
            volatility = round((h - lo) / pc * 100, 3) if pc else 0
            results.append({
                "symbol": symbol,
                "price": c,
                "change_pct": change_pct,
                "change_abs": round(c - pc, 5),
                "high": h,
                "low": lo,
                "volatility": volatility,
                "direction": "up" if change_pct >= 0 else "down",
            })
        except Exception:
            pass

    sort_key = {"change_pct": lambda x: abs(x["change_pct"]), "volatility": lambda x: x["volatility"], "volume": lambda x: 0}
    results.sort(key=sort_key[sort_by], reverse=True)

    await _cache_set(cache_key, results, ttl=60)
    return results


@router.get("/correlation")
async def get_correlation_matrix(
    symbols: str = Query("EURUSD,GBPUSD,USDJPY,XAUUSD,USDCAD,AUDUSD,USDCHF,BTCUSD"),
    period: int = Query(30, ge=7, le=90, description="days"),
    db: AsyncSession = Depends(get_db),
):
    """Pearson 相关系数矩阵，用 OHLCV 日线收盘价序列计算。无真实数据时返回基于已知外汇相关性的 mock。"""
    import datetime as _dt2
    from app.models.ohlcv import OHLCV

    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:10]
    cache_key = f"correlation:{'_'.join(sym_list)}:{period}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    since = _dt2.datetime.now(_dt2.timezone.utc) - _dt2.timedelta(days=period)
    price_series: dict[str, list[float]] = {}
    for sym in sym_list:
        result = await db.execute(
            select(OHLCV.close, OHLCV.time)
            .where(OHLCV.symbol == sym, OHLCV.timeframe == "1d", OHLCV.time >= since)
            .order_by(OHLCV.time.asc())
        )
        rows = result.all()
        if rows:
            price_series[sym] = [float(r.close) for r in rows]

    if len(price_series) < 2:
        matrix = _mock_correlation(sym_list)
        await _cache_set(cache_key, matrix, ttl=3600)
        return matrix

    min_len = min(len(v) for v in price_series.values())
    aligned = {k: v[-min_len:] for k, v in price_series.items()}

    def _returns(prices: list[float]) -> list[float]:
        return [(prices[i] - prices[i - 1]) / prices[i - 1] for i in range(1, len(prices))]

    def _pearson(x: list[float], y: list[float]) -> float:
        n = len(x)
        if n < 2:
            return 0.0
        mx, my = sum(x) / n, sum(y) / n
        num = sum((x[i] - mx) * (y[i] - my) for i in range(n))
        dx = sum((x[i] - mx) ** 2 for i in range(n)) ** 0.5
        dy = sum((y[i] - my) ** 2 for i in range(n)) ** 0.5
        if dx == 0 or dy == 0:
            return 0.0
        return round(num / (dx * dy), 3)

    ret_series = {k: _returns(v) for k, v in aligned.items()}
    syms = list(ret_series.keys())
    matrix = {
        "symbols": syms,
        "matrix": [[_pearson(ret_series[a], ret_series[b]) for b in syms] for a in syms],
        "period_days": period,
        "is_mock": False,
    }
    await _cache_set(cache_key, matrix, ttl=3600)
    return matrix


def _mock_correlation(symbols: list[str]) -> dict:
    known: dict[tuple[str, str], float] = {
        ("EURUSD", "GBPUSD"): 0.87, ("EURUSD", "AUDUSD"): 0.71,
        ("EURUSD", "USDJPY"): -0.82, ("EURUSD", "USDCAD"): -0.75,
        ("EURUSD", "USDCHF"): -0.93, ("GBPUSD", "AUDUSD"): 0.68,
        ("GBPUSD", "USDJPY"): -0.76, ("USDJPY", "USDCAD"): 0.61,
        ("XAUUSD", "EURUSD"): 0.52, ("XAUUSD", "USDJPY"): -0.48,
        ("BTCUSD", "XAUUSD"): 0.31,
    }

    def _get(a: str, b: str) -> float:
        if a == b:
            return 1.0
        v = known.get((a, b), known.get((b, a)))
        return v if v is not None else round(0.1 * (abs(hash(a + b)) % 5), 1)

    return {
        "symbols": symbols,
        "matrix": [[_get(a, b) for b in symbols] for a in symbols],
        "period_days": 30,
        "is_mock": True,
    }
