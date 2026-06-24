import asyncio
import math
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from sqlalchemy import select, func

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.leaderboard_score import LeaderboardScore
from app.models.signal_subscription import SignalSubscription
from app.models.trade_history import TradeHistory
from app.models.user import User

PERIODS: dict[str, int | None] = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "ALL": None,
}

ASSUMED_STARTING_BALANCE = 10_000.0


def calc_max_drawdown(equity_curve: list[float]) -> float:
    if len(equity_curve) < 2:
        return 0.0
    peak = equity_curve[0]
    max_dd = 0.0
    for val in equity_curve:
        if val > peak:
            peak = val
        dd = (peak - val) / peak * 100 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return round(max_dd, 2)


def calc_sharpe(returns: list[float], risk_free: float = 0.05) -> float:
    if len(returns) < 2:
        return 0.0
    n = len(returns)
    avg = sum(returns) / n
    variance = sum((r - avg) ** 2 for r in returns) / (n - 1)
    std = math.sqrt(variance) if variance > 0 else 0.0
    if std == 0:
        return 0.0
    daily_rf = risk_free / 252
    return round((avg - daily_rf) / std * math.sqrt(252), 3)


def calc_sortino(returns: list[float], risk_free: float = 0.05) -> float:
    if len(returns) < 2:
        return 0.0
    avg = sum(returns) / len(returns)
    daily_rf = risk_free / 252
    neg_returns = [r for r in returns if r < daily_rf]
    if not neg_returns:
        return 10.0
    downside_var = sum((r - daily_rf) ** 2 for r in neg_returns) / len(returns)
    downside_std = math.sqrt(downside_var)
    if downside_std == 0:
        return 0.0
    return round((avg - daily_rf) / downside_std * math.sqrt(252), 3)


def calc_profit_factor(trades: list) -> float:
    gross_profit = sum(float(t.profit) for t in trades if float(t.profit or 0) > 0)
    gross_loss = abs(sum(float(t.profit) for t in trades if float(t.profit or 0) < 0))
    if gross_loss == 0:
        return 10.0 if gross_profit > 0 else 1.0
    return round(gross_profit / gross_loss, 3)


def assign_risk_grade(sharpe: float, max_dd: float, win_rate: float, profit_factor: float, trading_days: int) -> str:
    score = 0.0
    score += min(sharpe / 2.5, 1.0) * 20
    score += max(0.0, 1.0 - max_dd / 30) * 30
    score += min(max((win_rate - 40) / 30, 0.0), 1.0) * 15
    score += min(trading_days / 365, 1.0) * 20
    score += min((profit_factor - 1.0) / 2.0, 1.0) * 15

    if score >= 85:
        return "A+"
    elif score >= 70:
        return "A"
    elif score >= 55:
        return "B+"
    elif score >= 40:
        return "B"
    elif score >= 25:
        return "C"
    return "D"


async def _calculate_for_master(
    master_id: uuid.UUID,
    tenant_id: uuid.UUID,
    period_key: str,
    days: int | None,
    session,
) -> None:
    cutoff = None if days is None else datetime.now(timezone.utc) - timedelta(days=days)

    stmt = select(TradeHistory).where(TradeHistory.master_id == master_id)
    if cutoff:
        stmt = stmt.where(TradeHistory.closed_at >= cutoff)
    stmt = stmt.order_by(TradeHistory.closed_at)

    result = await session.execute(stmt)
    trades = result.scalars().all()

    if not trades:
        return

    total_profit = sum(float(t.profit or 0) for t in trades)
    total_return_pct = total_profit / ASSUMED_STARTING_BALANCE * 100

    equity = ASSUMED_STARTING_BALANCE
    equity_curve = [equity]
    daily_returns: list[float] = []
    for t in trades:
        prev = equity
        equity += float(t.profit or 0)
        equity_curve.append(equity)
        if prev > 0:
            daily_returns.append((equity - prev) / prev)

    max_dd = calc_max_drawdown(equity_curve)
    sharpe = calc_sharpe(daily_returns)
    sortino = calc_sortino(daily_returns)
    calmar = round(total_return_pct / max_dd, 3) if max_dd > 0 else 0.0

    wins = sum(1 for t in trades if float(t.profit or 0) > 0)
    win_rate = round(wins / len(trades) * 100, 2) if trades else 0.0
    profit_factor = calc_profit_factor(trades)

    first_opened = trades[0].opened_at
    last_closed = trades[-1].closed_at
    trading_days = (last_closed - first_opened).days if first_opened and last_closed else 0

    durations = [
        (t.closed_at - t.opened_at).total_seconds() / 3600
        for t in trades
        if t.opened_at and t.closed_at
    ]
    avg_duration = sum(durations) / len(durations) if durations else 0.0

    followers_result = await session.execute(
        select(func.count()).select_from(SignalSubscription).where(
            SignalSubscription.master_id == master_id,
            SignalSubscription.status == "ACTIVE",
        )
    )
    followers_count = followers_result.scalar_one() or 0

    risk_grade = assign_risk_grade(sharpe, max_dd, win_rate, profit_factor, trading_days)

    existing = await session.execute(
        select(LeaderboardScore).where(
            LeaderboardScore.master_id == master_id,
            LeaderboardScore.period == period_key,
        )
    )
    score = existing.scalar_one_or_none()
    if not score:
        score = LeaderboardScore(
            master_id=master_id,
            tenant_id=tenant_id,
            period=period_key,
        )
        session.add(score)

    score.total_return_pct = Decimal(str(round(total_return_pct, 4)))
    score.max_drawdown_pct = Decimal(str(max_dd))
    score.sharpe_ratio = Decimal(str(sharpe))
    score.sortino_ratio = Decimal(str(sortino))
    score.calmar_ratio = Decimal(str(calmar))
    score.win_rate_pct = Decimal(str(win_rate))
    score.profit_factor = Decimal(str(profit_factor))
    score.avg_trade_duration_hours = Decimal(str(round(avg_duration, 2)))
    score.total_trades = len(trades)
    score.trading_days = trading_days
    score.followers_count = followers_count
    score.risk_grade = risk_grade
    score.calculated_at = datetime.now(timezone.utc)

    await session.commit()


@celery_app.task(name="app.workers.leaderboard_tasks.recalculate_all", bind=True, max_retries=3)
def recalculate_all(self):
    async def _run():
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TradeHistory.master_id).distinct()
            )
            master_ids = [row[0] for row in result.all()]

            for master_id in master_ids:
                user_result = await session.execute(
                    select(User.tenant_id).where(User.id == master_id)
                )
                tenant_id = user_result.scalar_one_or_none()
                if not tenant_id:
                    continue
                for period_key, days in PERIODS.items():
                    try:
                        await _calculate_for_master(master_id, tenant_id, period_key, days, session)
                    except Exception as e:
                        print(f"[leaderboard] Error {master_id}/{period_key}: {e}")

    asyncio.run(_run())


@celery_app.task(name="app.workers.leaderboard_tasks.recalculate_master")
def recalculate_master(master_id_str: str):
    master_id = uuid.UUID(master_id_str)

    async def _run():
        async with AsyncSessionLocal() as session:
            user_result = await session.execute(
                select(User.tenant_id).where(User.id == master_id)
            )
            tenant_id = user_result.scalar_one_or_none()
            if not tenant_id:
                return
            for period_key, days in PERIODS.items():
                await _calculate_for_master(master_id, tenant_id, period_key, days, session)

    asyncio.run(_run())
