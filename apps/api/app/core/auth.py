import uuid
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

_MOCK_USER = {
    "sub": "00000000-0000-0000-0000-000000000001",
    "email": "dev@example.com",
    "role": "FOLLOWER",
}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if settings.DEBUG and not settings.SUPABASE_JWT_SECRET:
        return _MOCK_USER

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
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
