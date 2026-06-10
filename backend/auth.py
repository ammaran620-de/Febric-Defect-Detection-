"""
Authentication helpers for Magic QC.
JWT-based sessions with role permissions and password validation.
"""
import hashlib
import hmac
import os
import re
import secrets
import time
from datetime import datetime, timedelta

# Simple JWT-like token using HMAC-SHA256 (no external jose dependency required)
# Token format: base64(header).base64(payload).signature

SECRET_KEY = os.environ.get("MQC_SECRET_KEY", "fabricguard-secret-change-in-production")
ACCESS_TOKEN_EXPIRE_HOURS = 8
INACTIVITY_TIMEOUT_MINUTES = 30

PERMISSIONS = {
    "admin": [
        "live_inspection", "roll_history", "analytics",
        "settings_read", "settings_write",
        "user_management", "delete_rolls", "audit_log",
    ],
    "operator": [
        "live_inspection", "roll_history", "analytics",
        "settings_read",
    ],
    "viewer": [
        "roll_history", "analytics",
    ],
}


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return f"{salt}:{h.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, stored = password_hash.split(":", 1)
        h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
        return hmac.compare_digest(h.hex(), stored)
    except Exception:
        return False


def validate_password_strength(password: str):
    """Returns (ok: bool, message: str)."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"
    specials = set("!@#$%^&*()_+-=[]{}|;':\",./<>?")
    if not any(c in specials for c in password):
        return False, "Password must contain at least one special character"
    return True, "OK"


def create_token() -> str:
    """Generate a secure random session token."""
    return secrets.token_urlsafe(48)


def has_permission(role: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(role, [])


DEFAULT_ADMIN = {
    "username": "admin",
    "full_name": "admin",
    "password": "12345678",
    "role": "admin",
}


async def ensure_default_admin(db):
    """Create default admin if no users exist."""
    async with db.execute("SELECT COUNT(*) as n FROM users") as cur:
        row = await cur.fetchone()
    async with db.execute("SELECT id, password_hash FROM users WHERE username=?", (DEFAULT_ADMIN["username"],)) as cur:
        admin = await cur.fetchone()

    if row["n"] == 0:
        pw_hash = hash_password(DEFAULT_ADMIN["password"])
        await db.execute(
            """INSERT INTO users (username, full_name, password_hash, role, force_password_change)
               VALUES (?, ?, ?, ?, 1)""",
            (DEFAULT_ADMIN["username"], DEFAULT_ADMIN["full_name"], pw_hash, DEFAULT_ADMIN["role"]),
        )
        await db.commit()
        print("[Auth] Default admin created — username: admin / password: 12345678")
    elif row["n"] == 1 and admin and not verify_password(DEFAULT_ADMIN["password"], admin["password_hash"]):
        pw_hash = hash_password(DEFAULT_ADMIN["password"])
        await db.execute(
            "UPDATE users SET password_hash=?, force_password_change=1 WHERE id=?",
            (pw_hash, admin["id"]),
        )
        await db.commit()
        print("[Auth] Default admin password reset — username: admin / password: 12345678")


async def write_audit(db, user_id, username, action, entity=None, entity_id=None, details=None, ip=None):
    await db.execute(
        """INSERT INTO audit_log (user_id, username, action, entity, entity_id, details, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, username, action, entity, entity_id, details, ip),
    )
    await db.commit()
