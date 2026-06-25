"""Shared-secret auth for internal service-to-service calls (worker-ct → API)."""
from fastapi import Header, HTTPException, status
from app.core.config import settings


def verify_internal(x_internal_token: str | None = Header(default=None)) -> None:
    expected = settings.INTERNAL_API_TOKEN
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal token")
