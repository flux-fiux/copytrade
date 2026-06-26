import uuid
import asyncio
import httpx
from fastapi import HTTPException
from app.core.config import settings

PROVISIONING_URL = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai"
CLIENT_URL = "https://mt-client-api-v1.new-york.agiliumtrade.ai"


class MetaAPIService:
    @property
    def _headers(self) -> dict:
        return {"auth-token": settings.METAAPI_TOKEN, "Content-Type": "application/json"}

    @property
    def _dev_mode(self) -> bool:
        return not settings.METAAPI_TOKEN

    async def provision_account(
        self, broker: str, login: str, password: str, server: str, platform: str = "mt4",
        copy_factory_roles: list[str] | None = None,
    ) -> dict:
        if self._dev_mode:
            return {"id": f"mock-{uuid.uuid4().hex[:8]}", "state": "DEPLOYED"}

        body = {
            "login": login,
            "password": password,
            "name": f"{broker}-{login}",
            "server": server,
            "platform": platform.lower(),
            "magic": 0,
            "type": "cloud",
        }
        # CopyFactory requires accounts tagged PROVIDER (master) / SUBSCRIBER
        # (follower) at provisioning — the role can't be added afterwards.
        if copy_factory_roles:
            body["copyFactoryRoles"] = copy_factory_roles

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{PROVISIONING_URL}/users/current/accounts",
                headers=self._headers,
                json=body,
            )
        if resp.status_code not in (200, 201):
            raise HTTPException(502, detail=f"MetaAPI error: {resp.text[:200]}")
        return resp.json()

    async def deploy_account(self, account_id: str) -> None:
        if self._dev_mode:
            return

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{PROVISIONING_URL}/users/current/accounts/{account_id}/deploy",
                headers=self._headers,
            )
        if resp.status_code not in (200, 204):
            raise HTTPException(502, detail=f"MetaAPI deploy error: {resp.text[:200]}")

    async def wait_until_connected(self, account_id: str, timeout: int = 45, interval: int = 5) -> bool:
        """Poll until the account is broker-CONNECTED (CopyFactory strategy/subscriber
        creation requires it). Returns False on timeout rather than raising."""
        if self._dev_mode:
            return True
        elapsed = 0
        while elapsed < timeout:
            try:
                info = await self.get_account_info(account_id)
                if info.get("connectionStatus") == "CONNECTED":
                    return True
            except Exception:
                pass
            await asyncio.sleep(interval)
            elapsed += interval
        return False

    async def get_account_info(self, account_id: str) -> dict:
        if self._dev_mode:
            return {"id": account_id, "state": "DEPLOYED", "connectionStatus": "CONNECTED"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{PROVISIONING_URL}/users/current/accounts/{account_id}",
                headers=self._headers,
            )
        if resp.status_code != 200:
            raise HTTPException(502, detail=f"MetaAPI error: {resp.text[:200]}")
        return resp.json()

    async def get_account_information(self, account_id: str) -> dict:
        """Returns live trading account data: balance, equity, leverage, currency."""
        if self._dev_mode:
            return {
                "balance": 12480.00,
                "equity": 12621.50,
                "leverage": 100,
                "currency": "USD",
                "connectionStatus": "CONNECTED",
            }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{CLIENT_URL}/users/current/accounts/{account_id}/account-information",
                headers=self._headers,
            )
        if resp.status_code != 200:
            raise HTTPException(502, detail=f"MetaAPI error: {resp.text[:200]}")
        return resp.json()

    async def remove_account(self, account_id: str) -> None:
        if self._dev_mode or account_id.startswith("mock-"):
            return

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                f"{PROVISIONING_URL}/users/current/accounts/{account_id}",
                headers=self._headers,
            )
        if resp.status_code not in (200, 204):
            raise HTTPException(502, detail=f"MetaAPI remove error: {resp.text[:200]}")


metaapi_service = MetaAPIService()
