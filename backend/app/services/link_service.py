from __future__ import annotations

import hashlib
import hmac
import time

from app.config import settings


def generate_token(task_id: int, user_id: int) -> str:
    raw = f"{task_id}:{user_id}:{time.time()}"
    sig = hmac.HMAC(settings.SECRET_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest()[:32]
    return sig
