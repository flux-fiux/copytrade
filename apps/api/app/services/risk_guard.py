import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.signal_subscription import SignalSubscription
from app.models.mt4_account import MT4Account
from app.models.user import User
from app.services.copyfactory import copyfactory_service
from app.services.metaapi import metaapi_service


class RiskGuard:
    async def check_subscription(self, subscription: SignalSubscription, session: AsyncSession) -> dict:
        if not subscription.max_drawdown_pct:
            return {"breached": False, "current_drawdown": 0.0, "limit": None, "action": "none"}

        result = await session.execute(
            select(MT4Account).where(MT4Account.id == subscription.follower_account_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            return {
                "breached": False,
                "current_drawdown": 0.0,
                "limit": float(subscription.max_drawdown_pct),
                "action": "account_not_found",
            }

        try:
            info = await metaapi_service.get_account_information(account.meta_api_account_id)
            current_equity = float(info.get("equity", account.equity or 0))
            balance = float(info.get("balance", account.balance or current_equity))
        except Exception:
            current_equity = float(account.equity or 0)
            balance = float(account.balance or current_equity)

        if balance <= 0:
            return {
                "breached": False,
                "current_drawdown": 0.0,
                "limit": float(subscription.max_drawdown_pct),
                "action": "no_balance",
            }

        drawdown_pct = max(0.0, (balance - current_equity) / balance * 100)
        limit = float(subscription.max_drawdown_pct)

        if drawdown_pct >= limit and subscription.status == "ACTIVE":
            return {
                "breached": True,
                "current_drawdown": round(drawdown_pct, 2),
                "limit": limit,
                "action": "pause_required",
                "account_id": str(account.id),
                "meta_api_account_id": account.meta_api_account_id,
            }

        return {
            "breached": False,
            "current_drawdown": round(drawdown_pct, 2),
            "limit": limit,
            "action": "ok" if subscription.status == "ACTIVE" else subscription.status.lower(),
        }

    async def pause_subscription(
        self, subscription: SignalSubscription, reason: str, session: AsyncSession
    ) -> None:
        master_result = await session.execute(
            select(MT4Account).where(
                MT4Account.user_id == subscription.master_id,
                MT4Account.account_type == "MASTER",
            )
        )
        master_account = master_result.scalar_one_or_none()

        follower_result = await session.execute(
            select(MT4Account).where(MT4Account.id == subscription.follower_account_id)
        )
        follower_account = follower_result.scalar_one_or_none()

        if master_account and follower_account and master_account.copy_factory_strategy_id:
            try:
                await copyfactory_service.remove_subscriber_strategy(
                    follower_account.meta_api_account_id,
                    master_account.copy_factory_strategy_id,
                )
            except Exception as e:
                print(f"[RiskGuard] CopyFactory pause failed: {e}")

        subscription.status = "PAUSED"
        subscription.pause_reason = reason
        subscription.paused_at = datetime.now(timezone.utc)
        await session.commit()
        print(f"[RiskGuard] Paused subscription {subscription.id}: {reason}")

        # Parse drawdown values from reason string for email
        try:
            current_dd = float(reason.split("current: ")[-1].rstrip("%)")) if "current: " in reason else 0.0
            max_dd = float(reason.split("Max drawdown ")[-1].split("%")[0]) if "Max drawdown " in reason else float(subscription.max_drawdown_pct or 20)
        except Exception:
            current_dd, max_dd = 0.0, float(subscription.max_drawdown_pct or 20)

        # Get master name for email
        master_name = "Master"
        if master_account:
            master_user_result = await session.execute(select(User).where(User.id == master_account.user_id))
            master_user = master_user_result.scalar_one_or_none()
            if master_user:
                master_name = master_user.display_name or master_user.username or "Master"

        # Get follower email
        follower_result = await session.execute(select(User).where(User.id == subscription.follower_id))
        follower = follower_result.scalar_one_or_none()
        if follower:
            from app.services.email_service import email_service
            asyncio.create_task(email_service.send_drawdown_alert(
                to_email=follower.email,
                master_name=master_name,
                current_drawdown=current_dd,
                max_drawdown=max_dd,
            ))

    async def resume_subscription(self, subscription_id: uuid.UUID, session: AsyncSession) -> bool:
        result = await session.execute(
            select(SignalSubscription).where(SignalSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        if not subscription or subscription.status != "PAUSED":
            return False

        master_result = await session.execute(
            select(MT4Account).where(
                MT4Account.user_id == subscription.master_id,
                MT4Account.account_type == "MASTER",
            )
        )
        master_account = master_result.scalar_one_or_none()

        follower_result = await session.execute(
            select(MT4Account).where(MT4Account.id == subscription.follower_account_id)
        )
        follower_account = follower_result.scalar_one_or_none()

        if master_account and follower_account and master_account.copy_factory_strategy_id:
            try:
                await copyfactory_service.create_subscriber(
                    follower_account.meta_api_account_id,
                    master_account.copy_factory_strategy_id,
                    lot_multiplier=float(subscription.lot_multiplier or 1.0),
                    max_drawdown_pct=float(subscription.max_drawdown_pct or 20.0),
                )
            except Exception as e:
                print(f"[RiskGuard] CopyFactory resume failed: {e}")

        subscription.status = "ACTIVE"
        subscription.pause_reason = None
        await session.commit()
        return True


risk_guard = RiskGuard()
