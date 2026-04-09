import { requireRole } from "@/lib/auth";
import { db, type AuditLog } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Denetim Günlüğü — MTA Admin",
};

const PAGE_SIZE = 20;

const actionLabels: Record<string, string> = {
  LOGIN: "Giriş yapıldı",
  CREATE_STAFF: "Personel oluşturuldu",
  ACTIVATE_STAFF: "Personel aktifleştirildi",
  DEACTIVATE_STAFF: "Personel pasifleştirildi",
  CREATE_SHIFT: "Vardiya oluşturuldu",
  UPDATE_SHIFT: "Vardiya güncellendi",
  DELETE_SHIFT: "Vardiya silindi",
  ASSIGN_SHIFT: "Personel atandı",
  REVOKE_SESSION: "Oturum sonlandırıldı",
  REVOKE_ALL_SESSIONS: "Tüm oturumlar sonlandırıldı",
};

const actionBadge: Record<string, string> = {
  LOGIN: "badge-green",
  CREATE_STAFF: "badge-green",
  ACTIVATE_STAFF: "badge-green",
  DEACTIVATE_STAFF: "badge-amber",
  CREATE_SHIFT: "badge-green",
  UPDATE_SHIFT: "badge-amber",
  DELETE_SHIFT: "badge-red",
  ASSIGN_SHIFT: "badge-green",
  REVOKE_SESSION: "badge-amber",
  REVOKE_ALL_SESSIONS: "badge-red",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1));
  const actorQ = (params.actorQ ?? "").trim();
  const actionQ = (params.actionQ ?? "").trim();
  const dateFrom = params.dateFrom ?? "";
  const dateTo = params.dateTo ?? "";

  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (actorQ) {
    conditions.push("actor_name LIKE ?");
    bindings.push(`%${actorQ}%`);
  }
  if (actionQ) {
    conditions.push("action = ?");
    bindings.push(actionQ);
  }
  if (dateFrom) {
    conditions.push("created_at >= ?");
    bindings.push(new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    conditions.push("created_at <= ?");
    bindings.push(new Date(dateTo + "T23:59:59").toISOString());
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${where}`).get(...bindings) as { n: number }).n;
  const offset = (page - 1) * PAGE_SIZE;

  const logs = db
    .prepare(`SELECT id, actor_id, actor_name, action, target, detail, created_at FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...bindings, PAGE_SIZE, offset) as AuditLog[];

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(p: number) {
    const qs = new URLSearchParams();
    if (actorQ) qs.set("actorQ", actorQ);
    if (actionQ) qs.set("actionQ", actionQ);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    qs.set("page", String(p));
    return `/admin/audit?${qs.toString()}`;
  }

  return (
    <main className="shell stack-lg">
      <header className="page-header">
        <div className="page-header-info">
          <p className="eyebrow">Admin Paneli</p>
          <h1>Denetim Günlüğü</h1>
          <p className="muted">Tüm admin aksiyonlarının kaydı</p>
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

      <section className="card stack">
        {/* Filters */}
        <form className="filter-bar" method="GET">
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="actorQ">Kullanıcı</label>
            <input id="actorQ" name="actorQ" type="search" defaultValue={actorQ} placeholder="Ad veya kimlik..." />
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="actionQ">Aksiyon tipi</label>
            <select id="actionQ" name="actionQ" defaultValue={actionQ}>
              <option value="">Tümü</option>
              {Object.entries(actionLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "0 1 130px" }}>
            <label htmlFor="dateFrom">Başlangıç</label>
            <input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
          </div>
          <div className="field" style={{ flex: "0 1 130px" }}>
            <label htmlFor="dateTo">Bitiş</label>
            <input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
          </div>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Filtrele</button>
          {(actorQ || actionQ || dateFrom || dateTo) && (
            <Link
              href="/admin/audit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-end",
                padding: "0.625rem 1rem",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                color: "var(--ink)",
              }}
            >
              ✕ Temizle
            </Link>
          )}
        </form>

        {logs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">📋</span>
            <p>Kayıt bulunamadı.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Kullanıcı</th>
                  <th>Aksiyon</th>
                  <th>Hedef</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs" style={{ whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="text-sm font-semibold">{log.actor_name}</td>
                    <td>
                      <span className={`badge ${actionBadge[log.action] ?? "badge-neutral"}`}>
                        {actionLabels[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="text-sm">{log.target ?? <span className="subtle">—</span>}</td>
                    <td className="text-xs subtle">{log.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="pagination">
            <span className="pagination-info">{total} kayıt</span>
            <div className="pagination-controls">
              {page > 1 ? (
                <Link href={buildHref(page - 1)} style={navLinkStyle}>← Önceki</Link>
              ) : (
                <span style={disabledLinkStyle}>← Önceki</span>
              )}
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{page} / {totalPages}</span>
              {page < totalPages ? (
                <Link href={buildHref(page + 1)} style={navLinkStyle}>Sonraki →</Link>
              ) : (
                <span style={disabledLinkStyle}>Sonraki →</span>
              )}
            </div>
          </nav>
        )}
      </section>
    </main>
  );
}

const navLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.375rem 0.75rem",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--text-sm)",
  color: "var(--ink)",
};

const disabledLinkStyle: React.CSSProperties = {
  ...navLinkStyle,
  borderColor: "var(--border-muted)",
  color: "var(--ink-subtle)",
};
