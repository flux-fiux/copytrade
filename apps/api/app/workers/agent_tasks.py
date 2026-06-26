import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.agent_analysis import AgentAnalysis
from app.services import agent_analyst

logger = logging.getLogger(__name__)

# asyncpg connections are bound to one event loop. A Celery task runs its own
# loop per invocation, so we use a throwaway NullPool engine (no cross-loop
# connection reuse) and dispose it when done.
_CONNECT_ARGS = {"statement_cache_size": 0} if settings.DATABASE_URL.startswith("postgresql+asyncpg") else {}


@celery_app.task(name="app.workers.agent_tasks.run_agent_analysis", bind=True, max_retries=0)
def run_agent_analysis(self, analysis_id: str):
    """Run the TradingAgents multi-agent analysis for a queued AgentAnalysis row."""

    async def _run():
        engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, connect_args=_CONNECT_ARGS)
        Session = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with Session() as s:
                row = await s.get(AgentAnalysis, analysis_id)
                if not row:
                    logger.warning("AgentAnalysis %s not found", analysis_id)
                    return
                row.status = "RUNNING"
                await s.commit()
                symbol, trade_date, asset_type = row.symbol, row.trade_date, row.asset_type

            # Heavy + blocking: run off the event loop so the loop stays free.
            try:
                result = await asyncio.to_thread(agent_analyst.run_analysis, symbol, trade_date, asset_type)
                status, fields = "DONE", {"decision": result["decision"], "reports": result["reports"]}
                logger.info("AgentAnalysis %s done: %s %s", analysis_id, symbol, result["decision"])
            except Exception as e:  # noqa: BLE001 — record the failure for the user
                logger.exception("AgentAnalysis %s failed", analysis_id)
                status, fields = "FAILED", {"error": str(e)[:2000]}

            async with Session() as s:
                row = await s.get(AgentAnalysis, analysis_id)
                if row:
                    row.status = status
                    row.completed_at = datetime.now(timezone.utc)
                    for k, v in fields.items():
                        setattr(row, k, v)
                    await s.commit()
        finally:
            await engine.dispose()

    asyncio.run(_run())
