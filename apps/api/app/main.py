from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
from app.core.config import settings
from app.routers import users, mt4_accounts, signals, copy_trades, leaderboard, market_data, subscriptions, tenants, webhooks, admin, payments, analytics, notifications, broker, reviews, announcements
from app.services.market_data import market_data_service
from app.services.copyfactory import copyfactory_service

# Error monitoring — only active when SENTRY_DSN is configured.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            traces_sample_rate=0.1,
        )
    except Exception:  # never let monitoring setup break startup
        pass


def _assert_production_config() -> None:
    """生产环境启动时校验关键配置，缺失直接拒绝启动。"""
    if settings.APP_ENV != "production":
        return
    errors = []
    if not settings.SUPABASE_JWT_SECRET:
        errors.append("SUPABASE_JWT_SECRET")
    if not settings.ENCRYPTION_KEY:
        errors.append("ENCRYPTION_KEY")
    if settings.INTERNAL_API_TOKEN in ("dev-internal-token-change-in-prod", "change-me", ""):
        errors.append("INTERNAL_API_TOKEN (still using default — run: openssl rand -hex 32)")
    if not settings.CRYPTOMUS_API_KEY:
        errors.append("CRYPTOMUS_API_KEY")
    if not settings.CRYPTOMUS_MERCHANT_UUID:
        errors.append("CRYPTOMUS_MERCHANT_UUID")
    if settings.SECRET_KEY in ("change-me-in-production", ""):
        errors.append("SECRET_KEY (still using default)")
    if not settings.STRIPE_SECRET_KEY:
        errors.append("STRIPE_SECRET_KEY")
    if not settings.STRIPE_WEBHOOK_SECRET:
        errors.append("STRIPE_WEBHOOK_SECRET")
    if not settings.METAAPI_TOKEN:
        errors.append("METAAPI_TOKEN")
    if errors:
        raise RuntimeError(f"Missing required production config: {', '.join(errors)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _assert_production_config()
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    market_data_service.set_redis(redis_client)
    yield
    await redis_client.aclose()
    await copyfactory_service.close()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)


@app.middleware("http")
async def _reset_tenant_context(request, call_next):
    """Start every request with a clean tenant context (fail-closed default)."""
    from app.core.tenant_context import reset_current_tenant
    reset_current_tenant()
    return await call_next(request)

app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(mt4_accounts.router, prefix="/api/v1/mt4-accounts", tags=["mt4-accounts"])
app.include_router(signals.router, prefix="/api/v1/signals", tags=["signals"])
app.include_router(copy_trades.router, prefix="/api/v1/copy-trades", tags=["copy-trades"])
app.include_router(leaderboard.router, prefix="/api/v1/leaderboard", tags=["leaderboard"])
app.include_router(market_data.router, prefix="/api/v1/market", tags=["market-data"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["subscriptions"])
app.include_router(tenants.router, prefix="/api/v1/tenants", tags=["tenants"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(broker.router, prefix="/api/v1/broker", tags=["broker"])
app.include_router(reviews.router, prefix="/api/v1/masters", tags=["reviews"])
app.include_router(announcements.router, prefix="/api/v1/masters", tags=["announcements"])


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}
