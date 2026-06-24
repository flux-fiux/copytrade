import uuid
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
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
