import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)
COPYFACTORY_BASE = "https://copyfactory-api-v1.new-york.agiliumtrade.ai"


class CopyFactoryService:
    def __init__(self) -> None:
        self.token = settings.METAAPI_TOKEN
        self.headers = {"auth-token": self.token, "Content-Type": "application/json"}
        self._client: httpx.AsyncClient | None = None

    def _is_mock(self) -> bool:
        return not self.token

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30, headers=self.headers)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def create_strategy(self, strategy_id: str, master_meta_account_id: str, name: str) -> dict:
        if self._is_mock():
            return {"id": strategy_id, "mock": True}
        # Minimal payload — CopyFactory rejects extra/invalid fields like
        # positionLifecycle / maxTradeRisk with a 400 ValidationError.
        r = await self._get_client().put(
            f"{COPYFACTORY_BASE}/users/current/configuration/strategies/{strategy_id}",
            json={
                "name": name,
                "description": name,
                "accountId": master_meta_account_id,
            },
        )
        r.raise_for_status()
        # CopyFactory returns 204 No Content on success — don't parse a body.
        return {"id": strategy_id}

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
        }
        if allowed_symbols:
            subscription_config["symbolFilter"] = {"included": allowed_symbols}

        client = self._get_client()
        url = f"{COPYFACTORY_BASE}/users/current/configuration/subscribers/{subscriber_meta_account_id}"

        # The subscriber PUT is a FULL REPLACE. A follower account may follow several
        # masters, so read-modify-write: keep existing subscriptions, drop any stale
        # entry for this strategy, then append — otherwise following a 2nd master
        # silently wipes the 1st.
        existing: list[dict] = []
        g = await client.get(url)
        if g.status_code == 200:
            existing = [s for s in g.json().get("subscriptions", []) if s.get("strategyId") != strategy_id]

        # Native CopyFactory stop-out: when the follower's daily loss reaches
        # max_drawdown_pct of balance, CopyFactory halts copying AND closes open
        # positions in real time (far better than the 5-min polling backstop).
        risk_limits = [{
            "type": "day",
            "applyTo": "balance-difference",
            "maxRelativeRisk": round(max_drawdown_pct / 100, 4),
            "closePositions": True,
        }]

        def _body(with_risk: bool) -> dict:
            cfg = {**subscription_config, **({"riskLimits": risk_limits} if with_risk else {})}
            return {"name": "subscriber", "subscriptions": existing + [cfg]}

        risk_native = True
        r = await client.put(url, json=_body(True))
        if r.status_code == 400:
            # Don't block the subscription on risk-config shape — but this is NOT
            # silent: log loudly so ops know the native real-time stop-out is OFF and
            # only the 5-min polling backstop guards this follower.
            risk_native = False
            logger.error(
                "[CopyFactory] native riskLimits REJECTED for %s — copying will run "
                "WITHOUT real-time stop-out (polling backstop only): %s",
                subscriber_meta_account_id, r.text[:160],
            )
            r = await client.put(url, json=_body(False))
        r.raise_for_status()
        return {"subscriberAccountId": subscriber_meta_account_id, "risk_native": risk_native}

    async def remove_subscriber_strategy(self, subscriber_meta_account_id: str, strategy_id: str) -> None:
        if self._is_mock():
            return
        client = self._get_client()
        r = await client.get(
            f"{COPYFACTORY_BASE}/users/current/configuration/subscribers/{subscriber_meta_account_id}",
        )
        if r.status_code == 404:
            return
        current = r.json()
        remaining = [s for s in current.get("subscriptions", []) if s.get("strategyId") != strategy_id]
        await client.put(
            f"{COPYFACTORY_BASE}/users/current/configuration/subscribers/{subscriber_meta_account_id}",
            json={"subscriptions": remaining},
        )

    async def get_subscriber_trades(self, subscriber_meta_account_id: str, strategy_id: str) -> list[dict]:
        if self._is_mock():
            return []
        r = await self._get_client().get(
            f"{COPYFACTORY_BASE}/users/current/history-deals/subscriber/{subscriber_meta_account_id}",
            params={"strategyId": strategy_id},
        )
        if not r.is_success:
            return []
        return r.json()


copyfactory_service = CopyFactoryService()
