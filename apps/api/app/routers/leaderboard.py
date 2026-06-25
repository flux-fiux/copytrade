import uuid
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id
from app.core.config import settings
from app.core.database import get_db
from app.models.leaderboard_score import LeaderboardScore
from app.models.user import User
from app.models.signal import Signal
from app.models.trade_history import TradeHistory
from app.models.signal_subscription import SignalSubscription
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse
from app.services import ai_service

import redis.asyncio as aioredis

router = APIRouter()

_redis: aioredis.Redis | None = None

def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis

_AI_CACHE_TTL = 3600 * 6  # 6 小时

_MOCK_ENTRIES = [
    LeaderboardEntry(rank=1, master_id="00000000-0000-0000-0000-000000000010", username="AlphaWave FX",
                     return_pct=142.3, max_drawdown=8.2, sharpe_ratio=2.84, win_rate=68.4,
                     followers_count=1240, risk_grade="A+", trading_days=385, period="1M"),
    LeaderboardEntry(rank=2, master_id="00000000-0000-0000-0000-000000000011", username="GoldTrader Pro",
                     return_pct=98.7, max_drawdown=11.4, sharpe_ratio=2.31, win_rate=61.2,
                     followers_count=876, risk_grade="A", trading_days=248, period="1M"),
    LeaderboardEntry(rank=3, master_id="00000000-0000-0000-0000-000000000012", username="Momentum King",
                     return_pct=76.1, max_drawdown=14.9, sharpe_ratio=1.92, win_rate=58.7,
                     followers_count=654, risk_grade="B+", trading_days=192, period="1M"),
]


