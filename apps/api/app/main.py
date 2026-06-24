from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
from app.core.config import settings
from app.routers import users, mt4_accounts, signals, copy_trades, leaderboard, market_data, subscriptions, tenants, webhooks, admin, payments
from app.services.market_data import market_data_service


def _assert_production_config() -> None:
    """生产环境启动时校验关键配置，缺失直接拒绝启动。"""
    if settings.APP_ENV != "production":
        return
    errors = []
    if not settings.SUPABASE_JWT_SECRET:
        errors.append("SUPABASE_JWT_SECRET")
    if not settings.ENCRYPTION_KEY:
        errors.append("ENCRYPTION_KEY")
    if not settings.CRYPTOMUS_API_KEY:
        errors.append("CRYPTOMUS_API_KEY")
    if not settings.CRYPTOMUS_MERCHANT_UUID:
        errors.append("CRYPTOMUS_MERCHANT_UUID")
    if settings.SECRET_KEY in ("change-me-in-production", ""):
        errors.append("SECRET_KEY (still using default)")
    if errors:
        raise RuntimeError(f"Missing required production config: {', '.join(errors)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _assert_production_config()
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    market_data_service.set_redis(redis_client)
    yield
    await redis_client.aclose()


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


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}
