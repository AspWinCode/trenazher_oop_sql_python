from __future__ import annotations

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_FROM)


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send email. Returns True on success, False if SMTP not configured or on error."""
    if not _smtp_configured():
        logger.info("SMTP not configured, skipping email to %s: %s", to, subject)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if settings.SMTP_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)

        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to], msg.as_string())
        server.quit()
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


def send_welcome_email(to: str, login: str, password: str) -> bool:
    subject = "Добро пожаловать на платформу"
    html = f"""
    <p>Здравствуйте!</p>
    <p>Для вас создан аккаунт на учебной платформе.</p>
    <p><b>Логин:</b> {login}<br>
    <b>Пароль:</b> {password}</p>
    <p>Войдите по адресу: <a href="{settings.FRONTEND_URL}">{settings.FRONTEND_URL}</a></p>
    <p>После первого входа рекомендуем сменить пароль.</p>
    """
    return send_email(to, subject, html)


def send_password_reset_email(to: str, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Сброс пароля"
    html = f"""
    <p>Здравствуйте!</p>
    <p>Получен запрос на сброс пароля для вашего аккаунта.</p>
    <p>Перейдите по ссылке для установки нового пароля (ссылка действительна 1 час):</p>
    <p><a href="{reset_url}">{reset_url}</a></p>
    <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
    """
    return send_email(to, subject, html)
