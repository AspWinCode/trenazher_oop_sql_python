"""Platform settings endpoints – logo upload, etc."""
from __future__ import annotations

import base64
import uuid

from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user, require_admin
from app.models.platform_settings import PlatformSetting
from app.models.user import User
from app.services.guest_service import get_guest_config, set_guest_config

router = APIRouter()


class GuestConfigIn(BaseModel):
    enabled: bool = False
    task_limit: int = Field(default=3, ge=0, le=1000)
    course_ids: List[int] = []


class GuestConfigOut(BaseModel):
    enabled: bool
    task_limit: int
    course_ids: List[int]


@router.get("/settings/guest", response_model=GuestConfigOut)
async def get_guest_settings(db: AsyncSession = Depends(get_db)):
    """Публичный — нужен странице логина и фронту для блокировок."""
    return GuestConfigOut(**await get_guest_config(db))


@router.put("/settings/guest", response_model=GuestConfigOut)
async def update_guest_settings(
    body: GuestConfigIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    config = await set_guest_config(
        db,
        enabled=body.enabled,
        task_limit=body.task_limit,
        course_ids=body.course_ids,
    )
    return GuestConfigOut(**config)

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB


@router.get("/settings/logo")
async def get_logo(db: AsyncSession = Depends(get_db)):
    """Public – returns {url: "data:image/..."} or {url: null}."""
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == "logo")
    )
    row = result.scalar_one_or_none()
    return {"url": row.value if row and row.value else None}


@router.post("/settings/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Admin-only – upload a logo image. Stored as base64 data-URI."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Недопустимый тип файла: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 2 МБ)")

    b64 = base64.b64encode(data).decode()
    data_uri = f"data:{file.content_type};base64,{b64}"

    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == "logo")
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = data_uri
    else:
        db.add(PlatformSetting(key="logo", value=data_uri))

    await db.commit()
    return {"url": data_uri}


@router.delete("/settings/logo")
async def delete_logo(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Admin-only – remove logo."""
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == "logo")
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = ""
        await db.commit()
    return {"url": None}
