import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
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
    if sub_ids:
        subs_result = await db.execute(
            select(SignalSubscription).where(SignalSubscription.id.in_(sub_ids))
        )
        subs = subs_result.scalars().all()
        master_ids = {s.master_id for s in subs}
        sub_to_master = {s.id: s.master_id for s in subs}
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
