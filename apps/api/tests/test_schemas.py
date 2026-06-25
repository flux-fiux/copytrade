"""Unit tests for Pydantic schema validators."""
import pytest
from pydantic import ValidationError


def test_username_valid():
    from app.schemas.user import UserCreate
    u = UserCreate(username="valid_user-123", email="a@b.com", password="secure123")
    assert u.username == "valid_user-123"


def test_username_too_short():
    from app.schemas.user import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(username="ab", email="a@b.com", password="secure123")


def test_username_invalid_chars():
    from app.schemas.user import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(username="invalid name!", email="a@b.com", password="secure123")


def test_username_sanitized_from_google_oauth():
    """Ensure a Google OAuth display name (has spaces) would fail validation — caller must sanitize."""
    from app.schemas.user import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(username="Zhang San", email="a@b.com", password="x" * 8)


def test_username_too_long():
    from app.schemas.user import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(username="a" * 31, email="a@b.com", password="secure123")
