"""Master announcements (community).

Masters post short updates for their followers; everyone can read a master's
announcements on their profile. Reads are tenant-scoped; only the master may
post/delete their own.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_tenant_id
from app.core.database import get_db
from app.models.master_announcement import MasterAnnouncement

router = APIRouter()


@router.get("/{master_id}/announcements")
async def list_announcements(
    master_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(MasterAnnouncement)
            .where(MasterAnnouncement.master_id == master_id)
            .order_by(MasterAnnouncement.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "body": a.body,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]


@router.post("/{master_id}/announcements")
async def create_announcement(
    master_id: uuid.UUID,
    payload: dict,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if uuid.UUID(current_user["sub"]) != master_id:
        raise HTTPException(403, "You can only post announcements on your own profile")
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(422, "title is required")
    body = payload.get("body")
    a = MasterAnnouncement(
        tenant_id=tenant_id, master_id=master_id,
        title=title[:200], body=(str(body)[:4000] if body else None),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"id": str(a.id), "title": a.title, "body": a.body,
            "created_at": a.created_at.isoformat() if a.created_at else None}


@router.delete("/{master_id}/announcements/{announcement_id}")
async def delete_announcement(
    master_id: uuid.UUID,
    announcement_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if uuid.UUID(current_user["sub"]) != master_id:
        raise HTTPException(403, "Not allowed")
    a = (
        await db.execute(
            select(MasterAnnouncement).where(
                MasterAnnouncement.id == announcement_id,
                MasterAnnouncement.master_id == master_id,
            )
        )
    ).scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Announcement not found")
    await db.delete(a)
    await db.commit()
    return {"deleted": True}
