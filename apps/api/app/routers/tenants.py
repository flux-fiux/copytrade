from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_tenant_id, require_admin
from app.core.broker_auth import generate_key
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.api_key import ApiKey

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


# ── Broker API keys (admin) ────────────────────────────────────────────────
@router.get("/current/api-keys")
async def list_api_keys(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(ApiKey).where(ApiKey.tenant_id == tenant_id).order_by(ApiKey.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": str(k.id),
            "name": k.name,
            "prefix": k.prefix,
            "is_active": k.is_active,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "created_at": k.created_at.isoformat() if k.created_at else None,
        }
        for k in rows
    ]


@router.post("/current/api-keys")
async def create_api_key(
    payload: dict,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a broker API key. The raw key is returned ONCE — store it now."""
    name = str(payload.get("name") or "Untitled key")[:100]
    raw, prefix, key_hash = generate_key()
    key = ApiKey(tenant_id=tenant_id, name=name, prefix=prefix, key_hash=key_hash)
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return {"id": str(key.id), "name": key.name, "prefix": key.prefix, "api_key": raw}


@router.delete("/current/api-keys/{key_id}")
async def revoke_api_key(
    key_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    key = (
        await db.execute(
            select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not key:
        raise HTTPException(404, "API key not found")
    key.is_active = False
    await db.commit()
    return {"revoked": True}
