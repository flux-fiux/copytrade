import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

import asyncio
from app.core.auth import require_admin, get_tenant_id
from app.core.database import get_db
from app.services.email_service import email_service
from app.models.user import User
from app.models.mt4_account import MT4Account
from app.models.signal_subscription import SignalSubscription
from app.models.leaderboard_score import LeaderboardScore

router = APIRouter()


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    request: Request,
    admin: dict = Depends(require_admin),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    total_users = await db.scalar(
        select(func.count()).select_from(User).where(User.tenant_id == tenant_id)
    )
    total_masters = await db.scalar(
        select(func.count()).select_from(User).where(User.tenant_id == tenant_id, User.roles.any("MASTER"))
    )
    total_followers = await db.scalar(
        select(func.count()).select_from(User).where(User.tenant_id == tenant_id, User.roles.any("FOLLOWER"))
    )
    active_subs = await db.scalar(
        select(func.count()).select_from(SignalSubscription).where(
            SignalSubscription.tenant_id == tenant_id, SignalSubscription.status == "ACTIVE"
        )
    )
    pending_masters = await db.scalar(
        select(func.count()).select_from(User).where(
            User.tenant_id == tenant_id, User.kyc_status == "PENDING"
        )
    )
    return {
        "total_users": total_users or 0,
        "total_masters": total_masters or 0,
        "total_followers": total_followers or 0,
        "active_subscriptions": active_subs or 0,
        "pending_master_approvals": pending_masters or 0,
    }


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=100),
    role: str | None = None,
    search: str | None = None,
    admin: dict = Depends(require_admin),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.tenant_id == tenant_id)
    if role:
        stmt = stmt.where(User.roles.any(role))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where((User.email.ilike(pattern)) | (User.username.ilike(pattern)))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return {
        "items": [_user_dict(u) for u in users],
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    # Fetch MT4 account count
    acct_count = await db.scalar(
        select(func.count()).select_from(MT4Account).where(MT4Account.user_id == uid)
    )
    d = _user_dict(user)
    d["mt4_account_count"] = acct_count or 0
    return d


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: dict,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    allowed = {"is_active", "roles", "kyc_status"}
    for key, value in payload.items():
        if key in allowed:
            setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return _user_dict(user)


# ── Master Approval ───────────────────────────────────────────────────────────

@router.get("/masters/pending")
async def list_pending_masters(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.kyc_status == "PENDING").order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    out = []
    for u in users:
        acct_count = await db.scalar(
            select(func.count()).select_from(MT4Account).where(MT4Account.user_id == u.id)
        )
        d = _user_dict(u)
        d["mt4_account_count"] = acct_count or 0
        out.append(d)
    return out


@router.post("/masters/{user_id}/approve")
async def approve_master(
    user_id: str,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    roles = list(user.roles or [])
    if "MASTER" not in roles:
        roles.append("MASTER")
    user.roles = roles
    user.kyc_status = "VERIFIED"
    await db.commit()
    asyncio.create_task(email_service.send_master_approved(to_email=user.email))
    return {"status": "approved", "user_id": user_id}


@router.post("/masters/{user_id}/reject")
async def reject_master(
    user_id: str,
    reason: str = "Application rejected",
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.kyc_status = "REJECTED"
    await db.commit()
    asyncio.create_task(email_service.send_master_rejected(to_email=user.email, reason=reason))
    return {"status": "rejected", "user_id": user_id, "reason": reason}


# ── Leaderboard Management ────────────────────────────────────────────────────

@router.get("/leaderboard")
async def admin_leaderboard(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LeaderboardScore)
        .where(LeaderboardScore.period == "ALL")
        .order_by(LeaderboardScore.total_return_pct.desc())
        .limit(100)
    )
    scores = result.scalars().all()
    return [
        {
            "master_id": str(s.master_id),
            "period": s.period,
            "total_return_pct": float(s.total_return_pct or 0),
            "max_drawdown_pct": float(s.max_drawdown_pct or 0),
            "sharpe_ratio": float(s.sharpe_ratio or 0),
            "win_rate_pct": float(s.win_rate_pct or 0),
            "followers_count": s.followers_count,
            "risk_grade": s.risk_grade,
            "calculated_at": s.calculated_at.isoformat() if s.calculated_at else None,
        }
        for s in scores
    ]


@router.post("/leaderboard/recalculate")
async def trigger_leaderboard_recalculate(
    full: bool = Query(False, description="True=全量所有周期, False=只算1M和ALL"),
    admin: dict = Depends(require_admin),
):
    """手动触发排行榜重算 Celery 任务。"""
    from app.tasks.leaderboard import recalculate_leaderboard
    task = recalculate_leaderboard.delay(full=full)
    return {"task_id": task.id, "full": full, "status": "queued"}


@router.delete("/leaderboard/{master_id}", status_code=204)
async def remove_from_leaderboard(
    master_id: str,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(master_id)
    await db.execute(
        delete(LeaderboardScore).where(LeaderboardScore.master_id == uid)
    )
    await db.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "username": u.username,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "roles": u.roles,
        "kyc_status": u.kyc_status,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }
