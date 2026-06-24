import uuid
import stripe
from app.core.config import settings


def _dev_mode() -> bool:
    return not settings.STRIPE_SECRET_KEY


class StripeService:
    def __init__(self) -> None:
        if not _dev_mode():
            stripe.api_key = settings.STRIPE_SECRET_KEY

    async def create_customer(self, email: str, name: str) -> str:
        if _dev_mode():
            return f"cus_dev_{uuid.uuid4().hex[:12]}"
        customer = stripe.Customer.create(email=email, name=name)
        return customer.id

    async def create_connect_account(self, email: str) -> str:
        if _dev_mode():
            return f"acct_dev_{uuid.uuid4().hex[:12]}"
        account = stripe.Account.create(
            type="express",
            email=email,
            capabilities={"transfers": {"requested": True}},
        )
        return account.id

    async def create_connect_onboarding_link(self, account_id: str, return_url: str, refresh_url: str) -> str:
        if _dev_mode():
            return f"https://connect.stripe.com/setup/s/dev_mock_{account_id}"
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
        return link.url

    async def create_subscription(self, customer_id: str, stripe_price_id: str) -> dict:
        if _dev_mode():
            return {
                "subscription_id": f"sub_dev_{uuid.uuid4().hex[:12]}",
                "status": "active",
                "client_secret": None,
                "current_period_end": None,
            }
        sub = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": stripe_price_id}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"],
        )
        pi = sub.latest_invoice.payment_intent
        return {
            "subscription_id": sub.id,
            "status": sub.status,
            "client_secret": pi.client_secret if pi else None,
            "current_period_end": sub.current_period_end,
        }

    async def cancel_subscription(self, stripe_subscription_id: str) -> None:
        if _dev_mode():
            return
        stripe.Subscription.cancel(stripe_subscription_id)

    async def transfer_to_master(self, amount_cents: int, connect_account_id: str, description: str) -> str:
        if _dev_mode():
            return f"tr_dev_{uuid.uuid4().hex[:12]}"
        transfer = stripe.Transfer.create(
            amount=amount_cents,
            currency="usd",
            destination=connect_account_id,
            description=description,
        )
        return transfer.id

    async def create_price(self, master_id: str, amount_usd: float, interval: str = "month") -> str:
        if _dev_mode():
            return f"price_dev_{uuid.uuid4().hex[:12]}"
        amount_cents = int(amount_usd * 100)
        price = stripe.Price.create(
            unit_amount=amount_cents,
            currency="usd",
            recurring={"interval": interval},
            product_data={"name": f"Signal subscription - {master_id}"},
            metadata={"master_id": master_id},
        )
        return price.id


stripe_service = StripeService()
