"""
Разовое заполнение users.getcourse_id из выгрузки GetCourse.

Сопоставляет по email (регистронезависимо). Проставляет getcourse_id только
если он ещё не задан и не занят другим пользователем.

Запуск внутри контейнера backend:
    docker compose -f docker/docker-compose.yml exec backend \
        python scripts/backfill_getcourse_ids.py

Файл scripts/getcourse_ids.csv (колонки: id,Email) лежит рядом со скриптом.
Флаг --dry-run — только показать, ничего не писать.
"""
from __future__ import annotations

import asyncio
import csv
import os
import sys

from sqlalchemy import select

from app.database import get_session_factory
from app.models.user import User

CSV_PATH = os.path.join(os.path.dirname(__file__), "getcourse_ids.csv")


def load_rows() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            gc_id = (r.get("id") or "").strip()
            email = (r.get("Email") or "").strip().lower()
            if gc_id and email:
                rows.append((gc_id, email))
    return rows


async def main(dry_run: bool) -> None:
    rows = load_rows()
    print(f"Записей в CSV: {len(rows)}")

    # email -> gc_id (последнее значение выигрывает, но дублей в файле нет)
    by_email = {email: gc_id for gc_id, email in rows}

    updated = skipped_no_user = skipped_has_id = skipped_id_taken = 0

    factory = get_session_factory()
    async with factory() as db:
        # Уже занятые getcourse_id — чтобы не нарушить уникальность.
        taken_result = await db.execute(
            select(User.getcourse_id).where(User.getcourse_id.is_not(None))
        )
        taken_ids = {row[0] for row in taken_result.all()}

        # Достаём всех пользователей с email одним запросом.
        emails = list(by_email.keys())
        # Проходим порциями, чтобы IN не разросся.
        CHUNK = 500
        email_to_user: dict[str, User] = {}
        for i in range(0, len(emails), CHUNK):
            part = emails[i : i + CHUNK]
            res = await db.execute(select(User).where(User.email.in_(part)))
            for u in res.scalars().all():
                if u.email:
                    email_to_user[u.email.lower()] = u

        for email, gc_id in by_email.items():
            user = email_to_user.get(email)
            if user is None:
                skipped_no_user += 1
                continue
            if user.getcourse_id:
                skipped_has_id += 1
                continue
            if gc_id in taken_ids:
                skipped_id_taken += 1
                continue
            user.getcourse_id = gc_id
            taken_ids.add(gc_id)
            updated += 1

        if dry_run:
            await db.rollback()
        else:
            await db.commit()

    print("── Итог ──")
    print(f"Проставлено getcourse_id:        {updated}")
    print(f"Нет пользователя с таким email:  {skipped_no_user}")
    print(f"Уже был getcourse_id:            {skipped_has_id}")
    print(f"ID уже занят другим:             {skipped_id_taken}")
    if dry_run:
        print("(dry-run: изменения НЕ сохранены)")


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    asyncio.run(main(dry))
