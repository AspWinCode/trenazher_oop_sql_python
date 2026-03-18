from celery import Celery

from judger.config import REDIS_URL

celery = Celery("judger", broker=REDIS_URL, backend=REDIS_URL)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="queue_python_io",
    task_queues={
        "queue_python_io": {},
        "queue_python_oop": {},
        "queue_python_numpy": {},
        "queue_sql": {},
        "queue_cpp": {},
        "queue_js": {},
    },
    imports=["judger.tasks"],
)
