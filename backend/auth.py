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

def _load_secret_key() -> str:
    """Use MQC_SECRET_KEY if set, else a random key kept in backend/data/secret.key.

    There is no built-in fallback string: a key that ships in the repo is not a secret.
    """
    env = os.environ.get("MQC_SECRET_KEY")
    if env:
        return env
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "secret.key")
    try:
        with open(path, "r", encoding="utf-8") as f:
            key = f.read().strip()
            if key:
                return key
    except FileNotFoundError:
        pass
    os.makedirs(os.path.dirname(path), exist_ok=True)
    key = secrets.token_urlsafe(48)
    with open(path, "w", encoding="utf-8") as f:
        f.write(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


SECRET_KEY = _load_secret_key()
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


ADMIN_USERNAME = "admin"


async def ensure_default_admin(db):
    """Create the first admin account if no users exist.

    The password comes from MQC_ADMIN_PASSWORD, or is generated and printed once.
    Either way the account must change it at first login. An existing admin's
    password is never reset here.
    """
    async with db.execute("SELECT COUNT(*) as n FROM users") as cur:
        row = await cur.fetchone()
    if row["n"] != 0:
        return

    password = os.environ.get("MQC_ADMIN_PASSWORD")
    generated = not password
    if generated:
        password = secrets.token_urlsafe(12)
    await db.execute(
        """INSERT INTO users (username, full_name, password_hash, role, force_password_change)
           VALUES (?, ?, ?, ?, 1)""",
        (ADMIN_USERNAME, ADMIN_USERNAME, hash_password(password), "admin"),
    )
    await db.commit()
    if generated:
        print(f"[Auth] First-run admin created. username: {ADMIN_USERNAME}  password: {password}")
        print("[Auth] This password is shown once. You must change it at first login.")
    else:
        print(f"[Auth] First-run admin created from MQC_ADMIN_PASSWORD. username: {ADMIN_USERNAME}")


async def write_audit(db, user_id, username, action, entity=None, entity_id=None, details=None, ip=None):
    await db.execute(
        """INSERT INTO audit_log (user_id, username, action, entity, entity_id, details, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, username, action, entity, entity_id, details, ip),
    )
    await db.commit()
