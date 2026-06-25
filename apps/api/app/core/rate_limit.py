"""Simple Redis-backed rate limiter for FastAPI routes."""
from fastapi import HTTPException, Request, status
import redis.asyncio as aioredis
from app.core.config import settings

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def rate_limit(request: Request, key_prefix: str, max_calls: int, window_seconds: int) -> None:
    """Raise 429 if IP exceeds max_calls within window_seconds."""
    ip = request.client.host if request.client else "unknown"
    key = f"rl:{key_prefix}:{ip}"
    try:
        r = _get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window_seconds)
        if count > max_calls:
            ttl = await r.ttl(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {ttl}s.",
                headers={"Retry-After": str(ttl)},
            )
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable — fail open (don't block requests)
        pass
