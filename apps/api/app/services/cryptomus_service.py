"""CryptoMus payment service — crypto subscription payments."""
import hashlib
import base64
import json
import uuid
from typing import Optional
import httpx
from app.core.config import settings

CRYPTOMUS_BASE = "https://api.cryptomus.com/v1"


class CryptomusService:
    def _sign(self, body: dict) -> str:
        body_str = json.dumps(body) if body else "{}"
        b64 = base64.b64encode(body_str.encode()).decode()
        return hashlib.md5((b64 + settings.CRYPTOMUS_API_KEY).encode()).hexdigest()

    def _is_mock(self) -> bool:
        return not settings.CRYPTOMUS_API_KEY or not settings.CRYPTOMUS_MERCHANT_UUID

    async def create_payment(
        self,
        amount: float,
        currency: str = "USDT",
        network: str = "TRON",
        order_id: str = "",
        description: str = "CopyTrade Subscription",
        callback_url: str = "",
        success_url: str = "",
    ) -> dict:
        if self._is_mock():
            mock_id = f"mock-{uuid.uuid4().hex[:8]}"
            return {
                "uuid": mock_id,
                "order_id": order_id,
                "amount": str(amount),
                "currency": currency,
                "network": network,
                "address": "TXxxxxxxMockAddressxxxxxxxxxxxxxxxxx",
                "url": f"https://pay.cryptomus.com/pay/{mock_id}",
                "status": "check",
                "is_mock": True,
            }

        body = {
            "amount": str(amount),
            "currency": currency,
            "network": network,
            "order_id": order_id or uuid.uuid4().hex,
            "merchant_id": settings.CRYPTOMUS_MERCHANT_UUID,
            "url_return": success_url,
            "url_callback": callback_url,
            "is_payment_multiple": False,
            "lifetime": 3600,
            "to_currency": "USDT",
        }
        headers = {
            "merchant": settings.CRYPTOMUS_MERCHANT_UUID,
            "sign": self._sign(body),
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{CRYPTOMUS_BASE}/payment", headers=headers, json=body)
            data = resp.json()

        if "result" not in data:
            raise ValueError(f"CryptoMus error: {data.get('message', 'Unknown error')}")
        return data["result"]

    async def get_payment_status(self, payment_uuid: str) -> dict:
        if self._is_mock():
            return {"uuid": payment_uuid, "status": "paid", "is_mock": True}

        body = {"uuid": payment_uuid}
        headers = {
            "merchant": settings.CRYPTOMUS_MERCHANT_UUID,
            "sign": self._sign(body),
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{CRYPTOMUS_BASE}/payment/info", headers=headers, json=body)
            data = resp.json()
        return data.get("result", {})

    def verify_webhook(self, payload: dict) -> bool:
        received_sign = payload.pop("sign", "")
        body_str = json.dumps(payload, separators=(",", ":"))
        b64 = base64.b64encode(body_str.encode()).decode()
        expected = hashlib.md5((b64 + settings.CRYPTOMUS_API_KEY).encode()).hexdigest()
        return received_sign == expected

    async def create_recurring_payment(
        self,
        amount: float,
        period: str = "monthly",
        order_id: str = "",
        callback_url: str = "",
    ) -> dict:
        if self._is_mock():
            mock_id = f"mock-recur-{uuid.uuid4().hex[:8]}"
            return {
                "uuid": mock_id,
                "url": f"https://pay.cryptomus.com/recurring/{mock_id}",
                "status": "wait_accept",
                "is_mock": True,
            }

        body = {
            "amount": str(amount),
            "currency": "USDT",
            "name": "CopyTrade Subscription",
            "period": period,
            "order_id": order_id or uuid.uuid4().hex,
            "url_callback": callback_url,
        }
        headers = {
            "merchant": settings.CRYPTOMUS_MERCHANT_UUID,
            "sign": self._sign(body),
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{CRYPTOMUS_BASE}/recurrence/create", headers=headers, json=body)
            data = resp.json()
        return data.get("result", {})


cryptomus_service = CryptomusService()
