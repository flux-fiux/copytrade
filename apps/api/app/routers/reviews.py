"""Master ratings & reviews (community).

Reads are public (tenant-scoped); writing requires auth. One review per
(master, reviewer); posting again updates the existing review.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_tenant_id
from app.core.database import get_db
from app.models.master_review import MasterReview
from app.models.user import User

router = APIRouter()


@router.get("/{master_id}/reviews")
async def list_reviews(
    master_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    agg = (
        await db.execute(
            select(func.avg(MasterReview.rating), func.count(MasterReview.id))
            .where(MasterReview.master_id == master_id)
        )
    ).one()
    avg, count = agg
    rows = (
        await db.execute(
            select(MasterReview, User.display_name, User.username)
            .join(User, User.id == MasterReview.reviewer_id)
            .where(MasterReview.master_id == master_id)
            .order_by(MasterReview.created_at.desc())
            .limit(100)
        )
    ).all()
    return {
        "average": round(float(avg), 2) if avg is not None else None,
        "count": count,
        "reviews": [
            {
                "id": str(r.id),
                "reviewer": dn or un or "User",
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, dn, un in rows
        ],
    }


@router.post("/{master_id}/reviews")
async def upsert_review(
    master_id: uuid.UUID,
    payload: dict,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rating = payload.get("rating")
    if not isinstance(rating, int) or not (1 <= rating <= 5):
        raise HTTPException(422, "rating must be an integer 1–5")
    reviewer_id = uuid.UUID(current_user["sub"])
    if reviewer_id == master_id:
        raise HTTPException(400, "You cannot review yourself")
    comment = (payload.get("comment") or None)
    if comment:
        comment = str(comment)[:2000]

    existing = (
        await db.execute(
            select(MasterReview).where(
                MasterReview.master_id == master_id, MasterReview.reviewer_id == reviewer_id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.rating = rating
        existing.comment = comment
    else:
        db.add(MasterReview(
            tenant_id=tenant_id, master_id=master_id, reviewer_id=reviewer_id,
            rating=rating, comment=comment,
        ))
    await db.commit()
    return {"ok": True}


@router.delete("/{master_id}/reviews")
async def delete_review(
    master_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reviewer_id = uuid.UUID(current_user["sub"])
    row = (
        await db.execute(
            select(MasterReview).where(
                MasterReview.master_id == master_id, MasterReview.reviewer_id == reviewer_id
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Review not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}
