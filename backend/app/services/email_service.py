from __future__ import annotations

import logging
import smtplib
import urllib.error
import urllib.request
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

# Enkod API config
ENKOD_API_URL = "https://api.enkod.ru/v1/mail/"  # trailing slash важен — без него 307 redirect
ENKOD_API_KEY = "p9Q3m6NGZ3KXT9OKOFQt2t5uJQjNs5PmXGj8kbnsBJzg"
ENKOD_WELCOME_MESSAGE_ID = 1470  # messageId для шаблона "логин + пароль"
# Установите messageId шаблона сброса пароля в Enkod (0 = не используется)
ENKOD_RESET_MESSAGE_ID = 1588


def _send_enkod(email: str, message_id: int, snippets: dict) -> bool:
    """Send email via Enkod API. Returns True on success."""
    payload = json.dumps({
        "messageId": message_id,
        "email": email,
        "snippets": snippets,
    }).encode("utf-8")

    req = urllib.request.Request(
        ENKOD_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "apiKey": ENKOD_API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.getcode()
            logger.info("Enkod response %s for email %s", status_code, email)
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("Enkod HTTP error %s for %s: %s", e.code, email, body)
        return False
    except Exception as e:
        logger.error("Enkod request failed for %s: %s", email, e)
        return False


def send_welcome_email(to: str, login: str, password: str) -> bool:
    """Send login/password to new student via Enkod."""
    return _send_enkod(
        email=to,
        message_id=ENKOD_WELCOME_MESSAGE_ID,
        snippets={"login": login, "password": password},
    )


def _send_smtp(to: str, subject: str, html_body: str) -> bool:
    """Send email via SMTP if configured in settings."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], [to], msg.as_string())
        logger.info("SMTP email sent to %s", to)
        return True
    except Exception as e:
        logger.error("SMTP error for %s: %s", to, e)
        return False


def dispatch_support_alert(student: str, message: str) -> None:
    """Разослать уведомление о новом вопросе поддержки на адреса из конфига.

    Best-effort: отправляется в фоне, любые ошибки только логируются и не влияют
    на сохранение сообщения студента. Канал — Enkod (шаблон ``ENKOD_SUPPORT_MESSAGE_ID``
    со сниппетами ``student``, ``message``, ``link``). Пока messageId не задан — no-op.
    """
    if not settings.ENKOD_SUPPORT_MESSAGE_ID:
        return
    link = f"{settings.FRONTEND_URL}/admin/support"
    recipients = [e.strip() for e in (settings.SUPPORT_ALERT_EMAILS or "").split(",") if e.strip()]
    for to in recipients:
        try:
            _send_enkod(
                to,
                settings.ENKOD_SUPPORT_MESSAGE_ID,
                {"student": student, "message": message, "link": link},
            )
        except Exception:
            logger.warning("Support alert failed for %s", to, exc_info=True)


def send_password_reset_email(to: str, token: str) -> bool:
    """Send password reset link via Enkod (if configured) or SMTP."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    logger.info("Password reset link for %s: %s", to, reset_url)
    if ENKOD_RESET_MESSAGE_ID:
        return _send_enkod(to, ENKOD_RESET_MESSAGE_ID, {"reset_url": reset_url})
    html = (
        f"<p>Вы запросили сброс пароля.</p>"
        f'<p><a href="{reset_url}">Нажмите сюда, чтобы задать новый пароль</a></p>'
        f"<p>Ссылка действительна 1 час.</p>"
        f"<p>Если вы не запрашивали сброс пароля — проигнорируйте это письмо.</p>"
    )
    return _send_smtp(to, "Сброс пароля", html)