@router.get("/", response_model=LeaderboardResponse)
async def list_leaderboard(
    request: Request,
    period: str = Query("1M", pattern="^(1M|3M|6M|1Y|ALL)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("return", pattern="^(return|drawdown|sharpe|winrate|followers|days)$"),
    min_days: int = Query(0, ge=0),
    grade: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
):
    try:
        filters = [LeaderboardScore.period == period, LeaderboardScore.tenant_id == tenant_id]
        if min_days > 0:
            filters.append(LeaderboardScore.trading_days >= min_days)
        if grade:
            filters.append(LeaderboardScore.risk_grade == grade)

        _SORT_MAP = {
            "return":    LeaderboardScore.total_return_pct.desc(),
            "drawdown":  LeaderboardScore.max_drawdown_pct.asc(),
            "sharpe":    LeaderboardScore.sharpe_ratio.desc(),
            "winrate":   LeaderboardScore.win_rate_pct.desc(),
            "followers": LeaderboardScore.followers_count.desc(),
            "days":      LeaderboardScore.trading_days.desc(),
        }
        order_col = _SORT_MAP.get(sort_by, LeaderboardScore.total_return_pct.desc())

        base_query = select(LeaderboardScore, User.username, User.is_certified).join(User, LeaderboardScore.master_id == User.id).where(*filters)
        if search:
            base_query = base_query.where(User.username.ilike(f"%{search}%"))

        count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
        total = count_result.scalar_one()

        if total == 0 and not search and not grade and min_days == 0:
            entries = [e.model_copy(update={"period": period}) for e in _MOCK_ENTRIES]
            return LeaderboardResponse(entries=entries, total=len(entries), period=period)

        offset = (page - 1) * per_page
        result = await db.execute(base_query.order_by(order_col).offset(offset).limit(per_page))
        rows = result.all()

        entries = [
            LeaderboardEntry(
                rank=offset + i + 1,
                master_id=str(score.master_id),
                username=username or "Unknown",
                return_pct=float(score.total_return_pct or 0),
                max_drawdown=float(score.max_drawdown_pct or 0),
                sharpe_ratio=float(score.sharpe_ratio or 0),
                win_rate=float(score.win_rate_pct or 0),
                followers_count=score.followers_count,
                risk_grade=score.risk_grade or "C",
                trading_days=score.trading_days or 0,
                period=period,
                is_certified=bool(is_certified),
            )
            for i, (score, username, is_certified) in enumerate(rows)
        ]
        return LeaderboardResponse(entries=entries, total=total, period=period)

    except Exception:
        if settings.APP_ENV == "development":
            entries = [e.model_copy(update={"period": period}) for e in _MOCK_ENTRIES]
            return LeaderboardResponse(entries=entries, total=len(entries), period=period)
        return LeaderboardResponse(entries=[], total=0, period=period)


@router.get("/platform-stats")
async def platform_stats(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """Public platform metrics — cached 60s in Redis."""
    import datetime
    import json as _json
    from app.models.copy_trade import CopyTrade

    cache_key = f"platform_stats:{tenant_id}"
    try:
        r = _get_redis()
        cached = await r.get(cache_key)
        if cached:
            return _json.loads(cached)
    except Exception:
        pass

    today_start = datetime.datetime.now(datetime.timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    masters_count = await db.scalar(
        select(func.count()).select_from(LeaderboardScore)
        .where(LeaderboardScore.tenant_id == tenant_id, LeaderboardScore.period == "1M")
    ) or 0

    active_subs = await db.scalar(
        select(func.count(func.distinct(SignalSubscription.follower_id)))
        .where(SignalSubscription.status == "ACTIVE")
    ) or 0

    avg_sharpe = await db.scalar(
        select(func.avg(LeaderboardScore.sharpe_ratio))
        .where(LeaderboardScore.tenant_id == tenant_id, LeaderboardScore.period == "1M",
               LeaderboardScore.sharpe_ratio.is_not(None))
    )

    trades_today = await db.scalar(
        select(func.count()).select_from(CopyTrade)
        .where(CopyTrade.created_at >= today_start)
    ) or 0

    result = {
        "verified_providers": int(masters_count),
        "active_followers": int(active_subs),
        "avg_sharpe": round(float(avg_sharpe), 2) if avg_sharpe else 0.0,
        "trades_today": int(trades_today),
    }

    try:
        await r.set(cache_key, _json.dumps(result), ex=60)
    except Exception:
        pass

    return result


@router.get("/{master_id}")
async def get_master_detail(
    master_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == master_id, User.tenant_id == tenant_id)
    )
    user = result.scalar_one_or_none()

    score_result = await db.execute(
        select(LeaderboardScore).where(
            LeaderboardScore.master_id == master_id,
            LeaderboardScore.tenant_id == tenant_id,
            LeaderboardScore.period == "ALL",
        )
    )
    score = score_result.scalar_one_or_none()

    signals_result = await db.execute(
        select(Signal)
        .where(Signal.master_id == master_id, Signal.tenant_id == tenant_id)
        .order_by(Signal.opened_at.desc())
        .limit(20)
    )
    signals = signals_result.scalars().all()

    followers_count = await db.scalar(
        select(func.count()).select_from(SignalSubscription).where(
            SignalSubscription.master_id == master_id,
            SignalSubscription.status == "ACTIVE",
        )
    ) or 0

    return {
        "master": {
            "id": str(master_id),
            "username": user.username if user else "Unknown",
            "display_name": user.display_name if user else None,
            "apply_strategy": user.apply_strategy if user else None,
            "is_certified": user.is_certified if user else False,
        },
        "score": {
            "total_return_pct": float(score.total_return_pct or 0) if score else None,
            "max_drawdown_pct": float(score.max_drawdown_pct or 0) if score else None,
            "sharpe_ratio": float(score.sharpe_ratio or 0) if score else None,
            "win_rate_pct": float(score.win_rate_pct or 0) if score else None,
            "risk_grade": score.risk_grade if score else None,
            "followers_count": score.followers_count if score else followers_count,
            "trading_days": score.trading_days if score else 0,
        } if score else None,
        "followers_count": followers_count,
        "recent_signals": [
            {
                "id": str(s.id),
                "symbol": s.symbol,
                "direction": s.direction,
                "signal_type": s.signal_type,
                "volume": float(s.volume),
                "open_price": float(s.open_price) if s.open_price else None,
                "profit": float(s.profit) if s.profit else None,
                "opened_at": s.opened_at.isoformat(),
            }
            for s in signals
        ],
    }


@router.get("/{master_id}/ai-summary")
async def get_master_ai_summary(
    master_id: uuid.UUID,
    lang: str = Query("en", pattern="^(en|zh-CN|ja|es)$"),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """用 AI 解读 Master 的交易风格，帮助 Follower 做决策。结果缓存 6 小时。"""
    cache_key = f"ai_summary:{master_id}:{lang}"
    try:
        r = _get_redis()
        cached = await r.get(cache_key)
        if cached:
            import json as _json
            return _json.loads(cached)
    except Exception:
        pass

    result = await db.execute(
        select(TradeHistory)
        .where(TradeHistory.master_id == master_id)
        .order_by(TradeHistory.closed_at.desc())
        .limit(50)
    )
    trades = result.scalars().all()
    trade_data = [
        {
            "symbol": t.symbol,
            "direction": t.direction,
            "volume": float(t.volume),
            "open_price": float(t.open_price) if t.open_price else None,
            "close_price": float(t.close_price) if t.close_price else None,
            "profit": float(t.profit) if t.profit else None,
            "opened_at": t.opened_at.isoformat() if t.opened_at else None,
            "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        }
        for t in trades
    ]

    summary = await ai_service.explain_master(trade_data, lang=lang)
    response = {"summary": summary, "trade_count": len(trade_data), "lang": lang}

    try:
        import json as _json
        await _get_redis().setex(cache_key, _AI_CACHE_TTL, _json.dumps(response))
    except Exception:
        pass

    return response


@router.delete("/{master_id}/ai-summary/cache", include_in_schema=False)
async def invalidate_ai_summary_cache(master_id: uuid.UUID):
    """管理员手动清除 AI 摘要缓存（内部用）。"""
    try:
        r = _get_redis()
        keys = [f"ai_summary:{master_id}:{lang}" for lang in ("en", "zh-CN", "ja", "es")]
        await r.delete(*keys)
    except Exception:
        pass
    return {"cleared": True}
