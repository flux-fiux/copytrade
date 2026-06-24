import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.copy_trade import CopyTrade
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
    result = await db.execute(stmt)
    return result.scalars().all()
