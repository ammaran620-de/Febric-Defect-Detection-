import aiosqlite
import os

DB_PATH = os.environ.get("MQC_DB_PATH", "./data/magic_qc.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_id TEXT UNIQUE,
  operator TEXT,
  start_time DATETIME,
  end_time DATETIME,
  fabric_length_m REAL DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  points_per_100sqyd REAL DEFAULT 0,
  threshold_used REAL DEFAULT 40,
  result TEXT DEFAULT 'INSPECTING',
  notes TEXT,
  shipment_group TEXT
);

CREATE TABLE IF NOT EXISTS defects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_id TEXT,
  detected_at DATETIME,
  defect_type TEXT,
  length_inches REAL,
  penalty_points INTEGER,
  position_x REAL,
  position_y REAL,
  frame_number INTEGER
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS alerts_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_id TEXT,
  alert_type TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
  is_active INTEGER DEFAULT 1,
  force_password_change INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rolls_result ON rolls(result);
CREATE INDEX IF NOT EXISTS idx_rolls_start_time ON rolls(start_time);
CREATE INDEX IF NOT EXISTS idx_rolls_roll_id ON rolls(roll_id);
CREATE INDEX IF NOT EXISTS idx_defects_roll_id ON defects(roll_id);
CREATE INDEX IF NOT EXISTS idx_defects_detected_at ON defects(detected_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
"""

DEFAULT_CONFIG = {
    "acceptance_threshold": "40",
    "fabric_width_m": "1.37",
    "min_defect_area_px": "50",
    "camera_mode": "demo",
    "camera_ip": "192.168.1.100",
    "exposure_time": "5000",
    "gain": "1.0",
    "line_rate": "10000",
    "roll_prefix": "ROLL",
    "auto_finish_enabled": "false",
    "auto_finish_meters": "200",
    "warn_threshold_pct": "80",
    "factory_name": "My Factory",
    "operator_name": "Default Operator",
    "data_path": "./data",
    "penalty_1pt": "3",
    "penalty_2pt": "6",
    "penalty_3pt": "9",
}


async def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.executescript(SCHEMA)
    await db.commit()
    for k, v in DEFAULT_CONFIG.items():
        await db.execute(
            "INSERT OR IGNORE INTO config(key, value) VALUES (?, ?)", (k, v)
        )
    await db.commit()
    return db


async def get_config(db) -> dict:
    async with db.execute("SELECT key, value FROM config") as cur:
        rows = await cur.fetchall()
    return {r["key"]: r["value"] for r in rows}
