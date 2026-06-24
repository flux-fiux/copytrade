import json
import random
import time
import httpx
from app.core.config import settings

FINNHUB_BASE = "https://finnhub.io/api/v1"


class MarketDataService:
    def __init__(self):
        self.token = settings.FINNHUB_API_KEY
        self._redis = None

    @property
    def _headers(self):
        return {"X-Finnhub-Token": self.token}

    def set_redis(self, redis_client) -> None:
        self._redis = redis_client

    async def get_quote(self, symbol: str) -> dict:
        if not self.token:
            quote = self._mock_quote(symbol)
        else:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{FINNHUB_BASE}/quote", params={"symbol": symbol}, headers=self._headers)
                r.raise_for_status()
                quote = r.json()
        await self.publish_quote(symbol, quote)
        return quote

    async def publish_quote(self, symbol: str, quote: dict) -> None:
        if self._redis is None:
            return
        payload = json.dumps({"symbol": symbol, **quote})
        try:
            await self._redis.publish(f"market:{symbol.upper()}", payload)
        except Exception:
            pass

    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
        if not self.token:
            return self._mock_candles(symbol, from_ts, to_ts)
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{FINNHUB_BASE}/forex/candle",
                params={"symbol": f"OANDA:{symbol}", "resolution": resolution, "from": from_ts, "to": to_ts},
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json()

    async def search_symbols(self, query: str) -> list[dict]:
        if not self.token:
            return [
                {"symbol": "EURUSD", "description": "Euro / US Dollar"},
                {"symbol": "GBPUSD", "description": "British Pound / US Dollar"},
                {"symbol": "XAUUSD", "description": "Gold / US Dollar"},
            ]
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{FINNHUB_BASE}/search", params={"q": query}, headers=self._headers)
            r.raise_for_status()
            return r.json().get("result", [])[:10]

    async def get_news(self, symbol: str, limit: int = 10) -> list[dict]:
        if not self.token:
            return []
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{FINNHUB_BASE}/news", params={"category": "forex"}, headers=self._headers)
            r.raise_for_status()
            items = r.json()
            return items[:limit] if isinstance(items, list) else []

    def _mock_quote(self, symbol: str) -> dict:
        base = {"EURUSD": 1.08423, "GBPUSD": 1.26841, "XAUUSD": 2341.50, "BTCUSD": 67240.0,
                "USDJPY": 157.48, "USDCAD": 1.36124, "AUDUSD": 0.65481}.get(symbol, 1.0)
        c = round(base * (1 + random.uniform(-0.001, 0.001)), 5)
        return {"c": c, "h": round(c * 1.002, 5), "l": round(c * 0.998, 5),
                "o": round(base, 5), "pc": round(base, 5), "t": int(time.time())}

    def _mock_candles(self, symbol: str, from_ts: int, to_ts: int) -> dict:
        base = {"EURUSD": 1.0842, "GBPUSD": 1.2684, "XAUUSD": 2341.0}.get(symbol, 1.0)
        resolution_secs = 3600
        n = min(200, max(1, (to_ts - from_ts) // resolution_secs))
        ts, o_list, h_list, l_list, c_list, v_list = [], [], [], [], [], []
        price = base
        for i in range(n):
            o = price
            c = o * (1 + random.uniform(-0.002, 0.002))
            h = max(o, c) * (1 + random.uniform(0, 0.001))
            l = min(o, c) * (1 - random.uniform(0, 0.001))
            ts.append(from_ts + i * resolution_secs)
            o_list.append(round(o, 5)); h_list.append(round(h, 5))
            l_list.append(round(l, 5)); c_list.append(round(c, 5))
            v_list.append(random.randint(100, 1000))
            price = c
        return {"s": "ok", "t": ts, "o": o_list, "h": h_list, "l": l_list, "c": c_list, "v": v_list}


market_data_service = MarketDataService()
