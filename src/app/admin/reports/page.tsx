import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Raporlar — MTA Admin",
};

/* ─── Types ─── */
type AbsenceRow = {
  full_name: string;
  identity_no: string;
  work_date: string;
  start_time: string;
  end_time: string;
};

type MonthlyRow = {
  user_id: string;
  full_name: string;
  identity_no: string;
  year_month: string;
  total_minutes: number;
  session_count: number;
};

type StaffItem = {
  id: string;
  full_name: string;
};

/* ─── Helpers ─── */
function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** 7.5 saat (450 dk) = 1 iş günü */
const MINUTES_PER_WORKDAY = 450;

function calcDays(minutes: number): string {
  const raw = minutes / MINUTES_PER_WORKDAY;
  const rounded = Math.round(raw * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

/* ─── Inline style helpers ─── */
const navBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.5rem 1rem",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--text-sm)",
  color: "var(--ink)",
};

const exportBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sp-2)",
  padding: "0.5rem 1rem",
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

const csvBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sp-2)",
  padding: "0.5rem 1rem",
  border: "1.5px solid var(--accent)",
  color: "var(--accent)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 1.25rem",
    borderRadius: "var(--radius-md)",
    border: "1.5px solid",
    borderColor: active ? "var(--accent)" : "var(--border)",
    background: active ? "var(--accent-light)" : "transparent",
    color: active ? "var(--accent)" : "var(--ink-muted)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
  };
}

