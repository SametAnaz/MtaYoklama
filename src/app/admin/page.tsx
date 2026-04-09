import { logout } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateStaffForm } from "@/app/admin/_components/create-staff-form";
import { StaffToggleButton } from "@/app/admin/_components/action-buttons";
import { ScheduleEditor } from "@/app/admin/_components/schedule-editor";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ResetStaffPasswordForm } from "@/app/admin/_components/reset-staff-password-form";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Paneli — MTA Vardiya ve Yoklama",
  description: "Personel, vardiya ve yoklama yönetim paneli.",
};

/* ─── Types ─── */
type Staff = {
  id: string;
  full_name: string;
  identity_no: string;
  is_active: number;
};

type AttendanceLog = {
  id: number;
  full_name: string;
  identity_no: string;
  shift_title: string | null;
  check_in_at: string;
  check_out_at: string | null;
};

/* ─── Helpers ─── */
const PAGE_SIZE = 10;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function duration(inAt: string, outAt: string | null): string {
  if (!outAt) return "Açık";
  const diff = new Date(outAt).getTime() - new Date(inAt).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

/* ─── Page ─── */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireRole("admin");
  const params = await searchParams;

  // Pagination
  const staffPage = Math.max(1, Number(params.staffPage ?? 1));
  const shiftPage = Math.max(1, Number(params.shiftPage ?? 1));
  const logPage   = Math.max(1, Number(params.logPage   ?? 1));

  // Filters
  const staffQ   = (params.staffQ   ?? "").trim();
  const shiftQ   = (params.shiftQ   ?? "").trim();
  const logName  = (params.logName  ?? "").trim();
  const logFrom  = params.logFrom  ?? "";
  const logTo    = params.logTo    ?? "";

  /* ── KPIs ── */
  const totalStaff = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='staff'").get() as { n: number }).n;
  const activeStaff = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='staff' AND is_active=1").get() as { n: number }).n;
  const scheduledStaff = (db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM user_schedules").get() as { n: number }).n;
  const openLogs = (db.prepare("SELECT COUNT(*) AS n FROM attendance_logs WHERE check_out_at IS NULL").get() as { n: number }).n;
  const todayLogs = (db.prepare(
    "SELECT COUNT(*) AS n FROM attendance_logs WHERE date(check_in_at) = date('now')"
  ).get() as { n: number }).n;

  /* ── Staff List ── */
  const staffSearch = staffQ ? `%${staffQ}%` : "%";
  const staffTotal = (db
    .prepare(`SELECT COUNT(*) AS n FROM users WHERE role='staff' AND (full_name LIKE ? OR identity_no LIKE ?)`)
    .get(staffSearch, staffSearch) as { n: number }).n;
  const staffOffset = (staffPage - 1) * PAGE_SIZE;
  const staffList = db
    .prepare(`SELECT id, full_name, identity_no, is_active FROM users WHERE role='staff' AND (full_name LIKE ? OR identity_no LIKE ?) ORDER BY full_name LIMIT ? OFFSET ?`)
    .all(staffSearch, staffSearch, PAGE_SIZE, staffOffset) as Staff[];

  // All active staff for dropdowns
  const activeStaffList = db
    .prepare("SELECT id, full_name, identity_no FROM users WHERE role='staff' AND is_active=1 ORDER BY full_name")
    .all() as { id: string; full_name: string; identity_no: string }[];

  /* ── Attendance Logs ── */
  const logConditions: string[] = [];
  const logBindings: (string | number)[] = [];

  if (logName) {
    logConditions.push("u.full_name LIKE ?");
    logBindings.push(`%${logName}%`);
  }
  if (logFrom) {
    logConditions.push("a.check_in_at >= ?");
    logBindings.push(new Date(logFrom).toISOString());
  }
  if (logTo) {
    logConditions.push("a.check_in_at <= ?");
    logBindings.push(new Date(logTo + "T23:59:59").toISOString());
  }

  const logWhere = logConditions.length > 0 ? `WHERE ${logConditions.join(" AND ")}` : "";

  const logTotal = (db
    .prepare(`SELECT COUNT(*) AS n FROM attendance_logs a INNER JOIN users u ON u.id = a.user_id ${logWhere}`)
    .get(...logBindings) as { n: number }).n;

  const logOffset = (logPage - 1) * PAGE_SIZE;
  const logs = db
    .prepare(
      `SELECT a.id, u.full_name, u.identity_no, s.title AS shift_title,
              a.check_in_at, a.check_out_at
       FROM attendance_logs a
       INNER JOIN users u ON u.id = a.user_id
       LEFT JOIN shifts s ON s.id = a.shift_id
       ${logWhere}
       ORDER BY a.check_in_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...logBindings, PAGE_SIZE, logOffset) as AttendanceLog[];

  const staffPages = Math.ceil(staffTotal / PAGE_SIZE);
  const logPages   = Math.ceil(logTotal   / PAGE_SIZE);

  return (
    <main className="shell stack-lg">
      {/* ── Global Spin style ── */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ══ PAGE HEADER ══ */}
      <header className="page-header">
        <div className="page-header-info">
          <p className="eyebrow">Admin Paneli</p>
          <h1>Hoş geldiniz, {admin.full_name}</h1>
          <p className="muted">Personel yönetimi ve yoklama takibi</p>
        </div>
        <div className="cluster" style={{ flexWrap: "wrap", gap: "var(--sp-2)" }}>
          <Link href="/admin/reports" style={{ display: "inline-flex", alignItems: "center", padding: "0.5rem 0.875rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", color: "var(--ink)" }}>Raporlar</Link>
          <Link href="/admin/sessions" style={{ display: "inline-flex", alignItems: "center", padding: "0.5rem 0.875rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", color: "var(--ink)" }}>Oturumlar</Link>
          <Link href="/admin/audit" style={{ display: "inline-flex", alignItems: "center", padding: "0.5rem 0.875rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", color: "var(--ink)" }}>Denetim</Link>
          <form action={logout}>
            <button type="submit" className="ghost sm">Çıkış Yap</button>
          </form>
        </div>
      </header>

      {/* ══ KPI TILES ══ */}
      <section aria-label="Özet istatistikler">
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-tile-value">{totalStaff}</span>
            <span className="stat-tile-label">Toplam Personel</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{activeStaff}</span>
            <span className="stat-tile-label">Aktif Personel</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{scheduledStaff}</span>
            <span className="stat-tile-label">Programlı Personel</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{todayLogs}</span>
            <span className="stat-tile-label">Bugün Yoklama</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{openLogs}</span>
            <span className="stat-tile-label">Açık Kayıt</span>
          </div>
        </div>
      </section>

      {/* ══ FORMS: Staff + Schedule ══ */}
      <div className="grid-two">
        <section aria-labelledby="create-staff-h">
          <div className="section-title">
            <h2 id="create-staff-h">Personel Ekle</h2>
          </div>
          <div className="card">
            <CreateStaffForm />
          </div>
        </section>

        <section aria-labelledby="schedule-h">
          <div className="section-title">
            <h2 id="schedule-h">Kişisel Çalışma Planı</h2>
          </div>
          <div className="card">
            <ScheduleEditor staff={activeStaffList} />
          </div>
        </section>
      </div>

      {/* ══ STAFF LIST ══ */}
      <section aria-labelledby="staff-list-h">
        <div className="section-title">
          <h2 id="staff-list-h">Personel Listesi</h2>
          <span className="badge badge-neutral">{staffTotal}</span>
        </div>
        <div className="card stack">
          {/* Filter */}
          <form className="filter-bar" method="GET">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="staffQ" className="sr-only">Personel ara</label>
              <input
                id="staffQ"
                name="staffQ"
                type="search"
                defaultValue={staffQ}
                placeholder="Ad veya kimlik no ile ara..."
              />
            </div>
            {logName   && <input type="hidden" name="logName"   value={logName}   />}
            {logFrom   && <input type="hidden" name="logFrom"   value={logFrom}   />}
            {logTo     && <input type="hidden" name="logTo"     value={logTo}     />}
            <button type="submit">Ara</button>
            {staffQ && (
              <a href="/admin" className="ghost" style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-1)", padding: "0.625rem 1rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", color: "var(--ink)" }}>
                ✕ Temizle
              </a>
            )}
          </form>

          {staffList.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">👤</span>
              <p>Personel bulunamadı.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>Kimlik No</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((member) => (
                    <tr key={member.id}>
                      <td className="font-semibold">{member.full_name}</td>
                      <td className="font-mono text-sm">{member.identity_no}</td>
                      <td>
                        {member.is_active ? (
                          <span className="badge badge-green">Aktif</span>
                        ) : (
                          <span className="badge badge-neutral">Pasif</span>
                        )}
                      </td>
                      <td>
                        <StaffToggleButton
                          userId={member.id}
                          fullName={member.full_name}
                          isActive={Boolean(member.is_active)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={staffPage}
            totalPages={staffPages}
            total={staffTotal}
            pageSize={PAGE_SIZE}
            paramName="staffPage"
            extraParams={{ logName, logFrom, logTo }}
          />
        </div>
      </section>

      {/* ══ ATTENDANCE LOGS ══ */}
      <section aria-labelledby="logs-h">
        <div className="section-title">
          <h2 id="logs-h">Yoklama Kayıtları</h2>
          <span className="badge badge-neutral">{logTotal}</span>
        </div>
        <div className="card stack">
          {/* Filter */}
          <form className="filter-bar" method="GET">
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="logName">Personel adı</label>
              <input
                id="logName"
                name="logName"
                type="search"
                defaultValue={logName}
                placeholder="Ad ile ara..."
              />
            </div>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor="logFrom">Başlangıç tarihi</label>
              <input id="logFrom" name="logFrom" type="date" defaultValue={logFrom} />
            </div>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor="logTo">Bitiş tarihi</label>
              <input id="logTo" name="logTo" type="date" defaultValue={logTo} />
            </div>
            {staffQ  && <input type="hidden" name="staffQ"  value={staffQ}  />}
            {shiftQ  && <input type="hidden" name="shiftQ"  value={shiftQ}  />}
            <button type="submit" style={{ alignSelf: "flex-end" }}>Filtrele</button>
            {(logName || logFrom || logTo) && (
              <a
                href="/admin"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  alignSelf: "flex-end",
                  gap: "var(--sp-1)",
                  padding: "0.625rem 1rem",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                  color: "var(--ink)",
                }}
              >
                ✕ Temizle
              </a>
            )}
            {/* CSV export */}
            <a
              href={`/admin/export?logName=${encodeURIComponent(logName)}&logFrom=${encodeURIComponent(logFrom)}&logTo=${encodeURIComponent(logTo)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-end",
                gap: "var(--sp-1)",
                padding: "0.625rem 1rem",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                background: "var(--neutral-100)",
                color: "var(--ink)",
                fontWeight: 600,
              }}
            >
              ⬇ CSV İndir
            </a>
          </form>

          {logs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <p>Filtreyle eşleşen yoklama kaydı bulunamadı.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Personel</th>
                    <th>Vardiya</th>
                    <th>Giriş</th>
                    <th>Çıkış</th>
                    <th>Süre</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className="font-semibold">{log.full_name}</span>
                        <br />
                        <span className="subtle font-mono">{log.identity_no}</span>
                      </td>
                      <td className="text-sm">{log.shift_title ?? <span className="subtle">—</span>}</td>
                      <td className="font-mono text-sm">{fmt(log.check_in_at)}</td>
                      <td className="font-mono text-sm">
                        {log.check_out_at ? fmt(log.check_out_at) : <span className="subtle">—</span>}
                      </td>
                      <td className="text-sm">{duration(log.check_in_at, log.check_out_at)}</td>
                      <td>
                        {log.check_out_at ? (
                          <span className="badge badge-neutral">Tamamlandı</span>
                        ) : (
                          <span className="badge badge-green">Açık</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={logPage}
            totalPages={logPages}
            total={logTotal}
            pageSize={PAGE_SIZE}
            paramName="logPage"
            extraParams={{ staffQ, shiftQ, logName, logFrom, logTo }}
          />
        </div>
      </section>
      {/* ══ PASSWORD MANAGEMENT ══ */}
      <div className="grid-two">
        <details style={detailsStyle}>
          <summary style={summaryStyle}>
            <span>Şifremi Değiştir</span>
            <span style={chevronStyle}>▾</span>
          </summary>
          <div style={{ padding: "var(--sp-4)" }}>
            <ChangePasswordForm />
          </div>
        </details>

        <details style={detailsStyle}>
          <summary style={summaryStyle}>
            <span>Personel Şifre Sıfırlama</span>
            <span style={chevronStyle}>▾</span>
          </summary>
          <div style={{ padding: "var(--sp-4)" }}>
            <ResetStaffPasswordForm staff={activeStaffList} />
          </div>
        </details>
      </div>
    </main>
  );
}

/* ─── Accordion (details/summary) styles ─── */
const detailsStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
};

const summaryStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--sp-4) var(--sp-5)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "var(--text-base)",
  color: "var(--ink)",
  listStyle: "none",
  userSelect: "none",
};

