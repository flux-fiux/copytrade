from __future__ import annotations

import json
import random
import time
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings

FINNHUB_BASE = "https://finnhub.io/api/v1"
TWELVE_BASE = "https://api.twelvedata.com"

_MOCK_BASES: dict[str, float] = {
    "EURUSD": 1.08423, "GBPUSD": 1.26841, "XAUUSD": 2341.50, "BTCUSD": 67240.0,
    "USDJPY": 157.48, "USDCAD": 1.36124, "AUDUSD": 0.65481, "USDCHF": 0.91124,
    "NZDUSD": 0.60482, "EURGBP": 0.85521, "EURJPY": 170.42, "GBPJPY": 199.83,
    "US30": 39148.0, "NASDAQ": 17890.0, "USOIL": 78.45,
}

_TWELVE_RES_MAP = {
    "1": "1min", "5": "5min", "15": "15min", "30": "30min",
    "60": "1h", "240": "4h", "D": "1day", "W": "1week",
}


class MarketDataProvider(ABC):
    @abstractmethod
    async def get_quote(self, symbol: str) -> dict: ...

    @abstractmethod
    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict: ...

    async def search_symbols(self, query: str) -> list[dict]:
        return []

    async def get_news(self, symbol: str, limit: int = 10) -> list[dict]:
        return []

    async def get_economic_calendar(self, from_date: str, to_date: str) -> list[dict]:
        return []


