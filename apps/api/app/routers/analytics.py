import json
import uuid
import datetime
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.trade_history import TradeHistory
from app.models.copy_trade import CopyTrade

router = APIRouter()

# ── Redis cache helpers ────────────────────────────────────────────────────────

_redis = None


def _get_redis():
    global _redis
    if _redis is None and settings.REDIS_URL:
        try:
            from redis.asyncio import Redis as AsyncRedis
            _redis = AsyncRedis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            pass
    return _redis


async def _cache_get(key: str):
    r = _get_redis()
    if not r:
        return None
    try:
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def _cache_set(key: str, data, ttl: int) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, json.dumps(data, default=str))
    except Exception:
        pass


# ── Master backtest ────────────────────────────────────────────────────────────

@router.get("/masters/{master_id}/backtest")
async def backtest_master(
    master_id: uuid.UUID,
    start: datetime.date = Query(default=None),
    capital: float = Query(default=10000.0, ge=100, le=10_000_000),
    lot_multiplier: float = Query(default=1.0, ge=0.01, le=10),
    db: AsyncSession = Depends(get_db),
):
    if start is None:
        start = (datetime.date.today() - datetime.timedelta(days=90))

    cache_key = f"backtest:{master_id}:{start}:{capital}:{lot_multiplier}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(TradeHistory)
        .where(
            TradeHistory.master_id == master_id,
            TradeHistory.closed_at.isnot(None),
            TradeHistory.opened_at >= datetime.datetime.combine(start, datetime.time.min, tzinfo=datetime.timezone.utc),
        )
        .order_by(TradeHistory.closed_at.asc())
    )
    trades = result.scalars().all()

    if not trades:
        return {
            "master_id": str(master_id),
            "start": str(start),
            "capital": capital,
            "lot_multiplier": lot_multiplier,
            "total_trades": 0,
            "equity_curve": [],
            "total_return_pct": 0,
            "max_drawdown_pct": 0,
            "win_rate": 0,
            "avg_profit_per_trade": 0,
        }

    equity = capital
    peak = capital
    max_dd = 0.0
    equity_curve = []
    wins = 0

    for t in trades:
        p = float(t.profit or 0) * lot_multiplier
        equity += p
        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak * 100 if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd
        if p > 0:
            wins += 1
        equity_curve.append({
            "date": t.closed_at.date().isoformat() if t.closed_at else None,
            "equity": round(equity, 2),
        })

    total_return = (equity - capital) / capital * 100
    data = {
        "master_id": str(master_id),
        "start": str(start),
        "capital": capital,
        "lot_multiplier": lot_multiplier,
        "total_trades": len(trades),
        "equity_curve": equity_curve,
        "final_equity": round(equity, 2),
        "total_return_pct": round(total_return, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "win_rate": round(wins / len(trades) * 100, 1),
        "avg_profit_per_trade": round((equity - capital) / len(trades), 2),
    }
    await _cache_set(cache_key, data, ttl=300)
    return data


# ── Master session stats ───────────────────────────────────────────────────────

@router.get("/masters/{master_id}/session-stats")
async def master_session_stats(
    master_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"session_stats:{master_id}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(TradeHistory)
        .where(TradeHistory.master_id == master_id, TradeHistory.closed_at.isnot(None))
    )
    trades = result.scalars().all()

    slots: dict[int, list[float]] = {h: [] for h in range(24)}
    for t in trades:
        if t.opened_at and t.profit is not None:
            hour = t.opened_at.hour
            slots[hour].append(float(t.profit))

    hours = []
    for h in range(24):
        profits = slots[h]
        n = len(profits)
        wins = sum(1 for p in profits if p > 0)
        hours.append({
            "hour": h,
            "trades": n,
            "avg_profit": round(sum(profits) / n, 2) if n else 0,
            "win_rate": round(wins / n * 100, 1) if n else 0,
        })

    await _cache_set(cache_key, hours, ttl=600)
    return hours


# ── Master attribution ─────────────────────────────────────────────────────────

@router.get("/masters/{master_id}/attribution")
async def master_attribution(
    master_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"attribution:{master_id}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(TradeHistory)
        .where(TradeHistory.master_id == master_id, TradeHistory.closed_at.isnot(None))
    )
    trades = result.scalars().all()

    by_symbol: dict[str, list[float]] = {}
    for t in trades:
        sym = t.symbol
        if sym not in by_symbol:
            by_symbol[sym] = []
        by_symbol[sym].append(float(t.profit or 0))

    rows = []
    for sym, profits in by_symbol.items():
        n = len(profits)
        wins = sum(1 for p in profits if p > 0)
        total = sum(profits)
        rows.append({
            "symbol": sym,
            "trades": n,
            "total_profit": round(total, 2),
            "avg_profit": round(total / n, 2) if n else 0,
            "win_rate": round(wins / n * 100, 1) if n else 0,
        })

    rows.sort(key=lambda x: x["total_profit"], reverse=True)
    await _cache_set(cache_key, rows, ttl=600)
    return rows


# ── Master edge stats ──────────────────────────────────────────────────────────

@router.get("/masters/{master_id}/edge")
async def master_edge(
    master_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"edge:{master_id}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(TradeHistory)
        .where(TradeHistory.master_id == master_id, TradeHistory.closed_at.isnot(None))
        .order_by(TradeHistory.closed_at.asc())
    )
    trades = result.scalars().all()

    if not trades:
        raise HTTPException(404, "No closed trades found for this master")

    profits = [float(t.profit or 0) for t in trades]
    wins = [p for p in profits if p > 0]
    losses = [abs(p) for p in profits if p < 0]

    win_rate = len(wins) / len(profits)
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = sum(losses) / len(losses) if losses else 0
    expectancy = avg_win * win_rate - avg_loss * (1 - win_rate)
    profit_factor = sum(wins) / sum(losses) if losses and sum(losses) > 0 else float("inf")
    avg_rr = avg_win / avg_loss if avg_loss > 0 else 0

    max_consec_wins = max_consec_losses = cur_wins = cur_losses = 0
    for p in profits:
        if p > 0:
            cur_wins += 1
            cur_losses = 0
            max_consec_wins = max(max_consec_wins, cur_wins)
        else:
            cur_losses += 1
            cur_wins = 0
            max_consec_losses = max(max_consec_losses, cur_losses)

    data = {
        "master_id": str(master_id),
        "total_trades": len(profits),
        "win_rate": round(win_rate * 100, 1),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "expectancy": round(expectancy, 2),
        "profit_factor": round(profit_factor, 3) if profit_factor != float("inf") else None,
        "avg_rr": round(avg_rr, 2),
        "max_consec_wins": max_consec_wins,
        "max_consec_losses": max_consec_losses,
    }
    await _cache_set(cache_key, data, ttl=300)
    return data


# ── Follower PnL calendar ──────────────────────────────────────────────────────

@router.get("/copy-trades/calendar")
async def copy_trade_calendar(
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    follower_id = uuid.UUID(current_user["sub"])
    cache_key = f"pnl_calendar:{follower_id}:{year}:{month}"
    cached = await _cache_get(cache_key)
    if cached:
        return cached

    start_dt = datetime.datetime(year, month, 1, tzinfo=datetime.timezone.utc)
    if month == 12:
        end_dt = datetime.datetime(year + 1, 1, 1, tzinfo=datetime.timezone.utc)
    else:
        end_dt = datetime.datetime(year, month + 1, 1, tzinfo=datetime.timezone.utc)

    result = await db.execute(
        select(CopyTrade)
        .where(
            CopyTrade.follower_id == follower_id,
            CopyTrade.closed_at.isnot(None),
            CopyTrade.closed_at >= start_dt,
            CopyTrade.closed_at < end_dt,
            CopyTrade.profit.isnot(None),
        )
        .order_by(CopyTrade.closed_at.asc())
    )
    trades = result.scalars().all()

    by_date: dict[str, dict] = {}
    for t in trades:
        d = t.closed_at.date().isoformat()  # type: ignore[union-attr]
        if d not in by_date:
            by_date[d] = {"date": d, "profit": 0.0, "trades": 0}
        by_date[d]["profit"] = round(by_date[d]["profit"] + float(t.profit or 0), 2)
        by_date[d]["trades"] += 1

    data = sorted(by_date.values(), key=lambda x: x["date"])
    await _cache_set(cache_key, data, ttl=120)
    return data
