from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.middleware.rate_limiter import check_login_rate
from app.models.user import User, UserStatus
from app.schemas.auth import LoginRequest, RefreshRequest, RefreshResponse, TokenResponse
from app.schemas.user import ChangePassword, UserOut
from app.services.auth_service import create_token_pair, decode_refresh_token, hash_password, verify_password
from app.services.guest_service import cleanup_stale_guests, create_guest_user, get_guest_config

router = APIRouter()


@router.post("/guest", response_model=TokenResponse)
async def guest_login(db: AsyncSession = Depends(get_db)):
    """Создаёт эфемерного гостя и выдаёт токены. Доступно только если
    администратор включил гостевой режим."""
    config = await get_guest_config(db)
    if not config["enabled"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Гостевой режим отключён")

    await cleanup_stale_guests(db)
    user = await create_guest_user(db)
    from app.services.activity_service import log_login

    try:
        await log_login(db, user.id)
    except Exception:
        pass
    access, refresh = create_token_pair(user.id, user.role.value)
    return TokenResponse(token=access, refresh_token=refresh, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db), _=Depends(check_login_rate)):
    result = await db.execute(
        select(User).where(or_(User.login == body.login, User.email == body.login))
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    access, refresh = create_token_pair(user.id, user.role.value)
    from app.services.activity_service import log_login

    await log_login(db, user.id)
    return TokenResponse(token=access, refresh_token=refresh, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_refresh_token(body.refresh_token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or blocked")
    access, refresh = create_token_pair(user.id, user.role.value)
    return RefreshResponse(token=access, refresh_token=refresh)


@router.post("/activity", status_code=status.HTTP_204_NO_CONTENT)
async def record_activity_ping(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Лёгкий пинг с фронта при открытии приложения — фиксирует сессию,
    если пользователь не был активен более 30 минут."""
    from app.services.activity_service import record_activity

    await record_activity(db, user.id)


@router.post("/change-password")
async def change_password(
    body: ChangePassword,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    user.password_hash = hash_password(body.new_password)
    await db.flush()
    return {"detail": "Пароль успешно изменён"}
