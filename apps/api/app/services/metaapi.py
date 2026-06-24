import uuid
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
        self, broker: str, login: str, password: str, server: str, platform: str = "mt4"
    ) -> dict:
        if self._dev_mode:
            return {"id": f"mock-{uuid.uuid4().hex[:8]}", "state": "DEPLOYED"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{PROVISIONING_URL}/users/current/accounts",
                headers=self._headers,
                json={
                    "login": login,
                    "password": password,
                    "name": f"{broker}-{login}",
                    "server": server,
                    "platform": platform.lower(),
                    "magic": 0,
                    "type": "cloud",
                },
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
