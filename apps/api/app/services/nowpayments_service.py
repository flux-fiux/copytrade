"""NOWPayments crypto payment service — non-custodial, low-fee, high-risk friendly.

Mirrors the cryptomus_service interface so the payments router swaps cleanly.
Degrades to a mock invoice when no API key is configured (keeps the app usable
before credentials are set).
"""
import json
import hmac
import hashlib
import uuid as _uuid

import httpx

from app.core.config import settings

NOWPAYMENTS_BASE = "https://api.nowpayments.io/v1"
# Map our network names → NOWPayments pay_currency codes (USDT on each chain).
_USDT_BY_NETWORK = {
    "TRON": "usdttrc20", "TRC20": "usdttrc20",
    "ETH": "usdterc20", "ERC20": "usdterc20",
    "BSC": "usdtbsc", "BEP20": "usdtbsc",
    "SOL": "usdtsol", "POLYGON": "usdtmatic",
}


class NowPaymentsService:
    def _is_mock(self) -> bool:
        return not settings.NOWPAYMENTS_API_KEY

    async def create_payment(
        self,
        amount: float,
        currency: str = "USDT",
        network: str = "TRON",
        order_id: str = "",
        description: str = "ArbMind Subscription",
        callback_url: str = "",
        success_url: str = "",
    ) -> dict:
        if self._is_mock():
            mock_id = f"mock-{_uuid.uuid4().hex[:10]}"
            return {"uuid": mock_id, "url": f"https://nowpayments.io/payment/?iid={mock_id}", "address": None}

        body = {
            "price_amount": amount,
            "price_currency": "usd",
            "order_id": order_id,
            "order_description": description,
            "ipn_callback_url": callback_url,
            "success_url": success_url,
            "cancel_url": success_url,
        }
        pay_currency = _USDT_BY_NETWORK.get(network.upper())
        if pay_currency:
            body["pay_currency"] = pay_currency

        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                f"{NOWPAYMENTS_BASE}/invoice",
                headers={"x-api-key": settings.NOWPAYMENTS_API_KEY, "Content-Type": "application/json"},
                json=body,
            )
        if r.status_code not in (200, 201):
            raise ValueError(f"NOWPayments error: {r.text[:200]}")
        d = r.json()
        return {"uuid": str(d.get("id")), "url": d.get("invoice_url"), "address": None}

    def verify_webhook(self, body: dict, signature: str) -> bool:
        """IPN signature = HMAC-SHA512 of the JSON body with keys sorted, using the IPN secret."""
        if not settings.NOWPAYMENTS_IPN_SECRET or not signature:
            return False
        sorted_body = json.dumps(body, sort_keys=True, separators=(",", ":"))
        expected = hmac.new(
            settings.NOWPAYMENTS_IPN_SECRET.encode(), sorted_body.encode(), hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def get_payment_status(self, payment_id: str) -> dict:
        if self._is_mock():
            return {"payment_status": "waiting"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{NOWPAYMENTS_BASE}/payment/{payment_id}",
                headers={"x-api-key": settings.NOWPAYMENTS_API_KEY},
            )
        return r.json() if r.status_code == 200 else {"error": r.text[:160]}


nowpayments_service = NowPaymentsService()
