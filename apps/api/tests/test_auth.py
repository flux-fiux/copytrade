"""Unit tests for auth helpers."""
import os
import pytest
import jwt as pyjwt


SECRET = os.environ.get("SUPABASE_JWT_SECRET", "test-secret-32-chars-long-pad000")


def _make_token(sub: str, role: str = "FOLLOWER", expired: bool = False) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "aud": "authenticated",
        "exp": 1 if expired else 9999999999,
    }
    return pyjwt.encode(payload, SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_valid_token_decoded():
    from app.core.auth import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials

    token = _make_token("aaa-bbb-ccc")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    result = await get_current_user(creds)
    assert result["sub"] == "aaa-bbb-ccc"
    assert result["role"] == "FOLLOWER"


@pytest.mark.asyncio
async def test_expired_token_raises():
    from app.core.auth import get_current_user
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    token = _make_token("aaa", expired=True)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc:
        await get_current_user(creds)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_raises():
    from app.core.auth import get_current_user
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not.a.token")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(creds)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_no_credentials_raises():
    from app.core.auth import get_current_user
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await get_current_user(None)
    assert exc.value.status_code == 401
