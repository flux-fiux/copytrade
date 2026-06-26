from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "copytrade",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.leaderboard_tasks",
        "app.workers.risk_guard_tasks",
        "app.workers.ohlcv_tasks",
        "app.workers.settlement_tasks",
        "app.workers.mt4_sync_tasks",
        "app.workers.subscription_expiry_tasks",
        "app.workers.agent_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    # Heavy multi-agent analysis runs on a dedicated agent-worker (its own image
    # carries the tradingagents deps); the main worker never picks these up.
    task_routes={
        "app.workers.agent_tasks.*": {"queue": "agents"},
    },
    beat_schedule={
        # Leaderboard: full recalculate every hour, driven by workers/
        "leaderboard-hourly": {
            "task": "app.workers.leaderboard_tasks.recalculate_all",
            "schedule": crontab(minute=0),
        },
        # Risk guard backstop: poll every 5 min (CopyFactory native riskLimits is the
        # real-time primary; this catches slower / cross-day drawdown).
        "risk-guard": {
            "task": "app.workers.risk_guard_tasks.check_all_subscriptions",
            "schedule": crontab(minute="*/5"),
        },
        # OHLCV refresh: every hour at :05 (after leaderboard finishes at :00)
        "ohlcv-refresh": {
            "task": "app.workers.ohlcv_tasks.refresh_ohlcv",
            "schedule": crontab(minute=5),
        },
        # Monthly performance fee settlement: 1st of month, UTC 02:00
        "monthly-settlement": {
            "task": "app.workers.settlement_tasks.monthly_settlement",
            "schedule": crontab(day_of_month=1, hour=2, minute=0),
        },
        # MT4 account status + balance sync: every 5 minutes
        "mt4-sync": {
            "task": "app.workers.mt4_sync_tasks.sync_all_accounts",
            "schedule": crontab(minute="*/5"),
        },
        # Expire crypto subscriptions whose paid period elapsed: daily 01:00 UTC
        "subscription-expiry": {
            "task": "app.workers.subscription_expiry_tasks.expire_due_subscriptions",
            "schedule": crontab(hour=1, minute=0),
        },
    },
)
