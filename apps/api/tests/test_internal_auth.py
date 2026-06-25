"""Unit tests for internal auth middleware."""
import os
import pytest
from fastapi import HTTPException


GOOD_TOKEN = os.environ.get("INTERNAL_API_TOKEN", "test-internal-token")


def test_valid_internal_token():
    from app.core.internal_auth import verify_internal
    # Should not raise
    verify_internal(x_internal_token=GOOD_TOKEN)


def test_missing_internal_token_raises():
    from app.core.internal_auth import verify_internal
    with pytest.raises(HTTPException) as exc:
        verify_internal(x_internal_token=None)
    assert exc.value.status_code == 403


def test_wrong_internal_token_raises():
    from app.core.internal_auth import verify_internal
    with pytest.raises(HTTPException) as exc:
        verify_internal(x_internal_token="wrong-token")
    assert exc.value.status_code == 403
