import uuid
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id
from app.core.database import get_db
from app.models.leaderboard_score import LeaderboardScore
from app.models.user import User
from app.models.signal import Signal
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse

router = APIRouter()

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
    db: AsyncSession = Depends(get_db),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
):
    try:
        base_filter = (LeaderboardScore.period == period, LeaderboardScore.tenant_id == tenant_id)

        count_result = await db.execute(
            select(func.count()).select_from(LeaderboardScore).where(*base_filter)
        )
        total = count_result.scalar_one()

        if total == 0:
            entries = [e.model_copy(update={"period": period}) for e in _MOCK_ENTRIES]
            return LeaderboardResponse(entries=entries, total=len(entries), period=period)

        offset = (page - 1) * per_page
        result = await db.execute(
            select(LeaderboardScore, User.username)
            .join(User, LeaderboardScore.master_id == User.id)
            .where(*base_filter)
            .order_by(LeaderboardScore.total_return_pct.desc())
            .offset(offset)
            .limit(per_page)
        )
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
            )
            for i, (score, username) in enumerate(rows)
        ]
        return LeaderboardResponse(entries=entries, total=total, period=period)

    except Exception:
        entries = [e.model_copy(update={"period": period}) for e in _MOCK_ENTRIES]
        return LeaderboardResponse(entries=entries, total=len(entries), period=period)


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

    return {
        "master": {
            "id": str(master_id),
            "username": user.username if user else "Unknown",
            "display_name": user.display_name if user else None,
        },
        "score": {
            "total_return_pct": float(score.total_return_pct or 0) if score else None,
            "max_drawdown_pct": float(score.max_drawdown_pct or 0) if score else None,
            "sharpe_ratio": float(score.sharpe_ratio or 0) if score else None,
            "win_rate_pct": float(score.win_rate_pct or 0) if score else None,
            "risk_grade": score.risk_grade if score else None,
        } if score else None,
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
