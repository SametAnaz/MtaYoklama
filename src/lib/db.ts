import Database from "better-sqlite3";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

export type AppRole = "admin" | "staff";

const dataDir = path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "mta-yoklama.db");

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbFile, { timeout: 8000 });

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ─── Core tables ─── */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    identity_no TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    repeat_rule TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS shift_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shift_id, user_id),
    FOREIGN KEY(shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    shift_id INTEGER,
    check_in_at TEXT NOT NULL,
    check_out_at TEXT,
    source TEXT NOT NULL DEFAULT 'web',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(shift_id) REFERENCES shifts(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_open
    ON attendance_logs(user_id, check_out_at);

  CREATE INDEX IF NOT EXISTS idx_attendance_checkin
    ON attendance_logs(check_in_at);

  /* ── Audit log ── */
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs(created_at);

  /* ── Personal weekly schedules ── */
  CREATE TABLE IF NOT EXISTS user_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    UNIQUE(user_id, day_of_week),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_schedules_user
    ON user_schedules(user_id);

  /* ── Login rate limiting ── */
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_no TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_login_attempts_identity
    ON login_attempts(identity_no, attempted_at);
`);

/* ─── Migrations for existing DBs ─── */
function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  } catch {
    // already exists
  }
}

addColumnIfMissing("users", "is_active", "INTEGER NOT NULL DEFAULT 1");

/* ─── Seed admin ─── */
const adminIdentity = process.env.ADMIN_IDENTITY_NO ?? "100000001";
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!";
const adminName = process.env.ADMIN_FULL_NAME ?? "Atolye Yoneticisi";

db.prepare(
  "INSERT OR IGNORE INTO users (id, identity_no, full_name, role, password_hash, is_active) VALUES (?, ?, ?, 'admin', ?, 1)",
).run(randomUUID(), adminIdentity, adminName, bcrypt.hashSync(adminPassword, 10));

/* ─── Types ─── */
export type UserRow = {
  id: string;
  identity_no: string;
  full_name: string;
  role: AppRole;
  password_hash: string;
  is_active: number;
};

export type SessionRow = {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
};

export type ShiftRow = {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  repeat_rule: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string;
  actor_name: string;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: string;
};

export { db };
