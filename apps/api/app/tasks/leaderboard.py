"""
排行榜分数计算 Celery 任务。
每小时增量更新，每天 UTC 00:05 全量重算。

指标计算：
- total_return_pct: (sum(profit) / initial_balance) * 100，无 balance 时用累计盈亏作为相对值
- max_drawdown_pct: 从峰值到谷值的最大回撤
- sharpe_ratio: 日收益均值 / 日收益标准差 * sqrt(252)
- sortino_ratio: 同上，只用负收益标准差
- win_rate_pct: 盈利交易 / 总交易
- profit_factor: 总盈利 / abs(总亏损)
- risk_grade: 加权评分 → A+/A/B+/B/C/D
"""
from __future__ import annotations

import math
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.leaderboard_score import LeaderboardScore
from app.models.signal_subscription import SignalSubscription
from app.models.trade_history import TradeHistory
from app.models.user import User


PERIODS = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "ALL": None,
}


def _grade(score: float) -> str:
    if score >= 85:
        return "A+"
    if score >= 75:
        return "A"
    if score >= 60:
        return "B+"
    if score >= 45:
        return "B"
    if score >= 30:
        return "C"
    return "D"


def _compute_metrics(trades: list[dict]) -> dict:
    if not trades:
        return {}

    closed = [t for t in trades if t["profit"] is not None]
    if not closed:
        return {}

    profits = [float(t["profit"]) for t in closed]
    total_profit = sum(profits)
    wins = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]

    win_rate = len(wins) / len(closed) * 100 if closed else 0
    profit_factor = (sum(wins) / abs(sum(losses))) if losses else (float("inf") if wins else 0)
    profit_factor = min(profit_factor, 999.0)

    # 日级别 P&L 汇总 → Sharpe / Sortino / Max Drawdown
    daily: dict[str, float] = defaultdict(float)
    for t in closed:
        day = t["closed_at"][:10] if t.get("closed_at") else t["opened_at"][:10]
        daily[day] += float(t["profit"])

    daily_returns = list(daily.values())

    def _std(values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
        return math.sqrt(variance)

    mean_daily = sum(daily_returns) / len(daily_returns) if daily_returns else 0
    std_daily = _std(daily_returns)
    sharpe = (mean_daily / std_daily * math.sqrt(252)) if std_daily > 0 else 0

    neg_returns = [r for r in daily_returns if r < 0]
    std_neg = _std(neg_returns) if len(neg_returns) >= 2 else std_daily
    sortino = (mean_daily / std_neg * math.sqrt(252)) if std_neg > 0 else 0

    # Max drawdown via cumulative equity curve
    cumulative = 0.0
    peak = 0.0
    max_dd = 0.0
    for r in daily_returns:
        cumulative += r
        if cumulative > peak:
            peak = cumulative
        dd = (peak - cumulative) / peak * 100 if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd

    total_return = sum(profits)

    # Trading days
    dates = set()
    for t in closed:
        if t.get("closed_at"):
            dates.add(t["closed_at"][:10])
    trading_days = len(dates)

    # Avg trade duration
    durations = []
    for t in closed:
        if t.get("opened_at") and t.get("closed_at"):
            try:
                o = datetime.fromisoformat(t["opened_at"].replace("Z", "+00:00"))
                c = datetime.fromisoformat(t["closed_at"].replace("Z", "+00:00"))
                durations.append((c - o).total_seconds() / 3600)
            except Exception:
                pass
    avg_duration = sum(durations) / len(durations) if durations else None

    # Composite risk grade score (0-100)
    # Sharpe 25% | WinRate 20% | MaxDD 30% (inverted) | ProfitFactor 15% | TradingDays 10%
    sharpe_score = min(sharpe / 3.0 * 100, 100) if sharpe > 0 else 0
    win_score = win_rate
    dd_score = max(0, 100 - max_dd * 3)
    pf_score = min((profit_factor - 1) / 2 * 100, 100) if profit_factor > 1 else 0
    days_score = min(trading_days / 365 * 100, 100)
    composite = (
        sharpe_score * 0.25
        + win_score * 0.20
        + dd_score * 0.30
        + pf_score * 0.15
        + days_score * 0.10
    )

    return {
        "total_return_pct": round(total_return, 4),
        "max_drawdown_pct": round(max_dd, 4),
        "sharpe_ratio": round(sharpe, 4),
        "sortino_ratio": round(sortino, 4),
        "calmar_ratio": round(total_return / max_dd, 4) if max_dd > 0 else None,
        "win_rate_pct": round(win_rate, 4),
        "profit_factor": round(profit_factor, 4),
        "avg_trade_duration_hours": round(avg_duration, 2) if avg_duration is not None else None,
        "total_trades": len(closed),
        "trading_days": trading_days,
        "risk_grade": _grade(composite),
        "consistency_score": round(composite, 2),
    }


@celery_app.task(name="app.tasks.leaderboard.recalculate_leaderboard", bind=True, max_retries=3)
def recalculate_leaderboard(self, full: bool = False):
    """
    重算所有 Master 的排行榜分数。
    full=True: 全量（所有 period），full=False: 只算 1M（快速增量）
    """
    with SyncSessionLocal() as db:
        # 获取所有 MASTER 用户（按租户）
        masters_result = db.execute(
            select(User.id, User.tenant_id).where(
                User.roles.contains(["MASTER"])
            )
        )
        masters = masters_result.all()

        if not masters:
            return {"status": "no_masters"}

        periods_to_calc = list(PERIODS.keys()) if full else ["1M", "ALL"]
        updated = 0

        for master_id, tenant_id in masters:
            for period_key in periods_to_calc:
                days = PERIODS[period_key]
                cutoff = (
                    datetime.now(timezone.utc) - timedelta(days=days)
                    if days
                    else None
                )

                query = select(
                    TradeHistory.symbol,
                    TradeHistory.direction,
                    TradeHistory.profit,
                    TradeHistory.opened_at,
                    TradeHistory.closed_at,
                ).where(
                    and_(
                        TradeHistory.master_id == master_id,
                        TradeHistory.closed_at.isnot(None),
                    )
                )
                if cutoff:
                    query = query.where(TradeHistory.closed_at >= cutoff)

                result = db.execute(query)
                rows = result.mappings().all()
                trades = [dict(r) for r in rows]

                metrics = _compute_metrics(trades)
                if not metrics:
                    continue

                # 统计 followers 数量
                followers_result = db.execute(
                    select(func.count()).select_from(SignalSubscription).where(
                        and_(
                            SignalSubscription.master_id == master_id,
                            SignalSubscription.status == "ACTIVE",
                        )
                    )
                )
                followers_count = followers_result.scalar_one() or 0

                stmt = pg_insert(LeaderboardScore).values(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    master_id=master_id,
                    period=period_key,
                    followers_count=followers_count,
                    calculated_at=datetime.now(timezone.utc),
                    **metrics,
                ).on_conflict_do_update(
                    index_elements=["tenant_id", "master_id", "period"],
                    set_={
                        "followers_count": followers_count,
                        "calculated_at": datetime.now(timezone.utc),
                        **metrics,
                    },
                )
                db.execute(stmt)
                updated += 1

        db.commit()
        return {"status": "ok", "masters": len(masters), "records_updated": updated, "full": full}
