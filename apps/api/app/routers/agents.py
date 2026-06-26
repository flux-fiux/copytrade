import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_tenant_id
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.models.agent_analysis import AgentAnalysis
from app.services import agent_analyst
from app.workers.agent_tasks import run_agent_analysis

router = APIRouter()


# Depth presets → analyst set. Fewer analysts = faster (fewer LLM calls + fetches).
DEPTH_PRESETS = {
    "fast": "market,news",
    "balanced": "market,news,fundamentals",
    "full": "market,social,news,fundamentals",
}


class AnalyzeRequest(BaseModel):
    symbol: str
    asset_type: str = "stock"  # stock|crypto|forex
    trade_date: str | None = None  # YYYY-MM-DD; defaults to today
    depth: str = "full"  # fast|balanced|full


def _dict(a: AgentAnalysis) -> dict:
    return {
        "id": str(a.id),
        "symbol": a.symbol,
        "asset_type": a.asset_type,
        "trade_date": a.trade_date,
        "status": a.status,
        "decision": a.decision,
        "reports": a.reports or {},
        "error": a.error,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
    }


@router.get("/status")
async def agent_status(_: dict = Depends(get_current_user)):
    ok, reason = agent_analyst.is_available()
    return {"available": ok, "reason": reason}


@router.post("/analyze", status_code=status.HTTP_201_CREATED)
async def analyze(
    payload: AnalyzeRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    ok, reason = agent_analyst.is_available()
    if not ok:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"AI analyst unavailable: {reason}")

    symbol = payload.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="symbol is required")
    if payload.asset_type not in ("stock", "crypto", "forex"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid asset_type")

    # Multi-agent runs burn tokens — cap how often a user can kick one off.
    await rate_limit(request, "agent_analyze", max_calls=5, window_seconds=600)

    trade_date = payload.trade_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = AgentAnalysis(
        tenant_id=tenant_id,
        user_id=uuid.UUID(current_user["sub"]),
        symbol=symbol,
        asset_type=payload.asset_type,
        trade_date=trade_date,
        status="PENDING",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    analysts_csv = DEPTH_PRESETS.get(payload.depth, DEPTH_PRESETS["full"])
    run_agent_analysis.delay(str(row.id), analysts_csv)
    return _dict(row)


@router.get("/analyses")
async def list_analyses(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(current_user["sub"])
    rows = (
        await db.execute(
            select(AgentAnalysis)
            .where(AgentAnalysis.user_id == uid)
            .order_by(desc(AgentAnalysis.created_at))
            .limit(min(limit, 100))
        )
    ).scalars().all()
    return [_dict(r) for r in rows]


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(current_user["sub"])
    try:
        row = await db.get(AgentAnalysis, uuid.UUID(analysis_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not row or row.user_id != uid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _dict(row)
