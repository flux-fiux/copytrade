import asyncio
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.payment import Payment
from app.models.signal_subscription import SignalSubscription
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.email_service import email_service

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])

    # Upsert — return existing if already exists
    result = await db.execute(select(User).where(User.id == user_id))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    # Resolve default tenant (platform tenant, id=1 placeholder)
    DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

    user = User(
        id=user_id,
        tenant_id=DEFAULT_TENANT_ID,
        email=payload.email,
        username=payload.username,
        roles=[payload.role],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    asyncio.create_task(
        email_service.send_welcome(
            to_email=user.email,
            name=user.display_name or user.username,
        )
    )

    return user


@router.get("/me/earnings")
async def get_my_earnings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Master 收益汇总：历史付款记录 + 活跃 Follower 数。"""
    master_id = uuid.UUID(current_user["sub"])

    # 活跃 Follower 数
    followers_result = await db.execute(
        select(func.count()).select_from(SignalSubscription).where(
            SignalSubscription.master_id == master_id,
            SignalSubscription.status == "ACTIVE",
        )
    )
    followers_count = followers_result.scalar_one() or 0

    # 已完成的付款记录（payee = master）
    payments_result = await db.execute(
        select(Payment).where(
            Payment.payee_id == master_id,
            Payment.status == "COMPLETED",
        ).order_by(Payment.created_at.desc())
    )
    payments = payments_result.scalars().all()

    total_earned = sum(float(p.master_earnings_usd or 0) for p in payments)

    # 按月汇总
    monthly: dict[str, dict] = {}
    for p in payments:
        key = p.created_at.strftime("%b %Y") if p.created_at else "Unknown"
        if key not in monthly:
            monthly[key] = {"month": key, "subscription_usd": 0.0, "performance_usd": 0.0, "payout_usd": 0.0, "status": "PAID"}
        earnings = float(p.master_earnings_usd or 0)
        monthly[key]["payout_usd"] += earnings
        if p.payment_type == "PERFORMANCE_FEE":
            monthly[key]["performance_usd"] += earnings
        else:
            monthly[key]["subscription_usd"] += earnings

    # 本月 pending（当月订阅费的 80%，尚未结算）
    now = datetime.now(timezone.utc)
    current_month_key = now.strftime("%b %Y")
    pending_result = await db.execute(
        select(func.count(), func.coalesce(func.sum(SignalSubscription.lot_multiplier), 0)).where(
            SignalSubscription.master_id == master_id,
            SignalSubscription.status == "ACTIVE",
        )
    )
    sub_data = pending_result.one()
    # 估算：followers × 平均订阅价 × 80% (简化：用 followers_count × $29 × 0.8)
    pending_estimate = followers_count * 29 * 0.8

    if current_month_key not in monthly:
        monthly[current_month_key] = {
            "month": current_month_key,
            "subscription_usd": followers_count * 29.0,
            "performance_usd": 0.0,
            "payout_usd": round(pending_estimate, 2),
            "status": "PENDING",
        }

    history = list(monthly.values())

    return {
        "total_earned": round(total_earned, 2),
        "pending": round(pending_estimate, 2),
        "followers_count": followers_count,
        "monthly_history": history,
    }


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user
