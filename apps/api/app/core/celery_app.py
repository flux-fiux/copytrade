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
    ],
)

celery_app.conf.beat_schedule = {
    "recalculate-leaderboard-hourly": {
        "task": "app.workers.leaderboard_tasks.recalculate_all",
        "schedule": crontab(minute=0),
    },
    "risk-guard-check": {
        "task": "app.workers.risk_guard_tasks.check_all_subscriptions",
        "schedule": crontab(minute="*/15"),
    },
    "ohlcv-refresh": {
        "task": "app.workers.ohlcv_tasks.refresh_ohlcv",
        "schedule": crontab(minute="0"),
    },
}
celery_app.conf.timezone = "UTC"
