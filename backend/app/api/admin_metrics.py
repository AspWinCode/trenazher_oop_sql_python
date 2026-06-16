"""Админ-дашборд: базовые метрики платформы (Фаза 1)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.user import User
from app.services.metrics_service import get_platform_metrics

router = APIRouter()

_CACHE_KEY = "admin:metrics:overview"
_CACHE_TTL = 45  # секунд — near-real-time без нагрузки на БД


@router.get("/admin/metrics")
async def admin_metrics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.cache_service import cache_get, cache_set

    cached = cache_get(_CACHE_KEY)
    if cached is not None:
        return cached

    data = await get_platform_metrics(db)
    cache_set(_CACHE_KEY, data, ttl=_CACHE_TTL)
    return data
