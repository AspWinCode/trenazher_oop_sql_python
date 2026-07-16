from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

REFRESH_TOKEN_EXPIRE_DAYS = 30


def _get_redis():
    """Return a Redis client or None if unavailable (graceful degradation)."""
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.ping()  # Test the connection - may fail if read-only
        return r
    except (ImportError, Exception):
        # Redis unavailable, not writable, or connection error
        return None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    jti = uuid.uuid4().hex
    to_encode.update({"exp": expire, "type": "refresh", "jti": jti})
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    # Store the valid JTI in Redis so old tokens become invalid after rotation
    r = _get_redis()
    if r:
        try:
            user_id = data.get("sub", "unknown")
            ttl = REFRESH_TOKEN_EXPIRE_DAYS * 86400
            r.setex(f"refresh:jti:{user_id}", ttl, jti)
        except Exception:
            pass  # Redis write failed, continue without token revocation
    return token


def create_token_pair(user_id: int, role: str) -> Tuple[str, str]:
    data = {"sub": str(user_id), "role": role}
    return create_access_token(data), create_refresh_token(data)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        # Validate JTI against Redis (rotation check).
        # If Redis is unavailable we fall back to JWT-only validation (graceful degradation).
        r = _get_redis()
        if r:
            user_id = payload.get("sub")
            stored_jti = r.get(f"refresh:jti:{user_id}")
            token_jti = payload.get("jti")
            # Only enforce JTI when both sides have it (backwards-compatible with old tokens)
            if stored_jti and token_jti and token_jti != stored_jti:
                return None  # Token was already rotated — reject
        return payload
    except JWTError:
        return None