/* ─── Page ─── */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const report     = params.report    ?? "absence";
  const userId     = params.userId    ?? "";
  const absFrom    = params.absFrom   ?? "";
  const absTo      = params.absTo     ?? "";
  const monthYear  = params.monthYear ?? new Date().toISOString().slice(0, 7);

  /* ── Staff list for filter dropdown ── */
  const allStaff = db
    .prepare(
      "SELECT id, full_name FROM users WHERE role='staff' AND is_active=1 ORDER BY full_name",
    )
    .all() as StaffItem[];

  /* ── Absence report ── */
  let absenceRows: AbsenceRow[] = [];
  if (report === "absence") {
    const fromDate = absFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate   = absTo   || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const bindings: string[] = [fromDate, toDate];
    const userWhere = userId ? "AND u.id = ?" : "";
    if (userId) bindings.push(userId);

    absenceRows = db
      .prepare(
        `WITH RECURSIVE dates(d) AS (
           SELECT date(?)
           UNION ALL
           SELECT date(d, '+1 day') FROM dates WHERE d < date(?)
         )
         SELECT u.full_name, u.identity_no, d.d AS work_date,
                us.start_time, us.end_time
         FROM dates d
         CROSS JOIN users u
         INNER JOIN user_schedules us
           ON us.user_id = u.id AND us.day_of_week = CAST(strftime('%w', d.d) AS INTEGER)
         WHERE u.role = 'staff' AND u.is_active = 1
           ${userWhere}
           AND NOT EXISTS (
             SELECT 1 FROM attendance_logs a
             WHERE a.user_id = u.id AND date(a.check_in_at) = d.d
           )
         ORDER BY d.d DESC, u.full_name
         LIMIT 500`,
      )
      .all(...bindings) as AbsenceRow[];
  }

  /* ── Monthly report ── */
  let monthlyRows: MonthlyRow[] = [];
  if (report === "monthly") {
    const [y, m] = monthYear.split("-");
    const monthStart = `${y}-${m}-01T00:00:00.000Z`;
    const monthEnd   = new Date(Number(y), Number(m), 1).toISOString();

    const bindings: string[] = [monthStart, monthEnd];
    const userWhere = userId ? "AND a.user_id = ?" : "";
    if (userId) bindings.push(userId);

    monthlyRows = db
      .prepare(
        `SELECT a.user_id,
                u.full_name,
                u.identity_no,
                strftime('%Y-%m', a.check_in_at) AS year_month,
                SUM(
                  CASE WHEN a.check_out_at IS NOT NULL
                  THEN CAST((julianday(a.check_out_at) - julianday(a.check_in_at)) * 24 * 60 AS INTEGER)
                  ELSE 0 END
                ) AS total_minutes,
                COUNT(*) AS session_count
         FROM attendance_logs a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.check_in_at >= ? AND a.check_in_at < ?
           ${userWhere}
         GROUP BY a.user_id, year_month
         ORDER BY u.full_name`,
      )
      .all(...bindings) as MonthlyRow[];
  }

  /* ── Build export URLs (filters applied) ── */
  const commonExportParams = new URLSearchParams({ report });
  if (userId) commonExportParams.set("userId", userId);
  if (report === "absence") {
    if (absFrom) commonExportParams.set("absFrom", absFrom);
    if (absTo)   commonExportParams.set("absTo",   absTo);
  } else {
    commonExportParams.set("monthYear", monthYear);
  }

  const excelUrl = `/admin/reports/export?${commonExportParams.toString()}&format=excel`;
  const csvUrl   = `/admin/reports/export?${commonExportParams.toString()}&format=csv`;

  /* ── Tab base URL builder ── */
  const tabUrl = (r: string) => {
    const p = new URLSearchParams({ report: r });
    if (userId) p.set("userId", userId);
    return `/admin/reports?${p.toString()}`;
  };

  return (
    <main className="shell stack-lg">
      {/* ── Header ── */}
      <header className="page-header">
        <div className="page-header-info">
          <p className="eyebrow">Admin Paneli</p>
          <h1>Raporlar</h1>
          <p className="muted">Devamsızlık ve aylık çalışma özeti</p>
        </div>
        <div className="cluster">
          <Link href="/admin" style={navBtnStyle}>Admin Paneline Don</Link>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="cluster">
        <Link href={tabUrl("absence")} style={tabStyle(report === "absence")}>
          Devamsızlık Raporu
        </Link>
        <Link href={tabUrl("monthly")} style={tabStyle(report === "monthly")}>
          Aylık Çalışma Özeti
        </Link>
      </div>

      {/* ══ ABSENCE REPORT ══ */}
      {report === "absence" && (
        <section className="card stack">
          <div className="section-title" style={{ flexWrap: "wrap", gap: "var(--sp-3)" }}>
            <div>
              <h2>Devamsızlık Raporu</h2>
              <p className="text-sm subtle" style={{ marginTop: "var(--sp-1)" }}>
                Programı olan ama o gün giriş yapmayan personeller
              </p>
            </div>
            <div className="cluster">
              <span className="badge badge-red">{absenceRows.length} kayıt</span>
              <a href={csvUrl} style={csvBtnStyle}>CSV İndir</a>
              <a href={excelUrl} style={exportBtnStyle}>Excel İndir</a>
            </div>
          </div>

          {/* Filters */}
          <form className="filter-bar" method="GET" style={{ flexWrap: "wrap" }}>
            <input type="hidden" name="report" value="absence" />

            <div className="field" style={{ minWidth: "200px", flex: "1 1 200px" }}>
              <label htmlFor="abs-userId">Personel</label>
              <select id="abs-userId" name="userId" defaultValue={userId}>
                <option value="">Tüm Personel</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="absFrom">Başlangıç Tarihi</label>
              <input id="absFrom" name="absFrom" type="date" defaultValue={absFrom} />
            </div>
            <div className="field">
              <label htmlFor="absTo">Bitiş Tarihi</label>
              <input id="absTo" name="absTo" type="date" defaultValue={absTo} />
            </div>
            <button type="submit" style={{ alignSelf: "flex-end" }}>Filtrele</button>
            {(absFrom || absTo || userId) && (
              <Link
                href="/admin/reports?report=absence"
                style={{ ...navBtnStyle, alignSelf: "flex-end" }}
              >
                Temizle
              </Link>
            )}
          </form>

          {/* Active filter badge */}
          {userId && (
            <p className="text-sm subtle">
              Filtrelendi:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {allStaff.find((s) => s.id === userId)?.full_name}
              </strong>
            </p>
          )}

          {/* Table */}
          {absenceRows.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">—</span>
              <p>Seçili dönemde devamsızlık kaydı bulunmuyor.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Personel</th>
                    <th>Kimlik No</th>
                    <th>Tarih</th>
                    <th>Gün</th>
                    <th>Planlanan Saat</th>
                  </tr>
                </thead>
                <tbody>
                  {absenceRows.map((row, i) => (
                    <tr key={`${row.identity_no}-${row.work_date}-${i}`}>
                      <td className="font-semibold">{row.full_name}</td>
                      <td className="font-mono text-sm">{row.identity_no}</td>
                      <td className="font-mono text-sm">{row.work_date}</td>
                      <td className="text-sm">
                        {dayNames[new Date(row.work_date + "T12:00:00").getDay()]}
                      </td>
                      <td className="font-mono text-sm">
                        {row.start_time} – {row.end_time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ══ MONTHLY REPORT ══ */}
      {report === "monthly" && (
        <section className="card stack">
          <div className="section-title" style={{ flexWrap: "wrap", gap: "var(--sp-3)" }}>
            <div>
              <h2>Aylık Çalışma Özeti</h2>
              <p className="text-sm subtle" style={{ marginTop: "var(--sp-1)" }}>
                {fmtMonth(monthYear)} dönemi çalışma saatleri
              </p>
            </div>
            <div className="cluster">
              <span className="badge badge-neutral">{monthlyRows.length} personel</span>
              <a href={csvUrl} style={csvBtnStyle}>CSV İndir</a>
              <a href={excelUrl} style={exportBtnStyle}>Excel İndir</a>
            </div>
          </div>

          {/* Month + staff filter */}
          <form className="filter-bar" method="GET" style={{ flexWrap: "wrap" }}>
            <input type="hidden" name="report" value="monthly" />

            <div className="field" style={{ minWidth: "200px", flex: "1 1 200px" }}>
              <label htmlFor="mon-userId">Personel</label>
              <select id="mon-userId" name="userId" defaultValue={userId}>
                <option value="">Tüm Personel</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="monthYear">Ay</label>
              <input id="monthYear" name="monthYear" type="month" defaultValue={monthYear} />
            </div>
            <button type="submit" style={{ alignSelf: "flex-end" }}>Getir</button>
            {userId && (
              <Link
                href={`/admin/reports?report=monthly&monthYear=${monthYear}`}
                style={{ ...navBtnStyle, alignSelf: "flex-end" }}
              >
                Personel Filtresini Temizle
              </Link>
            )}
          </form>

          {/* Summary bar */}
          {monthlyRows.length > 0 && (
            <div
              style={{
                background: "var(--accent-light)",
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius-md)",
                padding: "var(--sp-3) var(--sp-4)",
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--sp-4)",
                alignItems: "center",
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {fmtMonth(monthYear)}
                {userId && allStaff.find((s) => s.id === userId)
                  ? ` · ${allStaff.find((s) => s.id === userId)!.full_name}`
                  : ""}
              </span>
              <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                {monthlyRows.reduce((s, r) => s + r.session_count, 0)} yoklama
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {hm(monthlyRows.reduce((s, r) => s + r.total_minutes, 0))}{" "}
                <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>
                  ({calcDays(monthlyRows.reduce((s, r) => s + r.total_minutes, 0))} iş günü)
                </span>
              </span>
              <span className="text-sm subtle" style={{ marginLeft: "auto" }}>
                * 1 iş günü = 7.5 saat
              </span>
            </div>
          )}

          {/* Table */}
          {monthlyRows.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">—</span>
              <p>Bu dönem için yoklama verisi bulunamadı.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Personel</th>
                    <th>Kimlik No</th>
                    <th>Yoklama</th>
                    <th>Toplam Süre</th>
                    <th>Ort. / Seans</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.user_id}>
                      <td className="font-semibold">{row.full_name}</td>
                      <td className="font-mono text-sm">{row.identity_no}</td>
                      <td className="text-sm">{row.session_count}</td>
                      <td className="font-semibold" style={{ color: "var(--accent)" }}>
                        {hm(row.total_minutes)}{" "}
                        <span style={{ color: "var(--ink-muted)", fontWeight: 400, fontSize: "var(--text-xs)" }}>
                          ({calcDays(row.total_minutes)} g\u00fcn)
                        </span>
                      </td>
                      <td className="text-sm subtle">
                        {hm(Math.round(row.total_minutes / row.session_count))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
