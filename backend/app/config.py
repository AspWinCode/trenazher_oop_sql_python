from __future__ import annotations

import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://platform:CHANGE_ME@postgres:5432/platform"
    SYNC_DATABASE_URL: str = "postgresql://platform:CHANGE_ME@postgres:5432/platform"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ADMIN_LOGIN: str = "admin"
    ADMIN_PASSWORD: str
    JUDGER_INTERNAL_TOKEN: str
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    AUTO_CREATE_TABLES: bool = False
    # Email / SMTP settings (optional — leave blank to disable email)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True
    FRONTEND_URL: str = "http://localhost:3000"
    # GetCourse webhook secret (оставь пустым чтобы отключить проверку)
    GETCOURSE_WEBHOOK_SECRET: str = ""
    # Т-Банк эквайринг (оставь пустым чтобы отключить платежи)
    TBANK_TERMINAL_KEY: str = ""
    TBANK_PASSWORD: str = ""
    # Базовый URL для NotificationURL (обычно совпадает с публичным адресом бэкенда)
    TBANK_NOTIFICATION_BASE_URL: str = "https://itpractikum.sflearning.ru"
    # Глобальная цена курса в копейках (используется если у курса не задана цена)
    COURSE_PRICE: int = 299000
    # amoCRM (оставь токен/поддомен пустыми чтобы отключить интеграцию)
    AMOCRM_SUBDOMAIN: str = ""            # sfcourses.amocrm.ru
    AMOCRM_ACCESS_TOKEN: str = ""         # долгосрочный токен
    AMOCRM_PIPELINE_ID: int = 1327579
    AMOCRM_STATUS_NEW: int = 21444364     # этап «Новый лид»
    AMOCRM_STATUS_WON: int = 142          # этап «Успешно реализовано»
    AMOCRM_FIELD_COURSE: int = 1308290    # Курс (текст)
    AMOCRM_FIELD_PROJECT: int = 712994    # PROJECT (текст)
    AMOCRM_FIELD_PRODUCT_ID: int = 1308362  # ID Продукта
    AMOCRM_FIELD_ORDER_ID: int = 1313682    # ID заказа
    AMOCRM_PROJECT_NAME: str = "ITPractikum"

    # Email-алерты о вопросах поддержки (Enkod). Список получателей через запятую.
    SUPPORT_ALERT_EMAILS: str = "osipow.1997@gmail.com,support@sf.education"
    # messageId шаблона письма в Enkod (0 = алерты отключены, пока шаблон не создан)
    ENKOD_SUPPORT_MESSAGE_ID: int = 0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> List[str]:
        raw = (self.CORS_ORIGINS or "").strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                return []
            if isinstance(parsed, list):
                return [str(origin).strip() for origin in parsed if str(origin).strip()]
            return []
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


settings = Settings()