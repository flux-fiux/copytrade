"""Smoke tests: all routers import without error and FastAPI registers routes."""
import importlib
import pytest


ROUTERS = [
    "app.routers.users",
    "app.routers.admin",
    "app.routers.tenants",
    "app.routers.mt4_accounts",
    "app.routers.signals",
    "app.routers.subscriptions",
    "app.routers.copy_trades",
    "app.routers.leaderboard",
    "app.routers.market_data",
    "app.routers.payments",
    "app.routers.webhooks",
]


@pytest.mark.parametrize("module_path", ROUTERS)
def test_router_imports(module_path: str):
    mod = importlib.import_module(module_path)
    assert hasattr(mod, "router"), f"{module_path} must expose a `router` object"


def test_app_starts():
    """FastAPI application initializes with all routes registered (checked via OpenAPI schema)."""
    from app.main import app
    paths = set(app.openapi().get("paths", {}).keys())
    assert any("/api/v1/users" in p for p in paths), "users router not mounted"
    assert any("/api/v1/leaderboard" in p for p in paths), "leaderboard router not mounted"
    assert any("/api/v1/copy-trades" in p for p in paths), "copy-trades router not mounted"
    assert any("/api/v1/signals" in p for p in paths), "signals router not mounted"
    assert any("/api/v1/subscriptions" in p for p in paths), "subscriptions router not mounted"
    assert len(paths) >= 30, f"Expected 30+ routes, got {len(paths)}"