class FinnhubProvider(MarketDataProvider):
    def __init__(self, api_key: str) -> None:
        self._key = api_key
        self._headers = {"X-Finnhub-Token": api_key}

    async def get_quote(self, symbol: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{FINNHUB_BASE}/quote", params={"symbol": symbol}, headers=self._headers)
            r.raise_for_status()
            data = r.json()
            if not data.get("c"):
                raise ValueError("empty quote")
            return data

    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{FINNHUB_BASE}/forex/candle",
                params={"symbol": f"OANDA:{symbol}", "resolution": resolution, "from": from_ts, "to": to_ts},
                headers=self._headers,
            )
            r.raise_for_status()
            data = r.json()
            if data.get("s") != "ok":
                raise ValueError("candles not ok")
            return data

    async def search_symbols(self, query: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{FINNHUB_BASE}/search", params={"q": query}, headers=self._headers)
            r.raise_for_status()
            return r.json().get("result", [])[:10]

    async def get_news(self, symbol: str, limit: int = 10) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{FINNHUB_BASE}/news", params={"category": "forex"}, headers=self._headers)
            r.raise_for_status()
            items = r.json()
            return items[:limit] if isinstance(items, list) else []

    async def get_economic_calendar(self, from_date: str, to_date: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{FINNHUB_BASE}/calendar/economic",
                params={"from": from_date, "to": to_date},
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json().get("economicCalendar", [])


class TwelveDataProvider(MarketDataProvider):
    def __init__(self, api_key: str) -> None:
        self._key = api_key

    async def get_quote(self, symbol: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{TWELVE_BASE}/quote",
                params={"symbol": symbol, "apikey": self._key},
            )
            r.raise_for_status()
            d = r.json()
            if d.get("status") == "error" or not d.get("close"):
                raise ValueError(d.get("message", "empty"))
            import calendar as _cal, datetime as _dt
            try:
                t = int(_cal.timegm(_dt.datetime.fromisoformat(str(d["datetime"])).timetuple()))
            except Exception:
                t = int(time.time())
            return {
                "c": float(d["close"]),
                "h": float(d["high"]),
                "l": float(d["low"]),
                "o": float(d["open"]),
                "pc": float(d["previous_close"]),
                "t": t,
            }

    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
        interval = _TWELVE_RES_MAP.get(str(resolution), "1h")
        outputsize = min(500, max(20, (to_ts - from_ts) // max(60, int(resolution) if str(resolution).isdigit() else 3600)))
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{TWELVE_BASE}/time_series",
                params={"symbol": symbol, "interval": interval, "outputsize": outputsize, "apikey": self._key},
            )
            r.raise_for_status()
            d = r.json()
            if d.get("status") == "error" or not d.get("values"):
                raise ValueError(d.get("message", "empty"))
            import calendar as _cal, datetime as _dt
            values = list(reversed(d["values"]))
            ts, o_l, h_l, l_l, c_l, v_l = [], [], [], [], [], []
            for bar in values:
                try:
                    t = int(_cal.timegm(_dt.datetime.fromisoformat(bar["datetime"]).timetuple()))
                except Exception:
                    continue
                ts.append(t)
                o_l.append(float(bar["open"]))
                h_l.append(float(bar["high"]))
                l_l.append(float(bar["low"]))
                c_l.append(float(bar["close"]))
                v_l.append(int(float(bar.get("volume") or 0)))
            return {"s": "ok", "t": ts, "o": o_l, "h": h_l, "l": l_l, "c": c_l, "v": v_l}


class MockProvider(MarketDataProvider):
    async def get_quote(self, symbol: str) -> dict:
        base = _MOCK_BASES.get(symbol, 1.0)
        c = round(base * (1 + random.uniform(-0.001, 0.001)), 5)
        return {"c": c, "h": round(c * 1.002, 5), "l": round(c * 0.998, 5),
                "o": round(base, 5), "pc": round(base, 5), "t": int(time.time())}

    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
        base = _MOCK_BASES.get(symbol, 1.0)
        res_secs = int(resolution) if str(resolution).isdigit() else 3600
        n = min(300, max(1, (to_ts - from_ts) // max(1, res_secs)))
        ts, o_l, h_l, l_l, c_l, v_l = [], [], [], [], [], []
        price = base
        vol = base * 0.002
        for i in range(n):
            o = price
            c = o + (random.random() - 0.48) * vol
            h = max(o, c) + random.random() * vol * 0.5
            l = min(o, c) - random.random() * vol * 0.5
            ts.append(from_ts + i * res_secs)
            o_l.append(round(o, 5)); h_l.append(round(h, 5))
            l_l.append(round(l, 5)); c_l.append(round(c, 5))
            v_l.append(random.randint(100, 1000))
            price = c
        return {"s": "ok", "t": ts, "o": o_l, "h": h_l, "l": l_l, "c": c_l, "v": v_l}

    async def search_symbols(self, query: str) -> list[dict]:
        candidates = [
            {"symbol": "EURUSD", "description": "Euro / US Dollar"},
            {"symbol": "GBPUSD", "description": "British Pound / US Dollar"},
            {"symbol": "USDJPY", "description": "US Dollar / Japanese Yen"},
            {"symbol": "XAUUSD", "description": "Gold / US Dollar"},
            {"symbol": "BTCUSD", "description": "Bitcoin / US Dollar"},
        ]
        q = query.upper()
        return [c for c in candidates if q in c["symbol"] or q in c["description"].upper()][:5]

    async def get_news(self, symbol: str, limit: int = 10) -> list[dict]:
        return []

    async def get_economic_calendar(self, from_date: str, to_date: str) -> list[dict]:
        import datetime
        today = datetime.date.today()
        return [
            {"country": "US", "event": "Non-Farm Payrolls", "impact": "high", "estimate": "180K", "actual": None, "previous": "175K", "time": f"{today}T12:30:00"},
            {"country": "US", "event": "CPI m/m", "impact": "high", "estimate": "0.3%", "actual": None, "previous": "0.4%", "time": f"{today}T12:30:00"},
            {"country": "EU", "event": "ECB Rate Decision", "impact": "high", "estimate": "4.50%", "actual": None, "previous": "4.50%", "time": f"{today + datetime.timedelta(days=1)}T11:45:00"},
            {"country": "UK", "event": "GDP q/q", "impact": "medium", "estimate": "0.2%", "actual": "0.1%", "previous": "0.1%", "time": f"{today + datetime.timedelta(days=1)}T06:00:00"},
            {"country": "JP", "event": "BoJ Rate Statement", "impact": "high", "estimate": None, "actual": None, "previous": "0.10%", "time": f"{today + datetime.timedelta(days=2)}T03:00:00"},
            {"country": "US", "event": "FOMC Minutes", "impact": "high", "estimate": None, "actual": None, "previous": None, "time": f"{today + datetime.timedelta(days=2)}T18:00:00"},
            {"country": "CA", "event": "Retail Sales m/m", "impact": "medium", "estimate": "0.3%", "actual": None, "previous": "-0.1%", "time": f"{today + datetime.timedelta(days=3)}T12:30:00"},
            {"country": "AU", "event": "RBA Rate Decision", "impact": "high", "estimate": "4.35%", "actual": None, "previous": "4.35%", "time": f"{today + datetime.timedelta(days=4)}T03:30:00"},
        ]


class MarketDataRouter:
    def __init__(self) -> None:
        self._providers: list[MarketDataProvider] = []
        self._redis = None

    def build(self) -> None:
        self._providers.clear()
        if settings.FINNHUB_API_KEY:
            self._providers.append(FinnhubProvider(settings.FINNHUB_API_KEY))
        if settings.TWELVE_DATA_API_KEY:
            self._providers.append(TwelveDataProvider(settings.TWELVE_DATA_API_KEY))
        self._providers.append(MockProvider())

    def set_redis(self, redis_client) -> None:
        self._redis = redis_client

    async def publish_quote(self, symbol: str, quote: dict) -> None:
        if self._redis is None:
            return
        payload = json.dumps({"symbol": symbol, **quote})
        try:
            await self._redis.publish(f"market:{symbol.upper()}", payload)
        except Exception:
            pass

    async def get_quote(self, symbol: str) -> dict:
        for p in self._providers:
            try:
                q = await p.get_quote(symbol)
                await self.publish_quote(symbol, q)
                return q
            except Exception:
                continue
        raise RuntimeError("All providers failed for get_quote")

    async def get_candles(self, symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
        for p in self._providers:
            try:
                return await p.get_candles(symbol, resolution, from_ts, to_ts)
            except Exception:
                continue
        raise RuntimeError("All providers failed for get_candles")

    async def search_symbols(self, query: str) -> list[dict]:
        for p in self._providers:
            try:
                result = await p.search_symbols(query)
                if result:
                    return result
            except Exception:
                continue
        return []

    async def get_news(self, symbol: str, limit: int = 10) -> list[dict]:
        for p in self._providers:
            try:
                result = await p.get_news(symbol, limit)
                if result:
                    return result
            except Exception:
                continue
        return []

    async def get_economic_calendar(self, from_date: str, to_date: str) -> list[dict]:
        for p in self._providers:
            try:
                result = await p.get_economic_calendar(from_date, to_date)
                if result:
                    return result
            except Exception:
                continue
        return []


market_data_service = MarketDataRouter()
market_data_service.build()
