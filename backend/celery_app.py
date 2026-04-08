from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

celery = Celery(
    "lsrv",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "daily-reconciliation": {
            "task": "billing.daily_reconciliation",
            "schedule": crontab(hour=2, minute=0),  # 2:00 AM UTC daily
        },
        "daily-subscription-invoices": {
            "task": "billing.process_subscription_invoices",
            "schedule": crontab(hour=6, minute=0),  # 6:00 AM UTC daily
        },
        "daily-overdue-detection": {
            "task": "billing.mark_overdue_invoices",
            "schedule": crontab(hour=7, minute=0),  # 7:00 AM UTC daily
        },
    },
)

# Auto-discover tasks in the tasks/ directory
celery.autodiscover_tasks(["tasks"])
