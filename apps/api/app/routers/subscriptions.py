import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.signal_subscription import SignalSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User
from app.schemas.subscription import (
    SubscriptionPlanCreate,
    SubscriptionPlanOut,
    SubscribeRequest,
    SubscribeResponse,
    MySubscriptionOut,
)
from app.models.mt4_account import MT4Account
from app.services.copyfactory import copyfactory_service
from app.services.stripe_service import stripe_service
from app.services.email_service import email_service

router = APIRouter()

DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


# ── Plans ──────────────────────────────────────────────────────────────

@router.get("/plans/{master_id}", response_model=list[SubscriptionPlanOut])
async def list_plans(master_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.master_id == master_id,
            SubscriptionPlan.is_active == True,
        )
    )
    return result.scalars().all()


@router.post("/plans", response_model=SubscriptionPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: SubscriptionPlanCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    master_id = uuid.UUID(current_user["sub"])
    user_result = await db.execute(select(User).where(User.id == master_id))
    user = user_result.scalar_one_or_none()
    if not user or "MASTER" not in (user.roles or []):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only MASTERs can create plans")

    stripe_price_id = await stripe_service.create_price(str(master_id), payload.price_usd)

    plan = SubscriptionPlan(
        tenant_id=user.tenant_id,
        master_id=master_id,
        name=payload.name,
        price_usd=payload.price_usd,
        performance_fee_pct=payload.performance_fee_pct,
        stripe_price_id=stripe_price_id,
        features=payload.features,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


# ── Subscribe ──────────────────────────────────────────────────────────

@router.post("/subscribe", response_model=SubscribeResponse, status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: SubscribeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    follower_id = uuid.UUID(current_user["sub"])
    master_id = uuid.UUID(payload.master_id)
    plan_id = uuid.UUID(payload.plan_id)
    follower_account_id = uuid.UUID(payload.follower_account_id) if payload.follower_account_id else None

    # Get plan
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")

    # Get or create Stripe customer
    follower_result = await db.execute(select(User).where(User.id == follower_id))
    follower = follower_result.scalar_one_or_none()
    if not follower:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if not follower.stripe_customer_id:
        customer_id = await stripe_service.create_customer(follower.email, follower.display_name or follower.email)
        follower.stripe_customer_id = customer_id
        await db.flush()
    else:
        customer_id = follower.stripe_customer_id

    # Create Stripe subscription
    stripe_result = await stripe_service.create_subscription(customer_id, plan.stripe_price_id or "price_dev")

    # Wire up CopyFactory
    master_account_result = await db.execute(
        select(MT4Account).where(
            MT4Account.user_id == master_id,
            MT4Account.account_type == "MASTER",
        )
    )
    master_account = master_account_result.scalars().first()

    # Resolve follower MT4 account (explicit or auto-pick first)
    follower_account = None
    if follower_account_id:
        fa_result = await db.execute(select(MT4Account).where(MT4Account.id == follower_account_id))
        follower_account = fa_result.scalar_one_or_none()
    else:
        auto_result = await db.execute(
            select(MT4Account).where(
                MT4Account.user_id == follower_id,
                MT4Account.account_type == "FOLLOWER",
            )
        )
        follower_account = auto_result.scalars().first()

    if not follower_account:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No FOLLOWER MT4 account found. Connect an MT4 account first.",
        )

    copy_factory_sub_id = None
    if master_account and master_account.copy_factory_strategy_id and follower_account:
        try:
            cf_result = await copyfactory_service.create_subscriber(
                subscriber_meta_account_id=follower_account.meta_api_account_id,
                strategy_id=master_account.copy_factory_strategy_id,
                lot_multiplier=1.0,
                max_drawdown_pct=20.0,
            )
            copy_factory_sub_id = cf_result.get("subscriberAccountId") or follower_account.meta_api_account_id
        except Exception as exc:
            # Non-fatal: subscription proceeds even if CopyFactory wiring fails
            print(f"[subscribe] CopyFactory wiring failed: {exc}")

    # Create SignalSubscription
    sub = SignalSubscription(
        tenant_id=follower.tenant_id,
        follower_id=follower_id,
        master_id=master_id,
        follower_account_id=follower_account.id,
        plan_id=plan_id,
        stripe_subscription_id=stripe_result["subscription_id"],
        status="ACTIVE" if stripe_result["status"] == "active" else "PENDING",
        copy_factory_sub_id=copy_factory_sub_id,
    )
    db.add(sub)
    await db.commit()

    # Fire-and-forget email (non-blocking)
    import asyncio
    master_user_result = await db.execute(select(User).where(User.id == master_id))
    master_user = master_user_result.scalar_one_or_none()
    master_name = (master_user.display_name or master_user.username or "Master") if master_user else "Master"
    asyncio.create_task(email_service.send_subscription_confirmed(
        to_email=follower.email,
        master_name=master_name,
        price_usd=float(plan.price_usd),
        lot_multiplier=float(payload.lot_multiplier) if hasattr(payload, "lot_multiplier") and payload.lot_multiplier else 1.0,
        max_drawdown=float(payload.max_drawdown_pct) if hasattr(payload, "max_drawdown_pct") and payload.max_drawdown_pct else 20.0,
    ))

    return SubscribeResponse(
        subscription_id=str(sub.id),
        client_secret=stripe_result.get("client_secret"),
        status=sub.status,
    )


@router.post("/cancel/{subscription_id}", status_code=status.HTTP_200_OK)
async def cancel_subscription(
    subscription_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    follower_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(SignalSubscription).where(SignalSubscription.id == subscription_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    if sub.follower_id != follower_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your subscription")

    # Remove CopyFactory subscription
    if sub.copy_factory_sub_id:
        master_account_result = await db.execute(
            select(MT4Account).where(
                MT4Account.user_id == sub.master_id,
                MT4Account.account_type == "MASTER",
            )
        )
        master_account = master_account_result.scalars().first()
        if master_account and master_account.copy_factory_strategy_id:
            try:
                await copyfactory_service.remove_subscriber_strategy(
                    sub.copy_factory_sub_id,
                    master_account.copy_factory_strategy_id,
                )
            except Exception as exc:
                print(f"[cancel] CopyFactory removal failed: {exc}")

    if sub.stripe_subscription_id:
        await stripe_service.cancel_subscription(sub.stripe_subscription_id)

    sub.status = "CANCELLED"
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "cancelled"}


@router.get("/my")
async def my_subscriptions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    follower_id = uuid.UUID(current_user["sub"])
    result = await db.execute(
        select(SignalSubscription).where(
            SignalSubscription.follower_id == follower_id,
            SignalSubscription.status != "CANCELLED",
        )
    )
    subs = result.scalars().all()
    return [MySubscriptionOut.from_orm_with_date(s) for s in subs]


# ── RiskGuard ─────────────────────────────────────────────────────────

@router.get("/{subscription_id}/risk")
async def get_subscription_risk(
    subscription_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SignalSubscription).where(SignalSubscription.id == subscription_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    if str(sub.follower_id) != current_user["sub"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

    from app.services.risk_guard import risk_guard
    return await risk_guard.check_subscription(sub, db)


@router.post("/{subscription_id}/resume")
async def resume_subscription_endpoint(
    subscription_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SignalSubscription).where(SignalSubscription.id == subscription_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    if str(sub.follower_id) != current_user["sub"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

    from app.services.risk_guard import risk_guard
    ok = await risk_guard.resume_subscription(subscription_id, db)
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subscription cannot be resumed")
    return {"status": "resumed"}


# ── Stripe Connect onboarding ──────────────────────────────────────────

@router.post("/connect/onboard")
async def onboard_connect(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    master_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == master_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if "MASTER" not in (user.roles or []):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only MASTERs can onboard to Stripe Connect")

    if not user.stripe_connect_id:
        connect_id = await stripe_service.create_connect_account(user.email)
        user.stripe_connect_id = connect_id
        await db.commit()

    base_url = "http://localhost:3000"
    onboarding_url = await stripe_service.create_connect_onboarding_link(
        user.stripe_connect_id,
        return_url=f"{base_url}/dashboard?connect=success",
        refresh_url=f"{base_url}/dashboard?connect=refresh",
    )
    return {"url": onboarding_url}
