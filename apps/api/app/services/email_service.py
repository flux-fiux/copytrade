from typing import Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.core.config import settings

TEMPLATES = {
    "welcome": {
        "subject": "Welcome to CopyTrade — Start copying the best traders",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0f0f0f;color:#e5e5e5">
  <div style="text-align:center;margin-bottom:32px">
    <div style="display:inline-block;background:#3b82f6;border-radius:12px;padding:12px 20px">
      <span style="color:white;font-size:20px;font-weight:bold">CopyTrade</span>
    </div>
  </div>
  <h1 style="font-size:24px;margin-bottom:16px">Welcome, {name}!</h1>
  <p style="color:#a1a1aa;line-height:1.6">Your account is ready. Start by browsing the leaderboard to find top-performing signal providers.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="{frontend_url}/leaderboard" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Browse Leaderboard</a>
  </div>
  <hr style="border:1px solid #27272a;margin:32px 0">
  <p style="color:#71717a;font-size:12px;text-align:center">CopyTrade &bull; <a href="{frontend_url}/unsubscribe" style="color:#71717a">Unsubscribe</a></p>
</div>""",
    },
    "subscription_confirmed": {
        "subject": "Subscription confirmed — You're now copying {master_name}",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0f0f0f;color:#e5e5e5">
  <h1 style="font-size:22px">Subscription Confirmed</h1>
  <p style="color:#a1a1aa">You are now copying <strong style="color:#e5e5e5">{master_name}</strong> at <strong style="color:#3b82f6">${price_usd}/month</strong>.</p>
  <div style="background:#18181b;border-radius:12px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px;color:#71717a;font-size:13px">LOT MULTIPLIER</p>
    <p style="margin:0;font-size:20px;font-weight:bold">{lot_multiplier}x</p>
    <p style="margin:8px 0 0;color:#71717a;font-size:13px">Max Drawdown Limit: {max_drawdown}%</p>
  </div>
  <p style="color:#a1a1aa">All trades will be automatically copied to your account.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="{frontend_url}/dashboard/subscriptions" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Manage Subscriptions</a>
  </div>
</div>""",
    },
    "drawdown_alert": {
        "subject": "Drawdown Alert — {master_name} subscription paused",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0f0f0f;color:#e5e5e5">
  <div style="background:#7f1d1d;border-radius:12px;padding:16px 20px;margin-bottom:24px">
    <h1 style="font-size:18px;margin:0;color:#fca5a5">Drawdown Limit Reached</h1>
  </div>
  <p style="color:#a1a1aa">Your copy trading subscription for <strong style="color:#e5e5e5">{master_name}</strong> has been automatically paused.</p>
  <div style="background:#18181b;border-radius:12px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px;color:#71717a">Current Drawdown: <strong style="color:#f87171">{current_drawdown}%</strong></p>
    <p style="margin:0;color:#71717a">Your Limit: <strong style="color:#e5e5e5">{max_drawdown}%</strong></p>
  </div>
  <p style="color:#a1a1aa">No new trades will be copied until you manually resume.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="{frontend_url}/dashboard/subscriptions" style="background:#ef4444;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Review and Resume</a>
  </div>
</div>""",
    },
    "master_approved": {
        "subject": "Congratulations — You're now a Master Signal Provider",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0f0f0f;color:#e5e5e5">
  <h1 style="font-size:22px">You're Approved as a Master!</h1>
  <p style="color:#a1a1aa">Your application to become a Master Signal Provider has been approved. You can now set your subscription plan and start accepting followers.</p>
  <div style="background:#18181b;border-radius:12px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px;color:#3b82f6;font-weight:600">Next steps:</p>
    <ol style="margin:0;padding-left:20px;color:#a1a1aa;line-height:1.8">
      <li>Set up your Stripe Connect account to receive payments</li>
      <li>Configure your subscription plan price</li>
      <li>Your performance will appear on the leaderboard</li>
    </ol>
  </div>
  <div style="text-align:center;margin:32px 0">
    <a href="{frontend_url}/dashboard" style="background:#22c55e;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard</a>
  </div>
</div>""",
    },
    "master_rejected": {
        "subject": "Master application status update",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0f0f0f;color:#e5e5e5">
  <h1 style="font-size:22px">Application Update</h1>
  <p style="color:#a1a1aa">After review, your Master Signal Provider application has not been approved at this time.</p>
  <div style="background:#18181b;border-radius:12px;padding:20px;margin:24px 0">
    <p style="margin:0;color:#71717a"><strong style="color:#e5e5e5">Reason:</strong> {reason}</p>
  </div>
  <p style="color:#a1a1aa">You may reapply after addressing the feedback above.</p>
</div>""",
    },
    "new_follower": {
        "subject": "New follower — {follower_name} is now copying your trades",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#0f0f0f;color:#e5e5e5">
  <h1 style="font-size:22px">You Have a New Follower!</h1>
  <p style="color:#a1a1aa"><strong style="color:#e5e5e5">{follower_name}</strong> just subscribed and is now copying your trades at ${price_usd}/month.</p>
  <div style="background:#18181b;border-radius:12px;padding:20px;margin:24px 0">
    <p style="color:#71717a;margin:0 0 4px;font-size:13px">YOUR TOTAL FOLLOWERS</p>
    <p style="font-size:32px;font-weight:bold;margin:0">{total_followers}</p>
  </div>
  <div style="text-align:center;margin:32px 0">
    <a href="{frontend_url}/dashboard" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">View Dashboard</a>
  </div>
</div>""",
    },
}


