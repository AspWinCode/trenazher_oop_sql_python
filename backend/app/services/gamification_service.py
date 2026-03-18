from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import Achievement, UserAchievement
from app.models.rating import UserRating
from app.models.student_progress import StudentProgress

log = logging.getLogger(__name__)


async def _award(db: AsyncSession, user_id: int, code: str):
    existing = await db.execute(
        select(UserAchievement)
        .join(Achievement)
        .where(UserAchievement.user_id == user_id, Achievement.code == code)
    )
    if existing.scalar_one_or_none():
        return
    ach = await db.execute(select(Achievement).where(Achievement.code == code))
    achievement = ach.scalar_one_or_none()
    if achievement is None:
        return
    db.add(UserAchievement(user_id=user_id, achievement_id=achievement.id))
    log.info("Awarded achievement '%s' to user %d", code, user_id)


async def check_achievements(db: AsyncSession, user_id: int):
    """Check and award achievements based on current progress."""
    solved_result = await db.execute(
        select(func.count()).where(
            StudentProgress.user_id == user_id,
            StudentProgress.best_verdict == "AC",
        )
    )
    solved = solved_result.scalar() or 0

    if solved >= 1:
        await _award(db, user_id, "first_solve")
    if solved >= 10:
        await _award(db, user_id, "ten_solves")
    if solved >= 50:
        await _award(db, user_id, "fifty_solves")
    if solved >= 100:
        await _award(db, user_id, "hundred_solves")

    rating_result = await db.execute(select(UserRating).where(UserRating.user_id == user_id))
    rating = rating_result.scalar_one_or_none()
    if rating is None:
        rating = UserRating(user_id=user_id, rating=1200)
        db.add(rating)
    rating.solved_total = solved
    await db.flush()


async def update_rating_on_solve(db: AsyncSession, user_id: int):
    """Simple rating bump on solve (+5 per solve)."""
    result = await db.execute(select(UserRating).where(UserRating.user_id == user_id))
    rating = result.scalar_one_or_none()
    if rating is None:
        rating = UserRating(user_id=user_id, rating=1200)
        db.add(rating)
        await db.flush()
    rating.rating += 5
    await db.flush()
