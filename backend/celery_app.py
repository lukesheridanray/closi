from celery import Celery
from app.config import get_settings

settings = get_settings()

celery = Celery(
    "closi",
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
)

# Auto-discover tasks in the tasks/ directory
celery.autodiscover_tasks(["tasks"])
