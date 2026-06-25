"""Shared fixtures for the test suite."""
import os
import pytest

# Set env vars BEFORE any app imports to seed pydantic-settings.
# Use the default postgres URL (engine is created at import time but won't
# actually connect until a query is made, so import-only tests are safe).
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-32-chars-long-pad000")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("ENCRYPTION_KEY", "a" * 64)
os.environ.setdefault("INTERNAL_API_TOKEN", "test-internal-token")
os.environ.setdefault("API_BASE_URL", "http://localhost:8000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
# Ensure external service mocks are active (empty key → mock mode)
os.environ.setdefault("METAAPI_TOKEN", "")
os.environ.setdefault("SENDGRID_API_KEY", "")
os.environ.setdefault("CRYPTOMUS_API_KEY", "")
os.environ.setdefault("CRYPTOMUS_MERCHANT_UUID", "")


def make_jwt(sub: str = "00000000-0000-0000-0000-000000000001", role: str = "FOLLOWER") -> str:
    """Create a valid HS256 JWT for test requests."""
    import jwt as pyjwt
    payload = {
        "sub": sub,
        "role": role,
        "aud": "authenticated",
        "exp": 9999999999,
    }
    return pyjwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")
