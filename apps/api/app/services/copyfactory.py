import httpx
from app.core.config import settings

COPYFACTORY_BASE = "https://copyfactory-api-v1.new-york.agiliumtrade.ai"


class CopyFactoryService:
    def __init__(self) -> None:
        self.token = settings.METAAPI_TOKEN
        self.headers = {"auth-token": self.token, "Content-Type": "application/json"}

    def _is_mock(self) -> bool:
        return not self.token

    async def create_strategy(self, strategy_id: str, master_meta_account_id: str, name: str) -> dict:
        if self._is_mock():
            return {"id": strategy_id, "mock": True}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.put(
                f"{COPYFACTORY_BASE}/users/current/configuration/strategies/{strategy_id}",
                json={
                    "name": name,
                    "positionLifecycle": "hedging",
                    "accountId": master_meta_account_id,
                    "maxTradeRisk": 0.1,
                    "riskLimits": [],
                    "timeSettings": {},
                },
                headers=self.headers,
            )
            r.raise_for_status()
            return r.json()

    async def create_subscriber(
        self,
        subscriber_meta_account_id: str,
        strategy_id: str,
        lot_multiplier: float = 1.0,
        max_drawdown_pct: float = 20.0,
        allowed_symbols: list[str] | None = None,
    ) -> dict:
        if self._is_mock():
            return {"subscriberAccountId": subscriber_meta_account_id, "mock": True}

        subscription_config: dict = {
            "strategyId": strategy_id,
            "multiplier": lot_multiplier,
            "maxTradeRisk": max_drawdown_pct / 100,
        }
        if allowed_symbols:
            subscription_config["symbolFilter"] = {"included": allowed_symbols}

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.put(
                f"{COPYFACTORY_BASE}/users/current/configuration/subscribers/{subscriber_meta_account_id}",
                json={"subscriptions": [subscription_config]},
                headers=self.headers,
            )
            r.raise_for_status()
            return r.json()

    async def remove_subscriber_strategy(self, subscriber_meta_account_id: str, strategy_id: str) -> None:
        if self._is_mock():
            return
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{COPYFACTORY_BASE}/users/current/configuration/subscribers/{subscriber_meta_account_id}",
                headers=self.headers,
            )
            if r.status_code == 404:
                return
            current = r.json()
            remaining = [s for s in current.get("subscriptions", []) if s.get("strategyId") != strategy_id]
            await client.put(
                f"{COPYFACTORY_BASE}/users/current/configuration/subscribers/{subscriber_meta_account_id}",
                json={"subscriptions": remaining},
                headers=self.headers,
            )

    async def get_subscriber_trades(self, subscriber_meta_account_id: str, strategy_id: str) -> list[dict]:
        if self._is_mock():
            return []
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{COPYFACTORY_BASE}/users/current/history-deals/subscriber/{subscriber_meta_account_id}",
                params={"strategyId": strategy_id},
                headers=self.headers,
            )
            if not r.is_success:
                return []
            return r.json()


copyfactory_service = CopyFactoryService()
