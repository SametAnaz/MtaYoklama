"use client";

import { useTransition, useState } from "react";
import { revokeSessionAction, revokeAllUserSessionsAction } from "@/app/admin/_actions/actions";

type SessionEntry = {
  token: string;
  user_id: string;
  full_name: string;
  identity_no: string;
  role: string;
  created_at: string;
  expires_at: string;
};

export function SessionList({
  sessions,
  currentToken,
}: {
  sessions: SessionEntry[];
  currentToken: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function revoke(token: string) {
    if (token === currentToken) {
      if (!confirm("Bu, kendi aktif oturumunuzdur. Çıkış mı yapmak istiyorsunuz?")) return;
    }
    startTransition(async () => {
      const res = await revokeSessionAction(token);
      if (res.error) setErrors((e) => ({ ...e, [token]: res.error! }));
    });
  }

  function revokeAll(userId: string, name: string) {
    if (!confirm(`${name} kullanıcısının tüm oturumları sonlandırılacak. Emin misiniz?`)) return;
    startTransition(async () => {
      const res = await revokeAllUserSessionsAction(userId);
      if (res.error) setErrors((e) => ({ ...e, [userId]: res.error! }));
    });
  }

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">🔐</span>
        <p>Aktif oturum bulunmuyor.</p>
      </div>
    );
  }

  // Group by user
  const byUser = new Map<string, SessionEntry[]>();
  for (const s of sessions) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  return (
    <div className="stack">
      {[...byUser.entries()].map(([userId, userSessions]) => {
        const first = userSessions[0];
        return (
          <div key={userId} className="card-compact stack-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold">{first.full_name}</span>
                <span className="subtle font-mono" style={{ marginLeft: "var(--sp-2)" }}>
                  {first.identity_no}
                </span>
                <span
                  className={`badge ${first.role === "admin" ? "badge-amber" : "badge-neutral"}`}
                  style={{ marginLeft: "var(--sp-2)" }}
                >
                  {first.role}
                </span>
              </div>
              <button
                type="button"
                className="danger sm"
                disabled={pending}
                onClick={() => revokeAll(userId, first.full_name)}
              >
                Tümünü Sonlandır
              </button>
            </div>

            {errors[userId] && (
              <p className="error-text text-xs">{errors[userId]}</p>
            )}

            <ul className="item-list">
              {userSessions.map((s) => (
                <li key={s.token} className="item-row">
                  <div className="item-row-info">
                    <span className="text-sm font-mono">
                      {s.token.slice(0, 16)}…
                      {s.token === currentToken && (
                        <span className="badge badge-green" style={{ marginLeft: "var(--sp-2)" }}>
                          Aktif Oturumunuz
                        </span>
                      )}
                    </span>
                    <span className="subtle text-xs">
                      Oluşturuldu: {new Date(s.created_at).toLocaleString("tr-TR")} · 
                      Geçerlilik: {new Date(s.expires_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="item-row-actions">
                    {errors[s.token] && (
                      <span className="error-text text-xs">{errors[s.token]}</span>
                    )}
                    <button
                      type="button"
                      className="ghost sm"
                      disabled={pending}
                      onClick={() => revoke(s.token)}
                    >
                      Sonlandır
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
