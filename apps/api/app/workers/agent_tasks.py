import asyncio
import logging
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.agent_analysis import AgentAnalysis
from app.services import agent_analyst

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.agent_tasks.run_agent_analysis", bind=True, max_retries=0)
def run_agent_analysis(self, analysis_id: str):
    """Run the TradingAgents multi-agent analysis for a queued AgentAnalysis row."""

    async def _load_and_mark_running() -> tuple[str, str, str] | None:
        async with AsyncSessionLocal() as s:
            row = await s.get(AgentAnalysis, analysis_id)
            if not row:
                return None
            row.status = "RUNNING"
            await s.commit()
            return row.symbol, row.trade_date, row.asset_type

    async def _save(status: str, **fields):
        async with AsyncSessionLocal() as s:
            row = await s.get(AgentAnalysis, analysis_id)
            if not row:
                return
            row.status = status
            row.completed_at = datetime.now(timezone.utc)
            for k, v in fields.items():
                setattr(row, k, v)
            await s.commit()

    info = asyncio.run(_load_and_mark_running())
    if not info:
        logger.warning("AgentAnalysis %s not found", analysis_id)
        return
    symbol, trade_date, asset_type = info

    try:
        result = agent_analyst.run_analysis(symbol, trade_date, asset_type)
        asyncio.run(_save("DONE", decision=result["decision"], reports=result["reports"]))
        logger.info("AgentAnalysis %s done: %s %s", analysis_id, symbol, result["decision"])
    except Exception as e:  # noqa: BLE001 — record the failure for the user
        logger.exception("AgentAnalysis %s failed", analysis_id)
        asyncio.run(_save("FAILED", error=str(e)[:2000]))
