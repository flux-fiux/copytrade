import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    username: str | None = None
    role: str = "FOLLOWER"


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
