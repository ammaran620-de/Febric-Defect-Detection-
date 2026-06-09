"""
FastAPI application — Magic QC backend.
Runs at http://127.0.0.1:8000
"""
import asyncio
import base64
import csv
import io
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

import aiosqlite
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse

from database import get_db, get_config, DB_PATH
from detection import detect_defects, draw_defects_on_frame
from camera import create_source
from auth import (
    hash_password, verify_password, validate_password_strength,
    create_token, has_permission, ensure_default_admin, write_audit,
    ACCESS_TOKEN_EXPIRE_HOURS, INACTIVITY_TIMEOUT_MINUTES,
)

# ── Shared state ──────────────────────────────────────────────────────────────
_source = None
_recorder = None
_recorder_path = ""
_paused = False
_frame_count = 0
_active_roll_id: str | None = None
_target_fps = 25

_live_stats = {
    "total_points": 0,
    "fabric_length": 0.0,
    "frame_count": 0,
    "defects_this_session": [],
}

_ws_feed_clients: list[WebSocket] = []
_ws_stats_clients: list[WebSocket] = []

RECORDINGS_DIR = os.path.join(os.path.dirname(__file__), "..", "recordings")
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "exports")
os.makedirs(RECORDINGS_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    db = await get_db()
    try:
        # Close orphaned inspecting rolls
        async with db.execute("SELECT roll_id FROM rolls WHERE result='INSPECTING'") as cur:
            orphaned = await cur.fetchall()
        if orphaned:
            await db.execute(
                "UPDATE rolls SET result='ABORTED', end_time=? WHERE result='INSPECTING'",
                (datetime.utcnow().isoformat(),)
            )
            await db.commit()
            for row in orphaned:
                print(f"[Startup] Closed orphaned roll: {row['roll_id']}")

        # Enable WAL mode for better concurrent performance
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.execute("PRAGMA cache_size=10000")
        await db.execute("PRAGMA temp_store=MEMORY")
        await db.commit()

        # Ensure default admin exists
        await ensure_default_admin(db)
    finally:
        await db.close()

    asyncio.create_task(frame_loop())
    yield
    if _source:
        _source.release()
    if _recorder:
        _recorder.release()


app = FastAPI(title="Magic QC API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth helpers ──────────────────────────────────────────────────────────────
async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]

    db = await get_db()
    try:
        async with db.execute(
            """SELECT s.*, u.id as uid, u.username, u.full_name, u.role, u.is_active, u.force_password_change
               FROM sessions s JOIN users u ON s.user_id = u.id
               WHERE s.token=? AND s.is_active=1""",
            (token,)
        ) as cur:
            session = await cur.fetchone()

        if not session:
            raise HTTPException(status_code=401, detail="Session expired or invalid")
        if not session["is_active"]:
            raise HTTPException(status_code=401, detail="Account disabled")

        # Check expiry
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.utcnow() > expires_at:
            await db.execute("UPDATE sessions SET is_active=0 WHERE token=?", (token,))
            await db.commit()
            raise HTTPException(status_code=401, detail="Session expired")

        # Check inactivity
        last_activity = datetime.fromisoformat(session["last_activity"])
        if (datetime.utcnow() - last_activity).total_seconds() > INACTIVITY_TIMEOUT_MINUTES * 60:
            await db.execute("UPDATE sessions SET is_active=0 WHERE token=?", (token,))
            await db.commit()
            raise HTTPException(status_code=401, detail="Session timed out due to inactivity")

        # Update last_activity
        await db.execute(
            "UPDATE sessions SET last_activity=? WHERE token=?",
            (datetime.utcnow().isoformat(), token)
        )
        await db.commit()

        return dict(session)
    finally:
        await db.close()


def require_permission(permission: str):
    async def checker(request: Request):
        user = await get_current_user(request)
        if not has_permission(user["role"], permission):
            raise HTTPException(
                status_code=403,
                detail=f"Your role '{user['role']}' does not have '{permission}' permission"
            )
        return user
    return checker


# ── Frame loop ────────────────────────────────────────────────────────────────
async def frame_loop():
    global _source, _frame_count, _live_stats, _recorder, _target_fps

    db = await get_db()
    cfg = await get_config(db)
    await db.close()

    mode = cfg.get("camera_mode", "demo")
    ip = cfg.get("camera_ip", "")
    exposure = int(cfg.get("exposure_time", 5000))
    gain = float(cfg.get("gain", 1.0))
    line_rate = int(cfg.get("line_rate", 10000))
    min_area = int(cfg.get("min_defect_area_px", 50))
    fabric_w_in = float(cfg.get("fabric_width_m", 1.37)) / 0.0254
    p1 = float(cfg.get("penalty_1pt", 3))
    p2 = float(cfg.get("penalty_2pt", 6))
    p3 = float(cfg.get("penalty_3pt", 9))

    _source = create_source(mode, ip, exposure, gain, line_rate)

    while True:
        t0 = time.monotonic()
        frame_interval = 1.0 / max(_target_fps, 1)

        if _paused or not _source:
            await asyncio.sleep(frame_interval)
            continue

        loop = asyncio.get_event_loop()
        ret, frame = await loop.run_in_executor(None, _source.read)

        if not ret or frame is None:
            await asyncio.sleep(frame_interval)
            continue

        _frame_count += 1

        defects = []
        if _frame_count % 5 == 0:
            defects = await loop.run_in_executor(
                None, detect_defects, frame, min_area, fabric_w_in, p1, p2, p3
            )

        if defects:
            frame = await loop.run_in_executor(
                None, draw_defects_on_frame, frame, defects
            )

        if _active_roll_id:
            # Smoothly increment fabric length on every frame to simulate moving fabric
            _live_stats["fabric_length"] += 0.005
            if defects:
                pts = sum(d["penalty_points"] for d in defects)
                _live_stats["total_points"] += pts
                _live_stats["defects_this_session"].extend(defects)
                asyncio.create_task(
                    _save_defects_to_db(defects, _active_roll_id, _frame_count)
                )

        if _recorder is not None:
            await loop.run_in_executor(None, _recorder.write, frame)

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        b64 = base64.b64encode(buf).decode()

        payload = json.dumps({
            "frame": b64,
            "defects": defects,
            "frame_count": _frame_count,
            "fps": _target_fps,
            "demo_mode": mode == "demo",
        })

        stats_payload = json.dumps({
            "total_points": _live_stats["total_points"],
            "fabric_length": _live_stats["fabric_length"],
            "frame_count": _frame_count,
        })

        dead_feed = []
        for ws in _ws_feed_clients:
            try:
                await ws.send_text(payload)
            except Exception:
                dead_feed.append(ws)
        for ws in dead_feed:
            _ws_feed_clients.remove(ws)

        dead_stats = []
        for ws in _ws_stats_clients:
            try:
                await ws.send_text(stats_payload)
            except Exception:
                dead_stats.append(ws)
        for ws in dead_stats:
            _ws_stats_clients.remove(ws)

        elapsed = time.monotonic() - t0
        await asyncio.sleep(max(0, frame_interval - elapsed))


async def _save_defects_to_db(defects: list, roll_id: str, frame_no: int):
    db = await get_db()
    try:
        for d in defects:
            await db.execute(
                """INSERT INTO defects
                   (roll_id, detected_at, defect_type, length_inches,
                    penalty_points, position_x, position_y, frame_number)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    roll_id,
                    d.get("detected_at", datetime.utcnow().isoformat()),
                    d["defect_type"],
                    d["length_inches"],
                    d["penalty_points"],
                    d.get("position_x", 0),
                    d.get("position_y", 0),
                    frame_no,
                ),
            )
        await db.commit()
    finally:
        await db.close()


# ── WebSocket endpoints ────────────────────────────────────────────────────────
@app.websocket("/ws/live-feed")
async def ws_live_feed(websocket: WebSocket):
    global _paused, _recorder, _recorder_path, _target_fps
    await websocket.accept()
    _ws_feed_clients.append(websocket)
    try:
        async for msg in websocket.iter_text():
            try:
                cmd = json.loads(msg)
                action = cmd.get("command")
                if action == "pause":
                    _paused = True
                elif action == "resume":
                    _paused = False
                elif action == "start_recording":
                    if _recorder is None and _source:
                        fname = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
                        _recorder_path = os.path.join(RECORDINGS_DIR, fname)
                        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                        _recorder = cv2.VideoWriter(
                            _recorder_path, fourcc, 25,
                            (_source.frame_width, _source.frame_height)
                        )
                elif action == "stop_recording":
                    if _recorder:
                        _recorder.release()
                        _recorder = None
                elif "throttle" in cmd:
                    _target_fps = max(1, min(int(cmd["throttle"]), 30))
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_feed_clients:
            _ws_feed_clients.remove(websocket)


@app.websocket("/ws/stats")
async def ws_stats(websocket: WebSocket):
    await websocket.accept()
    _ws_stats_clients.append(websocket)
    try:
        await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_stats_clients:
            _ws_stats_clients.remove(websocket)


# ── Auth endpoints ─────────────────────────────────────────────────────────────
@app.post("/auth/login")
async def login(body: dict = Body(...), request: Request = None):
    username = body.get("username", "").strip().lower()
    password = body.get("password", "")
    ip = request.client.host if request else "unknown"

    db = await get_db()
    try:
        async with db.execute(
            "SELECT * FROM users WHERE username=?", (username,)
        ) as cur:
            user = await cur.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        if not user["is_active"]:
            raise HTTPException(status_code=401, detail="Account is disabled. Contact your administrator.")

        # Create session
        token = create_token()
        expires_at = (datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)).isoformat()
        await db.execute(
            """INSERT INTO sessions (user_id, token, expires_at, last_activity, ip_address)
               VALUES (?, ?, ?, ?, ?)""",
            (user["id"], token, expires_at, datetime.utcnow().isoformat(), ip)
        )
        await db.execute(
            "UPDATE users SET last_login=? WHERE id=?",
            (datetime.utcnow().isoformat(), user["id"])
        )
        await db.commit()

        await write_audit(db, user["id"], user["username"], "LOGIN", "session", None, f"IP: {ip}", ip)

        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_at": expires_at,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "full_name": user["full_name"],
                "role": user["role"],
                "force_password_change": bool(user["force_password_change"]),
            }
        }
    finally:
        await db.close()


@app.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return {"status": "ok"}
    token = auth[7:]
    ip = request.client.host if request else "unknown"

    db = await get_db()
    try:
        async with db.execute(
            """SELECT s.token, u.id, u.username FROM sessions s
               JOIN users u ON s.user_id=u.id WHERE s.token=?""",
            (token,)
        ) as cur:
            row = await cur.fetchone()
        if row:
            await db.execute("UPDATE sessions SET is_active=0 WHERE token=?", (token,))
            await db.commit()
            await write_audit(db, row["id"], row["username"], "LOGOUT", "session", None, None, ip)
    finally:
        await db.close()
    return {"status": "ok"}


@app.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["uid"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "force_password_change": bool(user["force_password_change"]),
    }


@app.get("/auth/check-setup")
async def check_setup():
    """Returns whether any admin account exists — used by landing page."""
    db = await get_db()
    try:
        async with db.execute("SELECT COUNT(*) as n FROM users WHERE role='admin'") as cur:
            row = await cur.fetchone()
        return {"admin_exists": row["n"] > 0}
    finally:
        await db.close()


@app.post("/auth/signup")
async def signup(body: dict = Body(...), request: Request = None):
    """Create first admin account. Blocked if any admin already exists."""
    db = await get_db()
    ip = request.client.host if request and request.client else "unknown"
    try:
        # Block if admin already exists
        async with db.execute("SELECT COUNT(*) as n FROM users WHERE role='admin'") as cur:
            row = await cur.fetchone()
        if row["n"] > 0:
            raise HTTPException(
                status_code=409,
                detail="An admin account already exists. Contact your system administrator."
            )

        username = body.get("username", "").strip().lower()
        first_name = body.get("first_name", "").strip()
        last_name = body.get("last_name", "").strip()
        factory_name = body.get("factory_name", "").strip()
        password = body.get("password", "")

        if not all([username, first_name, last_name, factory_name, password]):
            raise HTTPException(400, "All fields are required")

        # Check username not taken
        async with db.execute("SELECT id FROM users WHERE username=?", (username,)) as cur:
            if await cur.fetchone():
                raise HTTPException(409, "Username already taken.")

        # Validate password strength
        valid, msg = validate_password_strength(password)
        if not valid:
            raise HTTPException(400, msg)

        full_name = f"{first_name} {last_name}"
        pw_hash = hash_password(password)

        await db.execute(
            """INSERT INTO users (username, full_name, email, password_hash, role, is_active, force_password_change)
               VALUES (?, ?, ?, ?, 'admin', 1, 0)""",
            (username, full_name, "", pw_hash),
        )
        await db.commit()

        async with db.execute("SELECT id FROM users WHERE username=?", (username,)) as cur:
            new_user = await cur.fetchone()

        user_id = new_user["id"]

        # Update factory name in config
        await db.execute(
            "INSERT OR REPLACE INTO config(key, value) VALUES ('factory_name', ?)", (factory_name,)
        )
        await db.commit()

        # Create session
        token = create_token()
        expires_at = (datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)).isoformat()
        await db.execute(
            "INSERT INTO sessions (user_id, token, expires_at, last_activity, ip_address) VALUES (?, ?, ?, ?, ?)",
            (user_id, token, expires_at, datetime.utcnow().isoformat(), ip),
        )
        await db.execute("UPDATE users SET last_login=? WHERE id=?", (datetime.utcnow().isoformat(), user_id))
        await db.commit()

        await write_audit(db, user_id, username, "SIGNUP", "user", str(user_id), f"Admin account created. Factory: {factory_name}", ip)

        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_at": expires_at,
            "user": {
                "id": user_id,
                "username": username,
                "full_name": full_name,
                "role": "admin",
                "force_password_change": False,
            },
        }
    finally:
        await db.close()


@app.put("/auth/change-password")
async def change_password(body: dict = Body(...), request: Request = None):
    user = await get_current_user(request)
    current_pw = body.get("current_password", "")
    new_pw = body.get("new_password", "")
    confirm_pw = body.get("confirm_password", "")

    if new_pw != confirm_pw:
        raise HTTPException(400, "Passwords do not match")
    ok, msg = validate_password_strength(new_pw)
    if not ok:
        raise HTTPException(400, msg)

    db = await get_db()
    try:
        async with db.execute("SELECT password_hash FROM users WHERE id=?", (user["uid"],)) as cur:
            row = await cur.fetchone()
        if not verify_password(current_pw, row["password_hash"]):
            raise HTTPException(400, "Current password is incorrect")

        new_hash = hash_password(new_pw)
        await db.execute(
            "UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?",
            (new_hash, user["uid"])
        )
        # Invalidate all other sessions
        auth = request.headers.get("Authorization", "")[7:]
        await db.execute(
            "UPDATE sessions SET is_active=0 WHERE user_id=? AND token!=?",
            (user["uid"], auth)
        )
        await db.commit()
        await write_audit(db, user["uid"], user["username"], "PASSWORD_CHANGE", "user", str(user["uid"]))
    finally:
        await db.close()
    return {"status": "ok"}


@app.get("/auth/sessions")
async def get_sessions(request: Request):
    user = await get_current_user(request)
    if not has_permission(user["role"], "user_management"):
        raise HTTPException(403, "Admin only")
    db = await get_db()
    try:
        async with db.execute(
            """SELECT s.id, s.user_id, u.username, u.full_name, u.role,
                      s.created_at, s.last_activity, s.expires_at, s.ip_address, s.is_active
               FROM sessions s JOIN users u ON s.user_id=u.id
               WHERE s.is_active=1 ORDER BY s.last_activity DESC"""
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
        return {"sessions": rows}
    finally:
        await db.close()


@app.delete("/auth/sessions/{session_id}")
async def delete_session(session_id: int, request: Request):
    user = await get_current_user(request)
    if not has_permission(user["role"], "user_management"):
        raise HTTPException(403, "Admin only")
    db = await get_db()
    try:
        await db.execute("UPDATE sessions SET is_active=0 WHERE id=?", (session_id,))
        await db.commit()
        await write_audit(db, user["uid"], user["username"], "FORCE_LOGOUT", "session", str(session_id))
    finally:
        await db.close()
    return {"status": "ok"}


# ── User management endpoints ─────────────────────────────────────────────────
@app.get("/api/users")
async def list_users(request: Request):
    user = await get_current_user(request)
    if not has_permission(user["role"], "user_management"):
        raise HTTPException(403, "Admin only")
    db = await get_db()
    try:
        async with db.execute(
            "SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM users ORDER BY id"
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
        return {"users": rows}
    finally:
        await db.close()


@app.post("/api/users")
async def create_user(body: dict = Body(...), request: Request = None):
    user = await get_current_user(request)
    if not has_permission(user["role"], "user_management"):
        raise HTTPException(403, "Admin only")

    username = body.get("username", "").strip().lower()
    full_name = body.get("full_name", "").strip()
    role = body.get("role", "operator")
    password = body.get("password", "")
    email = body.get("email", "")
    force_change = int(body.get("force_password_change", 1))

    if not username or not full_name or not password:
        raise HTTPException(400, "username, full_name, and password are required")
    if role not in ("admin", "operator", "viewer"):
        raise HTTPException(400, "Invalid role")

    import re as _re
    if not _re.match(r'^[a-z0-9_]+$', username):
        raise HTTPException(400, "Username must be alphanumeric and underscores only")

    ok, msg = validate_password_strength(password)
    if not ok:
        raise HTTPException(400, msg)

    db = await get_db()
    try:
        async with db.execute("SELECT id FROM users WHERE username=?", (username,)) as cur:
            if await cur.fetchone():
                raise HTTPException(409, "Username already exists")

        pw_hash = hash_password(password)
        await db.execute(
            """INSERT INTO users (username, full_name, email, password_hash, role, force_password_change, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (username, full_name, email, pw_hash, role, force_change, user["uid"])
        )
        await db.commit()
        await write_audit(db, user["uid"], user["username"], "USER_CREATED", "user", username, f"role={role}")
        return {"status": "ok", "username": username}
    finally:
        await db.close()


@app.put("/api/users/{user_id}")
async def update_user(user_id: int, body: dict = Body(...), request: Request = None):
    current_user = await get_current_user(request)
    if not has_permission(current_user["role"], "user_management"):
        raise HTTPException(403, "Admin only")

    db = await get_db()
    try:
        async with db.execute("SELECT * FROM users WHERE id=?", (user_id,)) as cur:
            target = await cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found")

        # Cannot deactivate yourself
        if user_id == current_user["uid"] and "is_active" in body and not body["is_active"]:
            raise HTTPException(400, "Cannot deactivate your own account")

        updates = []
        params = []
        if "role" in body:
            if body["role"] not in ("admin", "operator", "viewer"):
                raise HTTPException(400, "Invalid role")
            updates.append("role=?")
            params.append(body["role"])
        if "is_active" in body:
            updates.append("is_active=?")
            params.append(int(body["is_active"]))
        if "full_name" in body:
            updates.append("full_name=?")
            params.append(body["full_name"])
        if "email" in body:
            updates.append("email=?")
            params.append(body["email"])
        if "new_password" in body:
            ok, msg = validate_password_strength(body["new_password"])
            if not ok:
                raise HTTPException(400, msg)
            updates.append("password_hash=?")
            params.append(hash_password(body["new_password"]))
            updates.append("force_password_change=1")

        if updates:
            params.append(user_id)
            await db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=?", params)
            await db.commit()
            await write_audit(db, current_user["uid"], current_user["username"],
                              "USER_UPDATED", "user", str(user_id), str(body))
        return {"status": "ok"}
    finally:
        await db.close()


@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, request: Request):
    current_user = await get_current_user(request)
    if not has_permission(current_user["role"], "user_management"):
        raise HTTPException(403, "Admin only")
    if user_id == current_user["uid"]:
        raise HTTPException(400, "Cannot delete your own account")
    db = await get_db()
    try:
        async with db.execute("SELECT username FROM users WHERE id=?", (user_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        await db.execute("UPDATE sessions SET is_active=0 WHERE user_id=?", (user_id,))
        await db.execute("DELETE FROM users WHERE id=?", (user_id,))
        await db.commit()
        await write_audit(db, current_user["uid"], current_user["username"],
                          "USER_DELETED", "user", row["username"])
    finally:
        await db.close()
    return {"status": "ok"}


# ── Audit log endpoint ────────────────────────────────────────────────────────
@app.get("/api/audit-log")
async def get_audit_log(
    page: int = 1, page_size: int = 50,
    username: str = None, action: str = None,
    request: Request = None
):
    user = await get_current_user(request)
    if not has_permission(user["role"], "audit_log"):
        raise HTTPException(403, "Admin only")

    db = await get_db()
    try:
        where, params = [], []
        if username:
            where.append("username LIKE ?")
            params.append(f"%{username}%")
        if action:
            where.append("action=?")
            params.append(action)
        clause = ("WHERE " + " AND ".join(where)) if where else ""

        async with db.execute(f"SELECT COUNT(*) as n FROM audit_log {clause}", params) as cur:
            total = (await cur.fetchone())["n"]

        offset = (page - 1) * page_size
        async with db.execute(
            f"SELECT * FROM audit_log {clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [page_size, offset]
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

        return {"items": rows, "total": total}
    finally:
        await db.close()


# ── Roll endpoints ─────────────────────────────────────────────────────────────
@app.post("/api/rolls/start")
async def start_roll(body: dict = Body(...), request: Request = None):
    global _active_roll_id, _live_stats
    roll_id = body.get("roll_id", f"ROLL-{datetime.now().strftime('%Y%m%d')}-001")
    operator = body.get("operator", "Unknown")
    threshold = float(body.get("threshold_used", 40))

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO rolls (roll_id, operator, start_time, threshold_used, result)
               VALUES (?, ?, ?, ?, 'INSPECTING')""",
            (roll_id, operator, datetime.utcnow().isoformat(), threshold),
        )
        await db.commit()
        async with db.execute("SELECT last_insert_rowid() as id") as cur:
            row = await cur.fetchone()
        _active_roll_id = roll_id
        _live_stats = {"total_points": 0, "fabric_length": 0.0,
                       "frame_count": 0, "defects_this_session": []}

        # Audit
        if request:
            try:
                user = await get_current_user(request)
                await write_audit(db, user["uid"], user["username"], "ROLL_START", "roll", roll_id)
            except Exception:
                pass

        return {"id": row["id"], "roll_id": roll_id}
    finally:
        await db.close()


@app.post("/api/rolls/{roll_id}/finish")
async def finish_roll(roll_id: str, body: dict = Body(default={}), request: Request = None):
    global _active_roll_id
    fabric_len = float(body.get("fabric_length_m", _live_stats["fabric_length"]))
    total_pts = int(body.get("total_points", _live_stats["total_points"]))

    db = await get_db()
    try:
        async with db.execute("SELECT * FROM rolls WHERE roll_id=?", (roll_id,)) as cur:
            roll = await cur.fetchone()
        if not roll:
            raise HTTPException(status_code=404, detail="Roll not found")

        cfg = await get_config(db)
        threshold = float(cfg.get("acceptance_threshold", 40))
        fabric_w_m = float(cfg.get("fabric_width_m", 1.37))

        sq_yards = fabric_w_m * fabric_len * 1.19599
        pts100 = (total_pts / sq_yards * 100) if sq_yards > 0 else 0.0
        result = "PASSED" if pts100 <= threshold else "FAILED"

        await db.execute(
            """UPDATE rolls SET end_time=?, fabric_length_m=?, total_points=?,
               points_per_100sqyd=?, result=? WHERE roll_id=?""",
            (datetime.utcnow().isoformat(), fabric_len, total_pts,
             round(pts100, 2), result, roll_id),
        )
        await db.commit()
        if _active_roll_id == roll_id:
            _active_roll_id = None

        if request:
            try:
                user = await get_current_user(request)
                await write_audit(db, user["uid"], user["username"], "ROLL_FINISH", "roll", roll_id,
                                  f"result={result}, pts100={pts100:.2f}")
            except Exception:
                pass

        return {
            "status": "ok",
            "roll_id": roll_id,
            "result": result,
            "points_per_100sqyd": round(pts100, 2),
            "total_points": total_pts,
            "threshold": threshold,
        }
    finally:
        await db.close()


@app.post("/api/rolls/{roll_id}/abort")
async def abort_roll(roll_id: str, request: Request = None):
    global _active_roll_id
    db = await get_db()
    try:
        async with db.execute("SELECT roll_id FROM rolls WHERE roll_id=?", (roll_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Roll not found")
        await db.execute(
            "UPDATE rolls SET result='ABORTED', end_time=? WHERE roll_id=?",
            (datetime.utcnow().isoformat(), roll_id),
        )
        await db.commit()
        if _active_roll_id == roll_id:
            _active_roll_id = None

        if request:
            try:
                user = await get_current_user(request)
                await write_audit(db, user["uid"], user["username"], "ROLL_ABORT", "roll", roll_id)
            except Exception:
                pass

        return {"status": "ok", "result": "ABORTED"}
    finally:
        await db.close()


@app.get("/api/rolls")
async def list_rolls(page: int = 1, page_size: int = 20, search: str = None,
                     result: str = None, date_from: str = None, date_to: str = None):
    db = await get_db()
    try:
        where, params = [], []
        if search:
            where.append("roll_id LIKE ?")
            params.append(f"%{search}%")
        if result and result != "ALL":
            where.append("result = ?")
            params.append(result)
        if date_from:
            where.append("start_time >= ?")
            params.append(date_from)
        if date_to:
            where.append("start_time <= ?")
            params.append(date_to + "T23:59:59")
        clause = ("WHERE " + " AND ".join(where)) if where else ""

        async with db.execute(f"SELECT COUNT(*) as n FROM rolls {clause}", params) as cur:
            total = (await cur.fetchone())["n"]

        offset = (page - 1) * page_size
        async with db.execute(
            f"SELECT * FROM rolls {clause} ORDER BY start_time DESC LIMIT ? OFFSET ?",
            params + [page_size, offset]
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

        return {"items": rows, "total": total}
    finally:
        await db.close()


@app.get("/api/rolls/{roll_id}")
async def get_roll(roll_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM rolls WHERE id=? OR roll_id=?",
                               (roll_id, roll_id)) as cur:
            roll = await cur.fetchone()
        if not roll:
            raise HTTPException(404, "Roll not found")
        roll = dict(roll)
        async with db.execute("SELECT * FROM defects WHERE roll_id=? ORDER BY detected_at",
                               (roll["roll_id"],)) as cur:
            defects = [dict(r) for r in await cur.fetchall()]
        return {**roll, "defects": defects}
    finally:
        await db.close()


@app.delete("/api/rolls/{roll_id}")
async def delete_roll(roll_id: str, request: Request = None):
    db = await get_db()
    try:
        async with db.execute("SELECT roll_id FROM rolls WHERE id=? OR roll_id=?",
                               (roll_id, roll_id)) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Roll not found")
        rid = row["roll_id"]
        await db.execute("DELETE FROM defects WHERE roll_id=?", (rid,))
        await db.execute("DELETE FROM rolls WHERE roll_id=?", (rid,))
        await db.commit()

        if request:
            try:
                user = await get_current_user(request)
                await write_audit(db, user["uid"], user["username"], "ROLL_DELETED", "roll", rid)
            except Exception:
                pass

        return {"deleted": rid}
    finally:
        await db.close()


@app.get("/api/rolls/{roll_id}/export")
async def export_roll_csv(roll_id: str):
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM rolls WHERE id=? OR roll_id=?",
                               (roll_id, roll_id)) as cur:
            roll = dict(await cur.fetchone())
        async with db.execute("SELECT * FROM defects WHERE roll_id=? ORDER BY detected_at",
                               (roll["roll_id"],)) as cur:
            defects = [dict(r) for r in await cur.fetchall()]
    finally:
        await db.close()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Roll ID", "Date", "Operator", "Fabric Length (m)",
        "Defect #", "Defect Type", "Length (inches)",
        "Penalty Points", "Position X", "Position Y", "Timestamp"
    ])
    for i, d in enumerate(defects, 1):
        writer.writerow([
            roll["roll_id"], roll.get("start_time", "")[:10],
            roll.get("operator", ""), roll.get("fabric_length_m", 0),
            i, d["defect_type"], d["length_inches"],
            d["penalty_points"], d["position_x"], d["position_y"],
            d["detected_at"],
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={roll['roll_id']}.csv"},
    )


# ── Analytics endpoints ────────────────────────────────────────────────────────
@app.get("/api/analytics/summary")
async def analytics_summary(
    date_from: str = None, date_to: str = None, shift: str = None
):
    db = await get_db()
    try:
        today = datetime.utcnow().date().isoformat()
        from datetime import date as _date, timedelta as _td
        yesterday = (_date.today() - _td(days=1)).isoformat()

        def shift_filter(col: str) -> str:
            if shift == "morning":
                return f" AND (CAST(strftime('%H', {col}) AS INTEGER) >= 6 AND CAST(strftime('%H', {col}) AS INTEGER) < 14)"
            elif shift == "evening":
                return f" AND (CAST(strftime('%H', {col}) AS INTEGER) >= 14 AND CAST(strftime('%H', {col}) AS INTEGER) < 22)"
            elif shift == "night":
                return f" AND (CAST(strftime('%H', {col}) AS INTEGER) >= 22 OR CAST(strftime('%H', {col}) AS INTEGER) < 6)"
            return ""

        sf = shift_filter("start_time")

        async def count(where_clause, params):
            async with db.execute(f"SELECT COUNT(*) as n FROM rolls {where_clause}", params) as c:
                return (await c.fetchone())["n"]

        async def avg_val(field, where_clause, params):
            async with db.execute(
                f"SELECT AVG({field}) as v FROM rolls {where_clause}", params
            ) as c:
                row = await c.fetchone()
                return round(row["v"] or 0, 2)

        async def sum_val(field, where_clause, params):
            async with db.execute(
                f"SELECT SUM({field}) as v FROM rolls {where_clause}", params
            ) as c:
                row = await c.fetchone()
                return round(row["v"] or 0, 2)

        total_today  = await count(f"WHERE date(start_time)=?{sf}", [today])
        passed_today = await count(f"WHERE date(start_time)=? AND result='PASSED'{sf}", [today])
        failed_today = await count(f"WHERE date(start_time)=? AND result='FAILED'{sf}", [today])
        total_yest   = await count(f"WHERE date(start_time)=?{sf}", [yesterday])
        passed_yest  = await count(f"WHERE date(start_time)=? AND result='PASSED'{sf}", [yesterday])
        total_passed = await count(f"WHERE result='PASSED'{sf}", [])
        total_failed = await count(f"WHERE result='FAILED'{sf}", [])

        # Defects today
        async with db.execute(
            f"""SELECT COUNT(*) as n FROM defects d
                JOIN rolls r ON d.roll_id=r.roll_id
                WHERE date(r.start_time)=?{sf}""", [today]
        ) as cur:
            defects_today = (await cur.fetchone())["n"]

        # Avg pts/roll today
        avg_pts = await avg_val("points_per_100sqyd", f"WHERE date(start_time)=?{sf}", [today])

        # Fabric inspected today (meters)
        fabric_today = await sum_val("fabric_length_m", f"WHERE date(start_time)=?{sf}", [today])

        # Active operators today
        async with db.execute(
            f"SELECT COUNT(DISTINCT operator) as n FROM rolls WHERE date(start_time)=?{sf}", [today]
        ) as cur:
            active_operators = (await cur.fetchone())["n"]

        pass_rate_today = round((passed_today / total_today * 100) if total_today else 0, 1)
        pass_rate_yest  = round((passed_yest / total_yest * 100) if total_yest else 0, 1)

        # 7-day sparkline data per KPI
        sparklines = {}
        for i in range(7):
            d = (_date.today() - _td(days=6 - i)).isoformat()
            t = await count(f"WHERE date(start_time)=?{sf}", [d])
            p = await count(f"WHERE date(start_time)=? AND result='PASSED'{sf}", [d])
            f_ = await count(f"WHERE date(start_time)=? AND result='FAILED'{sf}", [d])
            async with db.execute(
                f"SELECT COUNT(*) as n FROM defects dv JOIN rolls r ON dv.roll_id=r.roll_id WHERE date(r.start_time)=?{sf}", [d]
            ) as cur:
                dd = (await cur.fetchone())["n"]
            sparklines[d] = {"total": t, "passed": p, "failed": f_, "defects": dd,
                              "pass_rate": round((p / t * 100) if t else 0, 1)}

        return {
            "total_today": total_today,
            "passed_today": passed_today,
            "failed_today": failed_today,
            "total_passed": total_passed,
            "total_failed": total_failed,
            "pass_rate_today": pass_rate_today,
            "pass_rate_yesterday": pass_rate_yest,
            "defects_today": defects_today,
            "avg_pts_per_roll": avg_pts,
            "fabric_inspected_today": fabric_today,
            "active_operators": active_operators,
            "sparklines": sparklines,
        }
    finally:
        await db.close()


@app.get("/api/analytics/trends")
async def analytics_trends(date_from: str = None, date_to: str = None, shift: str = None):
    db = await get_db()
    try:
        where = []
        params = []
        if date_from:
            where.append("date(r.start_time) >= ?")
            params.append(date_from)
        if date_to:
            where.append("date(r.start_time) <= ?")
            params.append(date_to)
        if shift == "morning":
            where.append("(CAST(strftime('%H', r.start_time) AS INTEGER) >= 6 AND CAST(strftime('%H', r.start_time) AS INTEGER) < 14)")
        elif shift == "evening":
            where.append("(CAST(strftime('%H', r.start_time) AS INTEGER) >= 14 AND CAST(strftime('%H', r.start_time) AS INTEGER) < 22)")
        elif shift == "night":
            where.append("(CAST(strftime('%H', r.start_time) AS INTEGER) >= 22 OR CAST(strftime('%H', r.start_time) AS INTEGER) < 6)")

        clause = ("WHERE " + " AND ".join(where)) if where else ""

        async with db.execute(
            f"""SELECT date(start_time) as date,
                COUNT(*) as total,
                SUM(CASE WHEN result='PASSED' THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN result='FAILED' THEN 1 ELSE 0 END) as failed,
                AVG(points_per_100sqyd) as avg_points,
                40 as threshold
                FROM rolls {clause.replace('r.start_time', 'start_time').replace('r.', '')}
                GROUP BY date(start_time)
                ORDER BY date""",
            params
        ) as cur:
            daily = [dict(r) for r in await cur.fetchall()]

        clause2 = ("WHERE " + " AND ".join(where)) if where else ""
        async with db.execute(
            f"""SELECT d.defect_type, COUNT(*) as count
                FROM defects d
                JOIN rolls r ON d.roll_id = r.roll_id
                {clause2}
                GROUP BY d.defect_type
                ORDER BY count DESC LIMIT 10""",
            params
        ) as cur:
            freq = [dict(r) for r in await cur.fetchall()]

        return {"daily_rolls": daily, "defect_frequency": freq}
    finally:
        await db.close()


@app.get("/api/analytics/heatmap")
async def get_defect_heatmap(date_from: str = None, date_to: str = None, shift: str = None):
    db = await get_db()
    try:
        where = []
        params = []
        if date_from:
            where.append("date(r.start_time) >= ?")
            params.append(date_from)
        if date_to:
            where.append("date(r.start_time) <= ?")
            params.append(date_to)
        clause = ("WHERE " + " AND ".join(where)) if where else ""

        async with db.execute(
            f"""SELECT d.position_x, d.position_y FROM defects d
                JOIN rolls r ON d.roll_id=r.roll_id {clause}""",
            params
        ) as cur:
            defects = await cur.fetchall()

        COLS, ROWS = 20, 10
        grid = [[0] * COLS for _ in range(ROWS)]
        for d in defects:
            px, py = d["position_x"] or 0, d["position_y"] or 0
            col = min(int((px / FRAME_WIDTH) * COLS), COLS - 1)
            row = min(int((py / FRAME_HEIGHT) * ROWS), ROWS - 1)
            grid[row][col] += 1

        max_val = max(max(r) for r in grid) or 1
        normalized = [[cell / max_val for cell in row] for row in grid]

        return {
            "grid": normalized,
            "max_count": max_val,
            "total_defects": len(defects),
            "cols": COLS,
            "rows": ROWS,
        }
    finally:
        await db.close()


@app.get("/api/analytics/operators")
async def analytics_operators(date_from: str = None, date_to: str = None):
    db = await get_db()
    try:
        where, params = [], []
        if date_from:
            where.append("date(start_time) >= ?")
            params.append(date_from)
        if date_to:
            where.append("date(start_time) <= ?")
            params.append(date_to)
        clause = ("WHERE " + " AND ".join(where)) if where else ""

        async with db.execute(
            f"""SELECT operator,
                COUNT(*) as total,
                SUM(CASE WHEN result='PASSED' THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN result='FAILED' THEN 1 ELSE 0 END) as failed,
                AVG(points_per_100sqyd) as avg_pts
                FROM rolls {clause}
                GROUP BY operator ORDER BY total DESC""",
            params
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
        return {"operators": rows}
    finally:
        await db.close()


# Async CSV export (non-blocking)
async def _generate_analytics_csv(export_path: Path, date_from: str, date_to: str):
    db = await get_db()
    try:
        where, params = [], []
        if date_from:
            where.append("date(start_time) >= ?")
            params.append(date_from)
        if date_to:
            where.append("date(start_time) <= ?")
            params.append(date_to)
        clause = ("WHERE " + " AND ".join(where)) if where else ""

        async with db.execute(
            f"SELECT * FROM rolls {clause} ORDER BY start_time DESC", params
        ) as cur:
            rolls = [dict(r) for r in await cur.fetchall()]
    finally:
        await db.close()

    with open(export_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Roll ID", "Operator", "Start Time", "End Time",
                         "Fabric Length (m)", "Total Points", "Pts/100sqyd",
                         "Threshold", "Result"])
        for r in rolls:
            writer.writerow([
                r["roll_id"], r["operator"], r.get("start_time", ""),
                r.get("end_time", ""), r.get("fabric_length_m", 0),
                r.get("total_points", 0), r.get("points_per_100sqyd", 0),
                r.get("threshold_used", 40), r.get("result", ""),
            ])


@app.get("/api/analytics/export-csv")
async def export_analytics_csv(
    background_tasks: BackgroundTasks,
    date_from: str = None, date_to: str = None
):
    export_id = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    export_path = Path(EXPORTS_DIR) / f"{export_id}.csv"
    background_tasks.add_task(_generate_analytics_csv, export_path, date_from or "", date_to or "")
    return {"export_id": export_id, "status": "generating",
            "check_url": f"/api/exports/{export_id}"}


@app.get("/api/exports/{export_id}")
async def check_export(export_id: str):
    path = Path(EXPORTS_DIR) / f"{export_id}.csv"
    if path.exists() and path.stat().st_size > 0:
        return FileResponse(str(path), media_type="text/csv",
                            filename=f"{export_id}.csv")
    return {"status": "generating"}


# ── Config endpoints ───────────────────────────────────────────────────────────
@app.get("/api/config")
async def get_config_api():
    db = await get_db()
    try:
        return await get_config(db)
    finally:
        await db.close()


@app.put("/api/config")
async def update_config(body: dict = Body(...), request: Request = None):
    db = await get_db()
    try:
        for k, v in body.items():
            await db.execute(
                "INSERT OR REPLACE INTO config(key, value) VALUES (?, ?)", (k, str(v))
            )
        await db.commit()

        if request:
            try:
                user = await get_current_user(request)
                await write_audit(db, user["uid"], user["username"], "SETTINGS_CHANGE",
                                  "config", None, str(list(body.keys())))
            except Exception:
                pass

        return {"updated": len(body)}
    finally:
        await db.close()


# ── Camera endpoints ───────────────────────────────────────────────────────────
@app.get("/api/camera/status")
async def camera_status(ip: str = ""):
    global _source
    try:
        import mvsdk  # type: ignore
        devices = mvsdk.CameraEnumerateDevice()
        return {"connected": len(devices) > 0, "count": len(devices), "mode": "gigE"}
    except Exception:
        return {
            "connected": False,
            "mode": "demo",
            "message": "mvsdk not available — running in demo mode"
        }


@app.post("/api/camera/connect")
async def camera_connect(body: dict = Body(default={})):
    global _source
    db = await get_db()
    try:
        cfg = await get_config(db)
        ip = body.get("ip", cfg.get("camera_ip", "192.168.1.100"))
    finally:
        await db.close()

    import socket as _socket
    loop = asyncio.get_event_loop()

    def _probe():
        sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
        sock.settimeout(3)
        result = sock.connect_ex((ip, 3956))
        sock.close()
        return result == 0

    try:
        reachable = await loop.run_in_executor(None, _probe)
    except Exception:
        reachable = False

    if reachable:
        return {"connected": True, "ip": ip,
                "message": f"Camera reachable on GigE port 3956 at {ip}"}
    else:
        return {"connected": False, "ip": ip,
                "message": f"Port 3956 unreachable at {ip}. Check cable and IP."}


# ── Recordings ─────────────────────────────────────────────────────────────────
@app.get("/api/recordings/latest")
async def latest_recording():
    files = sorted(
        [f for f in os.listdir(RECORDINGS_DIR) if f.endswith(".mp4")],
        reverse=True
    )
    if not files:
        return {"path": None}
    return {"path": os.path.join(RECORDINGS_DIR, files[0]), "filename": files[0]}


# ── Data clear ────────────────────────────────────────────────────────────────
@app.delete("/api/data/clear")
async def clear_data():
    db = await get_db()
    try:
        await db.execute("DELETE FROM defects")
        await db.execute("DELETE FROM rolls")
        await db.execute("DELETE FROM alerts_log")
        await db.commit()
        return {"cleared": True}
    finally:
        await db.close()
