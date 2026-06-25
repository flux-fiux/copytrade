import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.internal_auth import verify_internal
from app.core.rate_limit import rate_limit
from app.models.mt4_account import MT4Account
from app.schemas.mt4_account import MT4AccountConnect, MT4AccountOut, MT4AccountSyncOut
from app.services.copyfactory import copyfactory_service
from app.services.encryption import encrypt
from app.services.metaapi import metaapi_service

router = APIRouter()

DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("/", response_model=list[MT4AccountOut])
async def list_accounts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(MT4Account).where(MT4Account.user_id == user_id))
    return result.scalars().all()


@router.post("/", response_model=MT4AccountOut, status_code=status.HTTP_201_CREATED)
async def connect_account(
    payload: MT4AccountConnect,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(request, "connect_mt4", max_calls=5, window_seconds=3600)
    user_id = uuid.UUID(current_user["sub"])

    meta_info = await metaapi_service.provision_account(
        broker=payload.broker_name,
        login=payload.login,
        password=payload.password,
        server=payload.server,
        platform=payload.platform.lower(),
    )
    meta_api_account_id = meta_info["id"]
    await metaapi_service.deploy_account(meta_api_account_id)

    copy_factory_strategy_id = None
    if payload.account_type == "MASTER":
        strategy_id = str(uuid.uuid4())
        await copyfactory_service.create_strategy(
            strategy_id,
            meta_api_account_id,
            f"{payload.broker_name}-{payload.login}",
        )
        copy_factory_strategy_id = strategy_id

    account = MT4Account(
        user_id=user_id,
        tenant_id=DEFAULT_TENANT_ID,
        meta_api_account_id=meta_api_account_id,
        broker_name=payload.broker_name,
        login=payload.login,
        server=payload.server,
        account_type=payload.account_type,
        platform=payload.platform,
        connection_status="CONNECTING",
        encrypted_password=encrypt(payload.password),
        copy_factory_strategy_id=copy_factory_strategy_id,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/{account_id}/sync", response_model=MT4AccountSyncOut)
async def sync_account(
    account_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(MT4Account).where(MT4Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if account.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    info = await metaapi_service.get_account_information(account.meta_api_account_id)
    account.balance = info.get("balance")
    account.equity = info.get("equity")
    account.connection_status = info.get("connectionStatus", "CONNECTED")
    account.last_synced_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(account)
    return account


@router.get("/masters")
async def list_master_accounts(
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(verify_internal),
):
    """Internal endpoint for worker-ct to fetch active master accounts."""
    result = await db.execute(
        select(MT4Account).where(MT4Account.account_type == "MASTER")
    )
    accounts = result.scalars().all()
    return [
        {"metaApiAccountId": a.meta_api_account_id, "masterId": str(a.user_id)}
        for a in accounts
    ]


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(select(MT4Account).where(MT4Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if account.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    await metaapi_service.remove_account(account.meta_api_account_id)
    await db.delete(account)
    await db.commit()
