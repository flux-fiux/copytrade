import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])

    # Upsert — return existing if already exists
    result = await db.execute(select(User).where(User.id == user_id))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    # Resolve default tenant (platform tenant, id=1 placeholder)
    DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

    user = User(
        id=user_id,
        tenant_id=DEFAULT_TENANT_ID,
        email=payload.email,
        username=payload.username,
        roles=[payload.role],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user
