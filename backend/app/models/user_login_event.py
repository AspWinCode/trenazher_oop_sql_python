"""Лог входов/сессий пользователя — основа метрик активной аудитории и вовлечённости."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Типы событий
EVENT_LOGIN = "login"
EVENT_SESSION_START = "session_start"


class UserLoginEvent(Base):
    __tablename__ = "user_login_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(32), default=EVENT_LOGIN)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
