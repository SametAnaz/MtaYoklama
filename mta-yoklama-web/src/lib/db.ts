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

const db = new Database(dbFile);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    identity_no TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
    password_hash TEXT NOT NULL,
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
`);

const adminIdentity = process.env.ADMIN_IDENTITY_NO ?? "100000001";
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!";
const adminName = process.env.ADMIN_FULL_NAME ?? "Atolye Yoneticisi";

const adminExists = db
  .prepare("SELECT id FROM users WHERE identity_no = ?")
  .get(adminIdentity) as { id: string } | undefined;

if (!adminExists) {
  db.prepare(
    "INSERT INTO users (id, identity_no, full_name, role, password_hash) VALUES (?, ?, ?, 'admin', ?)",
  ).run(randomUUID(), adminIdentity, adminName, bcrypt.hashSync(adminPassword, 10));
}

export type UserRow = {
  id: string;
  identity_no: string;
  full_name: string;
  role: AppRole;
  password_hash: string;
};

export type SessionRow = {
  token: string;
  user_id: string;
  expires_at: string;
};

export { db };
