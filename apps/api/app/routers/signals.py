import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.signal import Signal
from app.models.mt4_account import MT4Account
from app.models.trade_history import TradeHistory
from app.schemas.signal import SignalOut, SignalIngest

router = APIRouter()


@router.get("/", response_model=list[SignalOut])
async def list_signals(
    master_id: uuid.UUID = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Signal)
        .where(Signal.master_id == master_id)
        .order_by(Signal.opened_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/ingest", status_code=201)
async def ingest_signal(payload: SignalIngest, db: AsyncSession = Depends(get_db)):
    """Internal endpoint called by worker-ct when a trade event is captured from MetaAPI."""
    # Resolve the MT4 account
    acct_result = await db.execute(
        select(MT4Account).where(MT4Account.meta_api_account_id == payload.meta_api_account_id)
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail=f"MT4 account {payload.meta_api_account_id} not found")

    master_id = uuid.UUID(payload.master_id)
    now = datetime.now(timezone.utc)

    signal = Signal(
        tenant_id=account.tenant_id,
        master_id=master_id,
        mt4_account_id=account.id,
        signal_type=payload.signal_type,
        symbol=payload.symbol,
        direction=payload.direction,
        volume=payload.volume,
        open_price=payload.open_price,
        close_price=payload.close_price,
        stop_loss=payload.stop_loss,
        take_profit=payload.take_profit,
        profit=payload.profit,
        mt4_ticket=payload.mt4_ticket or 0,
        opened_at=payload.opened_at or now,
        closed_at=payload.closed_at,
        status="CLOSED" if payload.signal_type == "CLOSE" else "OPEN",
        tags=[],
    )
    db.add(signal)

    if payload.signal_type == "CLOSE" and payload.mt4_ticket:
        try:
            history = TradeHistory(
                mt4_account_id=account.id,
                master_id=master_id,
                mt4_ticket=payload.mt4_ticket,
                symbol=payload.symbol,
                direction=payload.direction,
                volume=payload.volume,
                open_price=payload.open_price or 0,
                close_price=payload.close_price,
                stop_loss=payload.stop_loss,
                take_profit=payload.take_profit,
                profit=payload.profit,
                opened_at=payload.opened_at or now,
                closed_at=payload.closed_at or now,
            )
            db.add(history)
            await db.flush()  # catch UNIQUE violation before commit
        except IntegrityError:
            await db.rollback()
            # duplicate ticket — still save the signal, skip history
            db.add(signal)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate signal ticket")

    # Trigger async leaderboard recalculation
    if payload.signal_type == "CLOSE":
        try:
            from app.workers.leaderboard_tasks import recalculate_master
            recalculate_master.delay(str(master_id))
        except Exception:
            pass  # Celery not running in dev — non-fatal

    return {"signal_id": str(signal.id)}
