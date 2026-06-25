from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id, require_admin
from app.core.database import get_db
from app.models.tenant import Tenant

import uuid

router = APIRouter()


@router.get("/current")
async def get_current_tenant(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the current tenant's public config (branding, plan)."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    config = tenant.config or {}
    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "plan": tenant.plan,
        # null when unset so the default tenant keeps the app's native theme;
        # white-label tenants that set a color get it applied on the frontend.
        "primary_color": config.get("primary_color"),
        "logo_url": config.get("logo_url"),
        "favicon_url": config.get("favicon_url"),
    }


@router.patch("/current/branding")
async def update_branding(
    payload: dict,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update tenant branding (admin only)."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    allowed = {"primary_color", "logo_url", "favicon_url", "name"}
    config = dict(tenant.config or {})
    for k, v in payload.items():
        if k not in allowed:
            continue
        if k == "name":
            tenant.name = str(v)[:100]
        else:
            config[k] = v
    tenant.config = config
    await db.commit()
    return {"updated": True}
