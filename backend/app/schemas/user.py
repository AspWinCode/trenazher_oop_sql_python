from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.user import UserRole, UserStatus


class UserCreate(BaseModel):
    login: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(..., min_length=4, max_length=128)
    role: UserRole = UserRole.student


class UserUpdate(BaseModel):
    login: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None


class UserOut(BaseModel):
    id: int
    login: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResetPassword(BaseModel):
    new_password: str = Field(..., min_length=4, max_length=128)
