"""API-key authentication for the broker integration API.

Resolves the tenant from an ``X-API-Key`` header (SHA-256 hash lookup) and sets
the request tenant context, so all downstream queries are tenant-scoped by the
same app-layer filter + RLS used everywhere else.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant_context import set_current_tenant
from app.models.api_key import ApiKey

KEY_PREFIX = "ct_live_"


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_key() -> tuple[str, str, str]:
    """Return (raw_key, display_prefix, sha256_hash)."""
    raw = KEY_PREFIX + secrets.token_hex(20)
    return raw, raw[: len(KEY_PREFIX) + 4], hash_key(raw)


async def get_broker_tenant(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    row = (
        await db.execute(
            select(ApiKey).where(ApiKey.key_hash == hash_key(x_api_key), ApiKey.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")
    set_current_tenant(row.tenant_id)
    await db.execute(
        update(ApiKey).where(ApiKey.id == row.id).values(last_used_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return row.tenant_id
