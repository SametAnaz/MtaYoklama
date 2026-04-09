import { logout } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AttendancePanel } from "@/app/dashboard/_components/attendance-panel";
import { ChangePasswordForm } from "@/components/change-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Çalışan Paneli — MTA Vardiya ve Yoklama",
  description: "Yoklama giriş/çıkış ve çalışma programınızı takip edin.",
};

type AttendanceRow = {
  check_in_at: string;
  check_out_at: string | null;
};

type ScheduleRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(inAt: string, outAt: string | null): string {
  if (!outAt) return "Devam ediyor";
  const diff = new Date(outAt).getTime() - new Date(inAt).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

export default async function DashboardPage() {
  const user = await requireRole("staff");

  // Today's day of week (0=Pazar, 1=Pzt...)
  const todayDow = new Date().getDay();

  // User's schedule for today
  const todaySchedule = db
    .prepare(
      "SELECT day_of_week, start_time, end_time FROM user_schedules WHERE user_id = ? AND day_of_week = ? LIMIT 1",
    )
    .get(user.id, todayDow) as ScheduleRow | undefined;

  // Full weekly schedule for display
  const weeklySchedule = db
    .prepare(
      "SELECT day_of_week, start_time, end_time FROM user_schedules WHERE user_id = ? ORDER BY day_of_week",
    )
    .all(user.id) as ScheduleRow[];

  const openLog = db
    .prepare(
      "SELECT id FROM attendance_logs WHERE user_id = ? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1",
    )
    .get(user.id) as { id: number } | undefined;

  const myAttendance = db
    .prepare(
      "SELECT check_in_at, check_out_at FROM attendance_logs WHERE user_id = ? ORDER BY check_in_at DESC LIMIT 10",
    )
    .all(user.id) as AttendanceRow[];

  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

  return (
    <main className="shell stack-lg">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <header className="page-header">
        <div className="page-header-info">
          <p className="eyebrow">Çalışan Paneli</p>
          <h1>Hoş geldiniz, {user.full_name}</h1>
          <p className="muted">
            {todaySchedule
              ? `${dayNames[todayDow]} — ${todaySchedule.start_time} / ${todaySchedule.end_time}`
              : "Bugün çalışma gününüz değil"}
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="ghost sm">↩ Çıkış Yap</button>
        </form>
      </header>

      {/* ── Bugünün program uyarısı ── */}
      {!todaySchedule && weeklySchedule.length > 0 && (
        <div
          className="alert"
          style={{
            background: "var(--warn-bg)",
            border: "1px solid var(--warn)",
            borderRadius: "var(--radius-md)",
            padding: "var(--sp-3) var(--sp-4)",
            display: "flex",
            gap: "var(--sp-2)",
            color: "var(--ink)",
          }}
        >
          <span>📅</span>
          <span>
            Bugün ({dayNames[todayDow]}) çalışma programınızda bulunmuyor.
            Yine de giriş/çıkış yapabilirsiniz.
          </span>
        </div>
      )}

      {weeklySchedule.length === 0 && (
        <div className="alert alert-error" style={{ borderRadius: "var(--radius-md)" }}>
          <span>⚠</span>
          <span>Henüz bir çalışma programı atanmamış. Yöneticinizle iletişime geçin.</span>
        </div>
      )}

      {/* ── Attendance Panel ── */}
      <div className="grid-two">
        <section aria-labelledby="attendance-heading">
          <div className="section-title">
            <h2 id="attendance-heading">Yoklama İşlemi</h2>
            {todaySchedule && (
              <span className="badge badge-green">
                {todaySchedule.start_time} → {todaySchedule.end_time}
              </span>
            )}
          </div>
          <div className="card">
            <AttendancePanel
              hasOpenLog={Boolean(openLog)}
              todaySchedule={todaySchedule ?? null}
            />
          </div>
        </section>

        {/* Weekly schedule preview */}
        <section aria-labelledby="schedule-heading">
          <div className="section-title">
            <h2 id="schedule-heading">Haftalık Programım</h2>
            <span className="badge badge-neutral">{weeklySchedule.length} gün</span>
          </div>
          <div className="card">
            {weeklySchedule.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🗓️</span>
                <p>Program henüz oluşturulmamış.</p>
              </div>
            ) : (
              <ul className="item-list" role="list">
                {weeklySchedule.map((row) => {
                  const isToday = row.day_of_week === todayDow;
                  return (
                    <li
                      key={row.day_of_week}
                      className="item-row"
                      style={isToday ? { background: "var(--accent-light)" } : undefined}
                    >
                      <div className="item-row-info">
                        <strong style={{ color: isToday ? "var(--accent)" : undefined }}>
                          {isToday && "→ "}{dayNames[row.day_of_week]}
                        </strong>
                        <span className="muted font-mono" style={{ fontSize: "var(--text-xs)" }}>
                          {row.start_time} – {row.end_time}
                        </span>
                      </div>
                      {isToday ? (
                        <span className="badge badge-green">Bugün</span>
                      ) : (
                        <span className="badge badge-neutral">
                          {row.end_time.split(":")[0] !== row.start_time.split(":")[0]
                            ? `${Math.abs(parseInt(row.end_time) - parseInt(row.start_time))}s`
                            : ""}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* ── Attendance History ── */}
      <section aria-labelledby="history-heading">
        <div className="section-title">
          <h2 id="history-heading">Son Yoklama Kayıtları</h2>
          <span className="badge badge-neutral">{myAttendance.length}</span>
        </div>
        <div className="card">
          {myAttendance.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🕐</span>
              <p>Henüz yoklama kaydınız yok.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Giriş</th>
                    <th>Çıkış</th>
                    <th>Süre</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {myAttendance.map((row, i) => (
                    <tr key={`${row.check_in_at}-${i}`}>
                      <td className="font-mono text-sm">{formatDateTime(row.check_in_at)}</td>
                      <td className="font-mono text-sm">
                        {row.check_out_at ? formatDateTime(row.check_out_at) : <span className="subtle">—</span>}
                      </td>
                      <td className="text-sm">{duration(row.check_in_at, row.check_out_at)}</td>
                      <td>
                        {row.check_out_at ? (
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
        </div>
      </section>
      {/* ── Change Password ── */}
      <details
        style={{
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <summary
          style={{
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
          }}
        >
          <span>Şifre Değiştir</span>
          <span style={{ color: "var(--ink-muted)" }}>▾</span>
        </summary>
        <div style={{ padding: "var(--sp-4)", borderTop: "1px solid var(--border)" }}>
          <ChangePasswordForm />
        </div>
      </details>
    </main>
  );
}
