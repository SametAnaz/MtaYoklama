import { db } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 15;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number; attemptsLeft: 0 };

export function checkRateLimit(identityNo: string): RateLimitResult {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const recent = db
    .prepare(
      `SELECT COUNT(*) AS n FROM login_attempts
       WHERE identity_no = ? AND success = 0 AND attempted_at > ?`,
    )
    .get(identityNo, windowStart) as { n: number };

  if (recent.n >= MAX_ATTEMPTS) {
    // Find the oldest attempt in window to calculate remaining lockout
    const oldest = db
      .prepare(
        `SELECT attempted_at FROM login_attempts
         WHERE identity_no = ? AND success = 0 AND attempted_at > ?
         ORDER BY attempted_at ASC LIMIT 1`,
      )
      .get(identityNo, windowStart) as { attempted_at: string } | undefined;

    const unlockAt = oldest
      ? new Date(new Date(oldest.attempted_at).getTime() + LOCKOUT_MINUTES * 60 * 1000)
      : new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);

    const remaining = Math.ceil((unlockAt.getTime() - Date.now()) / 60_000);
    return { allowed: false, retryAfterMinutes: Math.max(1, remaining), attemptsLeft: 0 };
  }

  return { allowed: true };
}

export function recordAttempt(identityNo: string, success: boolean) {
  db.prepare(
    "INSERT INTO login_attempts (identity_no, success, attempted_at) VALUES (?, ?, ?)",
  ).run(identityNo, success ? 1 : 0, new Date().toISOString());

  // Clean up old attempts (keep last 30 days)
  db.prepare(
    "DELETE FROM login_attempts WHERE attempted_at < ?",
  ).run(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
}
