# Task Checker Platform

Task checker platform for Python (IO/OOP/NumPy), SQL, C++, and JavaScript tasks with real-time submission updates.

## Architecture (current flow)

```text
Frontend (React) -> Backend API (FastAPI) -> PostgreSQL
                         |
                         +-> Redis (queues + pub/sub)
                              |
                              +-> Judger (Celery workers) -> Docker sandbox images

Judger -> Backend internal API (/api/submissions/internal/*) -> Backend publishes WS updates
```

### Submission lifecycle

1. User sends code to `POST /api/submissions`.
2. Backend stores submission in PostgreSQL with `queued` status.
3. Backend sends execution payload to Celery queue in Redis.
4. Judger picks the job, runs code in language sandbox container.
5. Judger calls backend internal endpoints:
   - `POST /api/submissions/internal/{id}/start`
   - `POST /api/submissions/internal/{id}/complete`
6. Backend updates DB and publishes update event.
7. WebSocket clients (`/api/ws/submissions/{token}`) receive `running`/`finished` updates.

Note: judger does not use platform PostgreSQL directly anymore.

## Как сейчас работает проект

### Роли

- **Студент** — решает задачи, смотрит прогресс, может открыть свой профиль по ссылке.
- **Админ** — то же + управление пользователями, курсами, задачами и персональными ссылками.

### Что видит студент после входа

В боковом меню только два раздела:

1. **Задачи** (`/tasks`) — список всех доступных задач. Клик по задаче открывает страницу решения с редактором кода и кнопкой «Отправить».
2. **Прогресс** (`/` или `/progress`) — сводка: сколько решено, в процессе, всего попыток; таблица с попытками по задачам и ссылками на задачу.

Страницы «Курсы», «Рейтинг» и «Соревнования» в интерфейсе скрыты (маршруты и пункты меню убраны).

### Как студент решает задачу

1. Заходит в **Задачи** → видит список задач.
2. Нажимает на задачу → открывается страница задачи (условие, редактор кода, тесты при необходимости).
3. Пишет код, нажимает **Отправить**.
4. Решение уходит в очередь; статус обновляется (через WebSocket или опрос): queued → running → finished, показывается вердикт (AC, WA и т.д.).
5. В **Прогресс** видно свои попытки и лучший результат по каждой задаче.

### Что видит админ

В меню дополнительно блок **Администрирование**:

- **Пользователи** — список, создание, сброс пароля.
- **Курсы (админ)** — курсы, модули, подмодули (для структуры; страница курсов для студентов скрыта).
- **Задачи (админ)** — создание и редактирование задач (тип, тесты, подсказки, лекции).
- **Ссылки** — персональные ссылки на задачи для выдачи студентам.

### Публичные маршруты (без входа)

- `/login` — вход.
- `/shared/:token` — персональная ссылка на задачу (доступ по токену, без логина).

### Технологии

- **Frontend:** React, Vite, TypeScript, Monaco Editor, Zustand, React Router.
- **Backend:** FastAPI, SQLAlchemy (async), Alembic, JWT, Redis.
- **Judger:** Celery, Docker (песочницы Python/SQL/JS).
- **БД:** PostgreSQL; при деплое применяется только миграция 001 (базовые таблицы).

### Деплой (прод)

Backend при старте выполняет только `alembic upgrade 001`. Миграция 002 (конкурсы, рейтинг, достижения) не применяется — соответствующие разделы в UI отключены. Секреты задаются в `deploy/.env.prod`; скрипт `deploy/deploy.sh` проверяет отсутствие плейсхолдеров.

## Local start

```bash
cd docker
cp .env.example .env
./build-sandboxes.sh

docker compose up --build
```

Services:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000](http://localhost:8000)
- Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

## E2E profile

Run from repository root:

```bash
docker compose --env-file docker/.env -f docker/docker-compose.yml --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-check e2e-check
```

## CI

GitHub Actions workflow runs:
- backend tests (`pytest`)
- frontend type-check (`tsc -b`)
- docker e2e profile (`e2e-check`)

Workflow file: `.github/workflows/ci.yml`.

## Security requirements

Production deploy requires explicit values for:
- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `JUDGER_INTERNAL_TOKEN`
- `POSTGRES_PASSWORD`
- `CORS_ORIGINS`

`deploy/deploy.sh` blocks deploy if placeholders/default weak values are still present.

## Backend tests

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

## Frontend type-check

```bash
cd frontend
npm ci
npx tsc -b
```