class EmailService:
    def __init__(self):
        self._client: Optional[SendGridAPIClient] = None

    def _get_client(self) -> Optional[SendGridAPIClient]:
        if not settings.SENDGRID_API_KEY:
            return None
        if not self._client:
            self._client = SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        return self._client

    def _render(self, template_key: str, **kwargs) -> tuple[str, str]:
        tmpl = TEMPLATES[template_key]
        kwargs.setdefault("frontend_url", settings.FRONTEND_URL)
        subject = tmpl["subject"].format(**kwargs)
        html = tmpl["html"].format(**kwargs)
        return subject, html

    async def send(self, to_email: str, template_key: str, **kwargs) -> bool:
        if not to_email:
            return False
        subject, html = self._render(template_key, **kwargs)
        client = self._get_client()
        if not client:
            print(f"[EmailService MOCK] To: {to_email} | Subject: {subject}")
            return True
        try:
            message = Mail(
                from_email=(settings.FROM_EMAIL, settings.FROM_NAME),
                to_emails=to_email,
                subject=subject,
                html_content=html,
            )
            response = client.send(message)
            return response.status_code in (200, 202)
        except Exception as e:
            print(f"[EmailService] Failed to send to {to_email}: {e}")
            return False

    async def send_welcome(self, to_email: str, name: str) -> bool:
        return await self.send(to_email, "welcome", name=name)

    async def send_subscription_confirmed(
        self, to_email: str, master_name: str, price_usd: float,
        lot_multiplier: float, max_drawdown: float
    ) -> bool:
        return await self.send(
            to_email, "subscription_confirmed",
            master_name=master_name, price_usd=f"{price_usd:.2f}",
            lot_multiplier=lot_multiplier, max_drawdown=max_drawdown,
        )

    async def send_drawdown_alert(
        self, to_email: str, master_name: str,
        current_drawdown: float, max_drawdown: float
    ) -> bool:
        return await self.send(
            to_email, "drawdown_alert",
            master_name=master_name,
            current_drawdown=f"{current_drawdown:.1f}",
            max_drawdown=f"{max_drawdown:.1f}",
        )

    async def send_master_approved(self, to_email: str) -> bool:
        return await self.send(to_email, "master_approved")

    async def send_master_rejected(self, to_email: str, reason: str) -> bool:
        return await self.send(to_email, "master_rejected", reason=reason)

    async def send_new_follower(
        self, to_email: str, follower_name: str,
        price_usd: float, total_followers: int
    ) -> bool:
        return await self.send(
            to_email, "new_follower",
            follower_name=follower_name,
            price_usd=f"{price_usd:.2f}",
            total_followers=total_followers,
        )


email_service = EmailService()
