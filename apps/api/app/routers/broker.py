"""Broker integration API (white-label).

Authenticated with an X-API-Key header; every response is automatically scoped
to the key's tenant via the tenant context + app-layer/RLS filters. Intended for
white-label brokers to surface their masters, leaderboard and signals.
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.broker_auth import get_broker_tenant
from app.core.database import get_db
from app.models.leaderboard_score import LeaderboardScore
from app.models.signal import Signal
from app.models.user import User

router = APIRouter()


def _num(v):
    return float(v) if v is not None else None


@router.get("/masters")
async def list_masters(
    tenant_id: uuid.UUID = Depends(get_broker_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Active, verified masters for the authenticated broker's tenant."""
    rows = (
        await db.execute(
            select(User)
            .where(User.roles.contains(["MASTER"]), User.is_active.is_(True))
            .order_by(User.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": str(u.id),
            "display_name": u.display_name or (u.username or "Master"),
            "kyc_status": u.kyc_status,
            "is_certified": u.is_certified,
            "trading_style": u.apply_trading_style,
            "monthly_return_pct": _num(u.apply_monthly_return_pct),
            "since": u.created_at.isoformat() if u.created_at else None,
        }
        for u in rows
    ]


@router.get("/leaderboard")
async def broker_leaderboard(
    period: str = Query("ALL_TIME"),
    limit: int = Query(50, le=200),
    tenant_id: uuid.UUID = Depends(get_broker_tenant),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(LeaderboardScore, User.display_name, User.username)
            .join(User, User.id == LeaderboardScore.master_id)
            .where(LeaderboardScore.period == period)
            .order_by(LeaderboardScore.total_return_pct.desc().nullslast())
            .limit(limit)
        )
    ).all()
    return [
        {
            "master_id": str(s.master_id),
            "name": dn or un or "Master",
            "period": s.period,
            "total_return_pct": _num(s.total_return_pct),
            "monthly_return_pct": _num(s.monthly_return_pct),
            "max_drawdown_pct": _num(s.max_drawdown_pct),
            "sharpe_ratio": _num(s.sharpe_ratio),
            "win_rate_pct": _num(s.win_rate_pct),
            "followers_count": s.followers_count,
            "risk_grade": s.risk_grade,
        }
        for s, dn, un in rows
    ]


@router.get("/signals")
async def broker_signals(
    limit: int = Query(100, le=500),
    tenant_id: uuid.UUID = Depends(get_broker_tenant),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(Signal).order_by(Signal.opened_at.desc()).limit(limit))
    ).scalars().all()
    return [
        {
            "id": str(s.id),
            "master_id": str(s.master_id),
            "type": s.signal_type,
            "symbol": s.symbol,
            "direction": s.direction,
            "volume": _num(s.volume),
            "open_price": _num(s.open_price),
            "close_price": _num(s.close_price),
            "profit": _num(s.profit),
            "status": s.status,
            "opened_at": s.opened_at.isoformat() if s.opened_at else None,
            "closed_at": s.closed_at.isoformat() if s.closed_at else None,
        }
        for s in rows
    ]
