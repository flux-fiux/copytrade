import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    roles: list[str]
    kyc_status: str
    preferred_lang: str
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
