"""Password hashing and signed session tokens (stdlib only)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.config import settings

_TOKEN_TTL_SECONDS = 60 * 60 * 12  # 12 hours


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
        )
        return hmac.compare_digest(digest.hex(), expected_hex)
    except (ValueError, AttributeError):
        return False


def _sign(payload_b64: str) -> str:
    sig = hmac.new(
        settings.auth_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")


def create_access_token(
    *,
    user_id: int,
    user_cd: str,
    co_id: int,
    company_cd: str,
) -> str:
    payload = {
        "sub": user_id,
        "user_cd": user_cd,
        "co_id": co_id,
        "company_cd": company_cd,
        "exp": int(time.time()) + _TOKEN_TTL_SECONDS,
    }
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    return f"{payload_b64}.{_sign(payload_b64)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload_b64, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(_sign(payload_b64), sig):
            raise ValueError("invalid signature")
        pad = "=" * (-len(payload_b64) % 4)
        payload = json.loads(
            base64.urlsafe_b64decode(payload_b64 + pad).decode("utf-8")
        )
        exp = int(payload.get("exp", 0))
        if exp < int(time.time()):
            raise ValueError("token expired")
        return payload
    except (ValueError, json.JSONDecodeError, KeyError) as exc:
        raise ValueError("invalid token") from exc
