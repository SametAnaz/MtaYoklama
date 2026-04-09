import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { SessionList } from "@/app/admin/_components/session-list";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Oturum Yönetimi — MTA Admin",
};

type SessionEntry = {
  token: string;
  user_id: string;
  full_name: string;
  identity_no: string;
  role: string;
  created_at: string;
  expires_at: string;
};

export default async function SessionsPage() {
  await requireRole("admin");

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const now = new Date().toISOString();
  const sessions = db
    .prepare(
      `SELECT s.token, s.user_id, s.created_at, s.expires_at,
              u.full_name, u.identity_no, u.role
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > ?
       ORDER BY s.created_at DESC`,
    )
    .all(now) as SessionEntry[];

  return (
    <main className="shell stack-lg">
      <header className="page-header">
        <div className="page-header-info">
          <p className="eyebrow">Admin Paneli</p>
          <h1>Aktif Oturumlar</h1>
          <p className="muted">{sessions.length} aktif oturum bulunuyor</p>
        </div>
        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.5rem 1rem",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            color: "var(--ink)",
          }}
        >
          ← Admin Paneli
        </Link>
      </header>

      <section>
        <SessionList sessions={sessions} currentToken={currentToken} />
      </section>
    </main>
  );
}
