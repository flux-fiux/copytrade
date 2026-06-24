import uuid
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if not settings.SUPABASE_JWT_SECRET:
        # No JWT secret configured — only acceptable in local dev with explicit flag
        if settings.APP_ENV != "development":
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth not configured")
        # Dev mode: parse without verification so local testing works with a real Supabase token
        try:
            payload = jwt.decode(credentials.credentials, options={"verify_signature": False})
            return payload
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_role(*roles: str):
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_roles = user.get("roles", [user.get("role", "FOLLOWER")])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        if not any(r in user_roles for r in roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    roles = current_user.get("roles", [current_user.get("role", "")])
    if isinstance(roles, str):
        roles = [roles]
    if not any(r in roles for r in ("SUPER_ADMIN", "TENANT_ADMIN")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """仅 SUPER_ADMIN 可访问，TENANT_ADMIN 不行。"""
    roles = current_user.get("roles", [current_user.get("role", "")])
    if isinstance(roles, str):
        roles = [roles]
    if "SUPER_ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """不强制要求认证的接口使用，返回 None 表示未登录。"""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def get_tenant_id(
    request: Request,
    current_user: dict | None = Depends(get_current_user_optional),
    db: AsyncSession | None = None,
) -> uuid.UUID:
    """
    解析当前请求的 tenant_id：
    1. 已认证用户 → 从 DB 取其 tenant_id（防止 JWT 中伪造）
    2. 公开请求 → 从 Host 子域名解析
    3. 回退 → 使用默认（第一个）租户（MVP 单租户场景）
    """
    # 延迟导入避免循环依赖
    from app.core.database import get_db as _get_db
    from app.models.user import User
    from app.models.tenant import Tenant

    # 如果调用方没有传 db，从 DI 获取
    if db is None:
        async for _db in _get_db():
            db = _db
            break

    if current_user:
        try:
            user_id = uuid.UUID(current_user["sub"])
            result = await db.execute(select(User.tenant_id).where(User.id == user_id))
            tenant_id = result.scalar_one_or_none()
            if tenant_id:
                return tenant_id
        except Exception:
            pass

    # 从 Host 子域名解析租户
    host = request.headers.get("host", "").split(":")[0]
    subdomain = host.split(".")[0] if "." in host else ""
    if subdomain and subdomain not in ("www", "api", "localhost"):
        result = await db.execute(
            select(Tenant.id).where(Tenant.subdomain == subdomain, Tenant.is_active.is_(True))
        )
        tenant_id = result.scalar_one_or_none()
        if tenant_id:
            return tenant_id

    # 回退：默认租户（MVP 单租户）
    result = await db.execute(select(Tenant.id).where(Tenant.is_active.is_(True)).limit(1))
    tenant_id = result.scalar_one_or_none()
    if tenant_id:
        return tenant_id

    raise HTTPException(status_code=503, detail="No active tenant found")
