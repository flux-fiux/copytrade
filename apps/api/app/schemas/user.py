import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    username: str | None = None
    # 公开注册只能成为 FOLLOWER，角色提升须管理员审批
    role: Literal["FOLLOWER"] = "FOLLOWER"


class UserUpdate(BaseModel):
    username: str | None = None
    display_name: str | None = None
    preferred_lang: str | None = None
    timezone: str | None = None
    risk_tolerance: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str | None
    display_name: str | None
    avatar_url: str | None = None
    roles: list[str]
    kyc_status: str
    preferred_lang: str
    created_at: datetime