const chevronStyle: React.CSSProperties = {
  fontSize: "1rem",
  color: "var(--ink-muted)",
  transition: "transform 0.2s",
};

/* ─── Pagination component (server) ─── */
type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  paramName: string;
  extraParams: Record<string, string | number>;
};

function Pagination({ page, totalPages, total, pageSize, paramName, extraParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function buildHref(p: number) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) qs.set(k, String(v));
    }
    qs.set(paramName, String(p));
    return `/admin?${qs.toString()}`;
  }

  return (
    <nav className="pagination" aria-label="Sayfalama">
      <span className="pagination-info">
        {start}–{end} / {total} kayıt
      </span>
      <div className="pagination-controls">
        {page > 1 ? (
          <a
            href={buildHref(page - 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.375rem 0.75rem",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              color: "var(--ink)",
            }}
          >
            ← Önceki
          </a>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.375rem 0.75rem",
              border: "1.5px solid var(--border-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              color: "var(--ink-subtle)",
            }}
          >
            ← Önceki
          </span>
        )}

        <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
          {page} / {totalPages}
        </span>

        {page < totalPages ? (
          <a
            href={buildHref(page + 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.375rem 0.75rem",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              color: "var(--ink)",
            }}
          >
            Sonraki →
          </a>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.375rem 0.75rem",
              border: "1.5px solid var(--border-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              color: "var(--ink-subtle)",
            }}
          >
            Sonraki →
          </span>
        )}
      </div>
    </nav>
  );
}
