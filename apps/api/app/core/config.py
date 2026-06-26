from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "CopyTrade Platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/copytrade"
    REDIS_URL: str = "redis://localhost:6379/0"
    # When true, issue `SET LOCAL app.current_tenant` per transaction so Postgres
    # RLS policies enforce tenant isolation. Requires connecting as a role WITHOUT
    # BYPASSRLS and the RLS migration applied. Keep false until both are in place.
    RLS_ENABLED: bool = False

    # Error monitoring (optional — set to enable Sentry)
    SENTRY_DSN: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # MetaAPI
    METAAPI_TOKEN: str = ""
    METAAPI_DOMAIN: str = "agiliumtrade.agiliumtrade.ai"

    # Stripe (kept for backward compat, unused)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CONNECT_CLIENT_ID: str = ""

    # CryptoMus
    CRYPTOMUS_API_KEY: str = ""
    CRYPTOMUS_MERCHANT_UUID: str = ""

    # Market Data
    FINNHUB_API_KEY: str = ""
    TWELVE_DATA_API_KEY: str = ""
    POLYGON_API_KEY: str = ""

    # Platform Config
    PLATFORM_COMMISSION_RATE: float = 0.20  # 20% 平台抽成

    # Encryption (MT4 password AES-256)
    ENCRYPTION_KEY: str = ""  # 32-byte hex key

    # Email (SendGrid)
    SENDGRID_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@copytrade.io"
    FROM_NAME: str = "CopyTrade"
    FRONTEND_URL: str = "http://localhost:3000"
    API_BASE_URL: str = "http://localhost:8000"

    # AI — 支持 deepseek（默认）和 anthropic
    AI_PROVIDER: str = "deepseek"          # "deepseek" | "anthropic"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"  # deepseek-chat | deepseek-reasoner
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # AI Analyst — TradingAgents multi-agent core (powered by DeepSeek for cost)
    ALPHA_VANTAGE_API_KEY: str = ""          # market data source for the agents (free tier)
    # deepseek-chat = fast non-thinking mode (was deepseek-reasoner, ~5min/run).
    # NOTE: deepseek-chat/-reasoner deprecate 2026-07-24 → migrate to
    # deepseek-v4-flash (non-thinking) once the thinking-toggle param is confirmed.
    AGENT_DEEP_MODEL: str = "deepseek-chat"       # deliberation / debate
    AGENT_QUICK_MODEL: str = "deepseek-chat"      # fast tool-calling steps
    AGENT_MAX_DEBATE_ROUNDS: int = 1

    # Internal service auth (worker-ct → API)
    INTERNAL_API_TOKEN: str = "dev-internal-token-change-in-prod"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
