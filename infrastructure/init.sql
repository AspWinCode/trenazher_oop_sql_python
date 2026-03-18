-- Fallback schema creation if Alembic is not used.
-- The FastAPI app creates tables automatically on startup via SQLAlchemy metadata.create_all.
-- This file is provided for reference only.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submodules (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    submodule_id INTEGER REFERENCES submodules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(30) NOT NULL,
    runner_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    sql_schema TEXT,
    sql_seed TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_tests (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    test_type VARCHAR(20) NOT NULL DEFAULT 'public',
    input_data TEXT,
    expected_output TEXT,
    weight FLOAT DEFAULT 1.0,
    order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_hints (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    hint_level INTEGER DEFAULT 1,
    unlock_attempts INTEGER DEFAULT 3,
    content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_lectures (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    unlock_attempts INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    verdict VARCHAR(10),
    runtime FLOAT,
    memory FLOAT,
    error_output TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_tests (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES task_tests(id) ON DELETE CASCADE,
    verdict VARCHAR(10),
    runtime FLOAT,
    actual_output TEXT
);

CREATE TABLE IF NOT EXISTS student_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    attempts INTEGER DEFAULT 0,
    best_verdict VARCHAR(10),
    solved_at TIMESTAMPTZ,
    last_submission_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS personal_links (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0
);
