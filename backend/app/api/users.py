from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.course import Course
from app.models.user import User
from app.models.user_course_enrollment import UserCourseEnrollment
from app.schemas.user import ResetPassword, UserCreate, UserOut, UserUpdate
from app.services.auth_service import hash_password

router = APIRouter()


class EnrollmentOut(BaseModel):
    course_id: int
    course_title: str

    model_config = {"from_attributes": True}


@router.get("", response_model=List[UserOut])
async def list_users(offset: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    limit = min(limit, 200)
    result = await db.execute(select(User).order_by(User.id).offset(offset).limit(limit))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    existing = await db.execute(select(User).where(User.login == body.login))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Login already exists")
    user = User(login=body.login, password_hash=hash_password(body.password), role=body.role)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)


@router.post("/{user_id}/reset-password", response_model=UserOut)
async def reset_password(user_id: int, body: ResetPassword, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


# --- Course Enrollments ---

@router.get("/{user_id}/enrollments", response_model=List[EnrollmentOut])
async def list_enrollments(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(UserCourseEnrollment, Course)
        .join(Course, Course.id == UserCourseEnrollment.course_id)
        .where(UserCourseEnrollment.user_id == user_id)
        .order_by(Course.title)
    )
    return [EnrollmentOut(course_id=row.Course.id, course_title=row.Course.title) for row in result.all()]


@router.post("/{user_id}/enrollments/{course_id}", status_code=status.HTTP_201_CREATED)
async def enroll_user(user_id: int, course_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    # Проверяем что пользователь и курс существуют
    user_r = await db.execute(select(User).where(User.id == user_id))
    if not user_r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    course_r = await db.execute(select(Course).where(Course.id == course_id))
    if not course_r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")
    # Проверяем что зачисление не дублируется
    existing = await db.execute(
        select(UserCourseEnrollment).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.course_id == course_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"detail": "Already enrolled"}
    enrollment = UserCourseEnrollment(user_id=user_id, course_id=course_id)
    db.add(enrollment)
    await db.flush()
    return {"detail": "Enrolled"}


@router.delete("/{user_id}/enrollments/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_user(user_id: int, course_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(UserCourseEnrollment).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.course_id == course_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if enrollment:
        await db.delete(enrollment)
