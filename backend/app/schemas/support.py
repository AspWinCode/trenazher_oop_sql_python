from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SupportMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)


class SupportMessageOut(BaseModel):
    id: int
    sender: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SupportThreadOut(BaseModel):
    """История треда для студента."""

    id: int
    status: str
    unread_for_student: bool
    messages: List[SupportMessageOut] = []

    model_config = {"from_attributes": True}


class AdminSupportThreadOut(BaseModel):
    """Строка списка тредов в админ-инбоксе."""

    id: int
    user_id: int
    user_login: str
    user_full_name: Optional[str] = None
    status: str
    unread_for_admin: bool
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None

    model_config = {"from_attributes": True}


class AdminSupportThreadDetailOut(BaseModel):
    id: int
    user_id: int
    user_login: str
    user_full_name: Optional[str] = None
    status: str
    messages: List[SupportMessageOut] = []

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    unread: int
