"use client";

import { useState, useCallback, useTransition } from "react";
import { saveUserScheduleAction, type DaySchedule } from "@/app/admin/_actions/schedule-actions";

/* ─── Constants ─── */
const DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Pazartesi", short: "Pzt" },
  { value: 2, label: "Salı",      short: "Sal" },
  { value: 3, label: "Çarşamba",  short: "Çar" },
  { value: 4, label: "Perşembe",  short: "Per" },
  { value: 5, label: "Cuma",      short: "Cum" },
  { value: 6, label: "Cumartesi", short: "Cmt" },
  { value: 0, label: "Pazar",     short: "Paz" },
];

type Staff = { id: string; full_name: string; identity_no: string };

type DayState = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

function blankSchedule(): Record<number, DayState> {
  return Object.fromEntries(
    DAYS.map((d) => [d.value, { enabled: false, startTime: "09:00", endTime: "17:00" }]),
  );
}

export function ScheduleEditor({ staff }: { staff: Staff[] }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [schedule, setSchedule] = useState<Record<number, DayState>>(blankSchedule());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>({});
  const [isPending, startTransition] = useTransition();

  /* ── Load existing schedule when user is selected ── */
  const handleUserChange = useCallback(async (userId: string) => {
    setSelectedId(userId);
    setResult({});

    if (!userId) {
      setSchedule(blankSchedule());
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?userId=${userId}`);
      const data = await res.json() as {
        schedules: { day_of_week: number; start_time: string; end_time: string }[];
      };

      const next = blankSchedule();
      for (const row of data.schedules) {
        next[row.day_of_week] = {
          enabled: true,
          startTime: row.start_time,
          endTime: row.end_time,
        };
      }
      setSchedule(next);
    } catch {
      setResult({ error: "Program yüklenemedi." });
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Toggle a day ── */
  function toggleDay(dayValue: number) {
    setSchedule((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], enabled: !prev[dayValue].enabled },
    }));
  }

  /* ── Change time ── */
  function setTime(dayValue: number, field: "startTime" | "endTime", val: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], [field]: val },
    }));
  }

  /* ── Save ── */
  function handleSave() {
    if (!selectedId) return;
    setResult({});

    const days: DaySchedule[] = DAYS.map((d) => ({
      dayOfWeek: d.value,
      startTime: schedule[d.value].startTime,
      endTime: schedule[d.value].endTime,
      enabled: schedule[d.value].enabled,
    }));

    startTransition(async () => {
      const res = await saveUserScheduleAction(selectedId, days);
      setResult(res);
    });
  }

  const selectedStaff = staff.find((s) => s.id === selectedId);
  const enabledDays = DAYS.filter((d) => schedule[d.value]?.enabled);
  const enabledCount = enabledDays.length;

  /* ── Live limit calculations ── */
  const weeklyMinutes = enabledDays.reduce((sum, d) => {
    const state = schedule[d.value];
    if (!state.enabled) return sum;
    const [sh, sm] = state.startTime.split(":").map(Number);
    const [eh, em] = state.endTime.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return sum + (mins > 0 ? mins : 0);
  }, 0);
  const weeklyHours  = weeklyMinutes / 60;
  const daysOk  = enabledCount <= 3;
  const hoursOk = weeklyHours  <= 22.5;
  const canSave = daysOk && hoursOk;

  return (
    <div className="stack">
      {/* Staff selector */}
      <div className="field">
        <label htmlFor="sched-staff">Personel Seç</label>
        <select
          id="sched-staff"
          value={selectedId}
          onChange={(e) => handleUserChange(e.target.value)}
          disabled={isPending}
        >
          <option value="">— Personel seçin —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} ({s.identity_no})
            </option>
          ))}
        </select>
      </div>

      {/* Schedule Grid */}
      {selectedId && (
        <>
          {/* Header info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--sp-3)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="font-semibold" style={{ color: "var(--ink)" }}>
                {selectedStaff?.full_name}
              </p>
              <p className="text-sm subtle">
                {loading
                  ? "Mevcut program yükleniyor…"
                  : enabledCount > 0
                  ? `${enabledCount} gün aktif · ${weeklyHours % 1 === 0 ? weeklyHours : weeklyHours.toFixed(1)} saat/hafta`
                  : "Hiçbir gün seçilmedi"}
              </p>
            </div>
            {/* Live limit indicator */}
            {!loading && (
              <div
                style={{
                  display: "flex",
                  gap: "var(--sp-3)",
                  padding: "var(--sp-2) var(--sp-3)",
                  borderRadius: "var(--radius-md)",
                  background: (!daysOk || !hoursOk) ? "rgba(239,68,68,0.08)" : "var(--surface-2, var(--surface))",
                  border: `1.5px solid ${(!daysOk || !hoursOk) ? "#ef4444" : "var(--border)"}`,
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  transition: "all var(--transition-base)",
                }}
              >
                <span style={{ color: daysOk ? "var(--accent)" : "#ef4444", fontWeight: 700 }}>
                  {enabledCount}/3 gün
                </span>
                <span style={{ color: "var(--border)" }}>|</span>
                <span style={{ color: hoursOk ? "var(--accent)" : "#ef4444", fontWeight: 700 }}>
                  {weeklyHours % 1 === 0 ? weeklyHours : weeklyHours.toFixed(1)}/22.5 saat
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "var(--sp-6)", color: "var(--ink-muted)" }}>
              <span style={{
                display: "inline-block",
                width: "1.25rem",
                height: "1.25rem",
                border: "2px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }} />
            </div>
          ) : (
            <div role="group" aria-label="Haftalık çalışma planı">
              {DAYS.map((day) => {
                const state = schedule[day.value];
                return (
                  <div
                    key={day.value}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: "var(--sp-3)",
                      padding: "var(--sp-3) var(--sp-4)",
                      borderBottom: "1px solid var(--border-muted)",
                      background: state.enabled ? "var(--accent-light)" : "transparent",
                      transition: "background var(--transition-base)",
                    }}
                  >
                    {/* Day toggle + label */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--sp-3)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      {/* Custom toggle switch */}
                      <span
                        onClick={() => toggleDay(day.value)}
                        role="checkbox"
                        aria-checked={state.enabled}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === " " && (e.preventDefault(), toggleDay(day.value))}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          width: "2.5rem",
                          height: "1.375rem",
                          borderRadius: "var(--radius-full)",
                          background: state.enabled ? "var(--accent)" : "var(--neutral-300)",
                          transition: "background var(--transition-base)",
                          padding: "2px",
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{
                          display: "block",
                          width: "1rem",
                          height: "1rem",
                          borderRadius: "50%",
                          background: "#fff",
                          transform: state.enabled ? "translateX(1.125rem)" : "translateX(0)",
                          transition: "transform var(--transition-base)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "var(--text-sm)",
                          color: state.enabled ? "var(--accent)" : "var(--ink-muted)",
                          minWidth: "5.5rem",
                          transition: "color var(--transition-base)",
                        }}
                      >
                        {day.label}
                      </span>
                    </label>

                    {/* Time pickers */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--sp-2)",
                        opacity: state.enabled ? 1 : 0.3,
                        pointerEvents: state.enabled ? "auto" : "none",
                        transition: "opacity var(--transition-base)",
                      }}
                    >
                      <input
                        type="time"
                        value={state.startTime}
                        onChange={(e) => setTime(day.value, "startTime", e.target.value)}
                        aria-label={`${day.label} başlangıç saati`}
                        style={{
                          padding: "0.375rem 0.5rem",
                          border: "1.5px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-sm)",
                          fontFamily: "var(--font-mono)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          width: "7rem",
                        }}
                      />
                      <span style={{ color: "var(--ink-subtle)", fontWeight: 600 }}>→</span>
                      <input
                        type="time"
                        value={state.endTime}
                        onChange={(e) => setTime(day.value, "endTime", e.target.value)}
                        aria-label={`${day.label} bitiş saati`}
                        style={{
                          padding: "0.375rem 0.5rem",
                          border: "1.5px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-sm)",
                          fontFamily: "var(--font-mono)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          width: "7rem",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Feedback */}
          {result.error && (
            <div className="alert alert-error" role="alert">
              <span>⚠</span>
              <span>{result.error}</span>
            </div>
          )}
          {result.ok && (
            <div className="alert alert-success" role="status">
              <span>✓</span>
              <span>
                {selectedStaff?.full_name} için haftalık program kaydedildi.
                {enabledCount === 0 ? " (Tüm günler temizlendi)" : ` (${enabledCount} çalışma günü)`}
              </span>
            </div>
          )}

          {/* Save button */}
          {!loading && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-3)" }}>
              <button
                type="button"
                className="ghost"
                onClick={() => { setSchedule(blankSchedule()); setResult({}); }}
                disabled={isPending}
              >
                Tümünü Temizle
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !canSave}
                title={!canSave ? "Haftalık limit aşıldı (maks. 3 gün, 22.5 saat)" : undefined}
                style={{ minWidth: "8rem", opacity: !canSave ? 0.5 : 1 }}
              >
                {isPending ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", justifyContent: "center" }}>
                    <span style={{
                      display: "inline-block",
                      width: "0.875rem",
                      height: "0.875rem",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite",
                    }} />
                    Kaydediliyor…
                  </span>
                ) : "Programı Kaydet"}
              </button>
            </div>
          )}
        </>
      )}

      {!selectedId && (
        <div className="empty-state" style={{ padding: "var(--sp-8) var(--sp-4)" }}>
          <span className="empty-state-icon">👆</span>
          <p>Yukarıdan bir personel seçerek çalışma programını düzenleyebilirsiniz.</p>
        </div>
      )}
    </div>
  );
}
