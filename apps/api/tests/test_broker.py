"""Broker API key auth — unit-level checks (no DB)."""
from app.core.broker_auth import generate_key, hash_key, KEY_PREFIX
from app.core.tenant_context import TENANT_SCOPED_MODELS


def test_hash_key_deterministic():
    assert hash_key("abc") == hash_key("abc")
    assert hash_key("abc") != hash_key("abd")
    assert len(hash_key("abc")) == 64  # sha256 hex


def test_generate_key_shape():
    raw, prefix, h = generate_key()
    assert raw.startswith(KEY_PREFIX)
    assert prefix == raw[: len(KEY_PREFIX) + 4]
    assert h == hash_key(raw)
    # two calls never collide
    assert generate_key()[0] != generate_key()[0]


def test_api_keys_not_tenant_scoped():
    # ApiKey is the bootstrap lookup table; it must NOT be auto-filtered by the
    # tenant ORM hook, or resolving a tenant from a key would be impossible.
    assert "ApiKey" not in TENANT_SCOPED_MODELS


def test_broker_router_has_routes():
    from app.routers import broker
    paths = {r.path for r in broker.router.routes}
    assert {"/masters", "/leaderboard", "/signals"}.issubset(paths)
