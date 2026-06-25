import re
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    # 公开注册只能成为 FOLLOWER，角色提升须管理员审批
    role: Literal["FOLLOWER"] = "FOLLOWER"

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_\-]+$', v):
            raise ValueError("Username must contain only letters, numbers, _ or -")
        return v


class UserUpdate(BaseModel):
    username: str | None = None
    display_name: str | None = None
    preferred_lang: str | None = None
    timezone: str | None = None
    risk_tolerance: str | None = None
    wallet_address: str | None = None
    email_notify_signals: bool | None = None
    email_notify_billing: bool | None = None


class MasterApplyRequest(BaseModel):
    strategy_name: str = Field(..., min_length=2, max_length=200)
    trading_style: Literal["SCALPING", "SWING", "POSITION", "MIXED"]
    description: str = Field(..., min_length=20, max_length=1000)
    monthly_return_pct: float = Field(..., ge=0, le=500)
    max_drawdown_pct: float = Field(..., ge=0, le=100)
    price_usd: float = Field(..., ge=0, le=500)
    perf_fee_pct: float = Field(default=0, ge=0, le=50)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str | None
    display_name: str | None
    avatar_url: str | None = None
    wallet_address: str | None = None
    roles: list[str]
    kyc_status: str
    preferred_lang: str
    email_notify_signals: bool = True
    email_notify_billing: bool = True
    created_at: datetime


class MasterApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str | None
    display_name: str | None
    roles: list[str]
    kyc_status: str
    apply_strategy: str | None
    apply_description: str | None
    apply_trading_style: str | None
    apply_monthly_return_pct: float | None
    apply_max_drawdown_pct: float | None
    apply_price_usd: float | None
    apply_perf_fee_pct: float | None
    applied_at: datetime | None
    created_at: datetime
