import asyncio
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.models.payment import Payment
from app.models.mt4_account import MT4Account
from app.models.signal_subscription import SignalSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.schemas.user import UserCreate, UserOut, UserUpdate, MasterApplyRequest, MasterApplicationOut
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
    request: Request,
    payload: UserCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, "user_create", max_calls=10, window_seconds=300)
    user_id = uuid.UUID(current_user["sub"])

    result = await db.execute(select(User).where(User.id == user_id))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

    user = User(
        id=user_id,
        tenant_id=DEFAULT_TENANT_ID,
        email=payload.email,
        username=payload.username,
        roles=["FOLLOWER"],  # MASTER role must be granted via admin approval only
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        result2 = await db.execute(select(User).where(User.id == user_id))
        existing = result2.scalar_one_or_none()
        if existing:
            return existing
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    asyncio.create_task(
        email_service.send_welcome(
            to_email=user.email,
            name=user.display_name or user.username,
        )
    )

    return user


@router.post("/me/apply-master", status_code=status.HTTP_200_OK)
async def apply_master(
    request: Request,
    payload: MasterApplyRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, "apply_master", max_calls=3, window_seconds=3600)
    """提交 Master 申请。状态改为 PENDING，等待管理员审批。"""
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "MASTER" in (user.roles or []):
        raise HTTPException(status_code=400, detail="Already a Master")

    if user.kyc_status == "PENDING":
        raise HTTPException(status_code=400, detail="Application already pending review")

    if user.kyc_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Already verified as Master")

    user.kyc_status = "PENDING"
    user.apply_strategy = payload.strategy_name
    user.apply_description = payload.description
    user.apply_trading_style = payload.trading_style
    user.apply_monthly_return_pct = payload.monthly_return_pct
    user.apply_max_drawdown_pct = payload.max_drawdown_pct
    user.apply_price_usd = payload.price_usd
    user.apply_perf_fee_pct = payload.perf_fee_pct
    user.applied_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)
    return {"status": "pending", "message": "Application submitted — you will be notified by email within 1-3 business days."}


@router.get("/me/application", response_model=MasterApplicationOut)
async def get_my_application(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查看当前用户的 Master 申请状态。"""
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/me/earnings")
async def get_my_earnings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Master 收益汇总：历史付款记录 + 活跃 Follower 数。"""
    master_id = uuid.UUID(current_user["sub"])

    # Active live subscriptions with plan prices
    subs_result = await db.execute(
        select(SignalSubscription, SubscriptionPlan)
        .join(SubscriptionPlan, SubscriptionPlan.id == SignalSubscription.plan_id, isouter=True)
        .where(
            SignalSubscription.master_id == master_id,
            SignalSubscription.status == "ACTIVE",
            SignalSubscription.mode == "live",
        )
    )
    active_subs = subs_result.all()
    followers_count = len(active_subs)
    # MRR = sum of actual plan prices × 80% (after platform 20% cut)
    mrr = round(sum(float(plan.price_usd) * 0.8 if plan else 0 for _, plan in active_subs), 2)

    payments_result = await db.execute(
        select(Payment).where(
            Payment.payee_id == master_id,
            Payment.status == "COMPLETED",
        ).order_by(Payment.created_at.desc())
    )
    payments = payments_result.scalars().all()

    total_earned = round(sum(float(p.master_earnings_usd or 0) for p in payments), 2)

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

    now = datetime.now(timezone.utc)
    current_month_key = now.strftime("%b %Y")

    if current_month_key not in monthly and (followers_count > 0 or mrr > 0):
        monthly[current_month_key] = {
            "month": current_month_key,
            "subscription_usd": round(mrr / 0.8, 2),  # gross before platform cut
            "performance_usd": 0.0,
            "payout_usd": mrr,
            "status": "PENDING",
        }

    sorted_history = sorted(monthly.values(), key=lambda x: x["month"], reverse=True)

    return {
        "total_earned": total_earned,
        "pending": mrr,
        "followers_count": followers_count,
        "mrr": mrr,
        "monthly_history": sorted_history,
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


@router.get("/me/onboarding-status")
async def get_onboarding_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns Master onboarding checklist — which setup steps are complete."""
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or "MASTER" not in (user.roles or []):
        return {"is_master": False}

    has_stripe_connect = bool(user.stripe_connect_id)

    has_mt4 = bool(await db.scalar(
        select(func.count()).select_from(MT4Account).where(MT4Account.user_id == user_id)
    ))

    has_plan = bool(await db.scalar(
        select(func.count()).select_from(SubscriptionPlan)
        .where(SubscriptionPlan.master_id == user_id, SubscriptionPlan.is_active == True)
    ))

    has_profile = bool(user.display_name and user.apply_strategy)

    steps = [
        {"id": "stripe_connect", "label": "Set up Stripe Connect to receive payouts", "done": has_stripe_connect, "href": None, "action": "connect_stripe"},
        {"id": "plan",           "label": "Your subscription plan is configured",     "done": has_plan,           "href": "/dashboard/earnings"},
        {"id": "mt4",            "label": "Connect your MT4/MT5 trading account",     "done": has_mt4,            "href": "/dashboard/accounts"},
        {"id": "profile",        "label": "Complete your public profile",             "done": has_profile,        "href": "/dashboard/settings"},
    ]
    completed = sum(1 for s in steps if s["done"])
    return {
        "is_master": True,
        "kyc_status": user.kyc_status,
        "completed": completed,
        "total": len(steps),
        "steps": steps,
    }


@router.post("/unsubscribe-email", status_code=status.HTTP_200_OK)
async def unsubscribe_email(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """CAN-SPAM compliant: mark user as opted out of marketing emails."""
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "email required")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.email_notify_signals = False
        user.email_notify_billing = False
        await db.commit()
    return {"unsubscribed": True}
