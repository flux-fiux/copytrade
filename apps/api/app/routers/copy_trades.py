import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.internal_auth import verify_internal
from app.models.copy_trade import CopyTrade
from app.models.signal_subscription import SignalSubscription
from app.models.user import User
from app.schemas.copy_trade import CopyTradeOut

router = APIRouter()


@router.get("/", response_model=list[CopyTradeOut])
async def list_copy_trades(
    subscription_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    follower_id = uuid.UUID(current_user["sub"])
    stmt = select(CopyTrade).where(CopyTrade.follower_id == follower_id)
    if subscription_id:
        stmt = stmt.where(CopyTrade.subscription_id == subscription_id)
    stmt = stmt.order_by(CopyTrade.created_at.desc()).limit(limit)
    trades = (await db.execute(stmt)).scalars().all()

    # Collect master_ids via subscriptions and build a name map
    sub_ids = {t.subscription_id for t in trades}
    master_name_map: dict[uuid.UUID, str] = {}
    sub_to_master: dict[uuid.UUID, uuid.UUID] = {}
    if sub_ids:
        subs_result = await db.execute(
            select(SignalSubscription).where(SignalSubscription.id.in_(sub_ids))
        )
        subs = subs_result.scalars().all()
        master_ids = {s.master_id for s in subs}
        sub_to_master = {s.id: s.master_id for s in subs}  # noqa: F841
        if master_ids:
            users_result = await db.execute(
                select(User).where(User.id.in_(master_ids))
            )
            for u in users_result.scalars():
                master_name_map[u.id] = u.display_name or u.username or str(u.id)[:8]

    results = []
    for trade in trades:
        out = CopyTradeOut.model_validate(trade)
        master_id = sub_to_master.get(trade.subscription_id) if sub_ids else None
        out.master_name = master_name_map.get(master_id) if master_id else None
        results.append(out)
    return results


# ── Internal endpoints (called by worker-ct, protected by shared token) ───────

@router.get("/subscriptions")
async def list_active_subscriptions_for_master(
    master_id: uuid.UUID = Query(...),
    _auth: None = Depends(verify_internal),
    db: AsyncSession = Depends(get_db),
):
    """Return active subscriptions for a master — used by worker-ct to fan out copy trades."""
    result = await db.execute(
        select(SignalSubscription).where(
            SignalSubscription.master_id == master_id,
            SignalSubscription.status == "ACTIVE",
        )
    )
    subs = result.scalars().all()
    return [
        {
            "subscription_id": str(s.id),
            "follower_id": str(s.follower_id),
            "follower_account_id": str(s.follower_account_id) if s.follower_account_id else None,
            "tenant_id": str(s.tenant_id),
            "lot_multiplier": float(s.lot_multiplier or 1.0),
        }
        for s in subs
    ]


@router.post("/", response_model=CopyTradeOut, status_code=status.HTTP_201_CREATED)
async def create_copy_trade(
    payload: dict,
    _auth: None = Depends(verify_internal),
    db: AsyncSession = Depends(get_db),
):
    """Internal: record a copy trade execution. Called by worker-ct after CopyFactory executes."""
    try:
        faid = payload.get("follower_account_id")
        trade = CopyTrade(
            tenant_id=uuid.UUID(payload["tenant_id"]),
            subscription_id=uuid.UUID(payload["subscription_id"]),
            signal_id=uuid.UUID(payload["signal_id"]),
            follower_id=uuid.UUID(payload["follower_id"]),
            follower_account_id=uuid.UUID(faid) if faid else None,
            symbol=payload["symbol"],
            direction=payload["direction"],
            volume=float(payload["volume"]),
            open_price=payload.get("open_price"),
            close_price=payload.get("close_price"),
            profit=payload.get("profit"),
            status=payload.get("status", "OPEN"),
            opened_at=datetime.now(timezone.utc) if payload.get("status") != "CLOSED" else None,
            closed_at=datetime.now(timezone.utc) if payload.get("status") == "CLOSED" else None,
        )
        db.add(trade)
        await db.commit()
        await db.refresh(trade)
        return trade
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid payload: {exc}") from exc
