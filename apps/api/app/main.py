from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
from app.core.config import settings
from app.routers import users, mt4_accounts, signals, copy_trades, leaderboard, market_data, subscriptions, tenants, webhooks, admin, payments
from app.services.market_data import market_data_service


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_methods=["*"],
    allow_headers=["*"],
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
