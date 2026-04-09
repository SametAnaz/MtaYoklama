"use client";

import { useActionState } from "react";
import { checkInAction, checkOutAction, type CheckActionState } from "@/app/dashboard/_actions/actions";

const initial: CheckActionState = {};

type TodaySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
} | null;

type Props = {
  hasOpenLog: boolean;
  todaySchedule: TodaySchedule;
};

export function AttendancePanel({ hasOpenLog, todaySchedule }: Props) {
  const [inState, inAction, inPending] = useActionState(checkInAction, initial);
  const [outState, outAction, outPending] = useActionState(checkOutAction, initial);

  const isOpen = inState.ok ? true : outState.ok ? false : hasOpenLog;

  return (
    <div className="stack">
      {/* Status strip */}
      <div className={`status-strip ${isOpen ? "open" : "closed"}`} role="status" aria-live="polite">
        <span className={`status-dot ${isOpen ? "live" : "idle"}`} aria-hidden="true" />
        <span>
          {isOpen
            ? "Açık yoklama — giriş yapıldı"
            : todaySchedule
            ? `Bugün ${todaySchedule.start_time} – ${todaySchedule.end_time} arası çalışma günü`
            : "Yoklama başlatılmamış"}
        </span>
      </div>

      {/* Errors */}
      {(inState.error || outState.error) && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>⚠</span>
          <span>{inState.error ?? outState.error}</span>
        </div>
      )}

      {/* Success */}
      {(inState.ok || outState.ok) && (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>✓</span>
          <span>{inState.ok ? "Giriş kaydedildi." : "Çıkış kaydedildi."}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="cluster">
        <form action={inAction}>
          <button
            type="submit"
            disabled={isOpen || inPending || outPending}
            aria-label="Yoklamaya giriş yap"
          >
            {inPending ? <><Spinner /> Kaydediliyor…</> : "✓ Giriş Yap"}
          </button>
        </form>

        <form action={outAction}>
          <button
            type="submit"
            className="ghost"
            disabled={!isOpen || inPending || outPending}
            aria-label="Yoklamadan çıkış yap"
          >
            {outPending ? <><Spinner dark /> Kaydediliyor…</> : "✗ Çıkış Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "0.875em",
        height: "0.875em",
        border: `2px solid ${dark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.3)"}`,
        borderTopColor: dark ? "var(--ink)" : "#fff",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}
