import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, type SessionRow } from "@/lib/db";

export const SESSION_COOKIE = "mta_session";

export function tokenExpiresIn(hours = 12) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = tokenExpiresIn();

  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      "SELECT token, user_id, expires_at FROM sessions WHERE token = ?",
    )
    .get(token) as SessionRow | undefined;

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return row;
}
