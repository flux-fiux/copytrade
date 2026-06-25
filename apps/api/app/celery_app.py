from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "copytrade",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.leaderboard"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # 每小时增量更新排行榜（快速）
        "leaderboard-hourly": {
            "task": "app.tasks.leaderboard.recalculate_leaderboard",
            "schedule": crontab(minute=0),
            "args": (False,),
        },
        # 每天 UTC 00:05 全量重算（完整）
        "leaderboard-daily-full": {
            "task": "app.tasks.leaderboard.recalculate_leaderboard",
            "schedule": crontab(hour=0, minute=5),
            "args": (True,),
        },
    },
)
