"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  checkOutAction,
  startShiftAction,
  type CheckActionState,
} from "@/app/dashboard/_actions/actions";
import {
  registerCurrentUserCardAction,
  type CardRecord,
  type RfidActionState,
} from "@/app/admin/rfid/_actions/rfid-actions";

const initial: CheckActionState = {};
const registerInitial: RfidActionState = {};

type TodaySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
} | null;

type Props = {
  hasOpenLog: boolean;
  todaySchedule: TodaySchedule;
  currentCard: CardRecord | null;
  fullName: string;
  identityNo: string;
};

export function AttendancePanel({
  hasOpenLog,
  todaySchedule,
  currentCard,
  fullName,
  identityNo,
}: Props) {
  const router = useRouter();
  const [registerState, registerAction, registerPending] = useActionState(
    registerCurrentUserCardAction,
    registerInitial,
  );
  const [inState, inAction, inPending] = useActionState(startShiftAction, initial);
  const [outState, outAction, outPending] = useActionState(checkOutAction, initial);

  useEffect(() => {
    if (registerState.ok || inState.ok || outState.ok) {
      router.refresh();
    }
  }, [registerState.ok, inState.ok, outState.ok, router]);

  const effectiveCard = registerState.card ?? currentCard;
  const isOpen = inState.ok ? true : outState.ok ? false : hasOpenLog;
  const needsCardRegistration = !effectiveCard;

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

      {/* Card state */}
      <div
        style={{
          padding: "var(--sp-4)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
        }}
      >
        <div className="section-title" style={{ marginBottom: "var(--sp-3)" }}>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)" }}>RFID Kart Durumu</h3>
          <span className={`badge ${effectiveCard ? "badge-green" : "badge-neutral"}`}>
            {effectiveCard ? "Kayıtlı" : "Kayıt gerekli"}
          </span>
        </div>

        {effectiveCard ? (
          <div className="stack" style={{ gap: "var(--sp-2)" }}>
            <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
              Kartınız sistemde kayıtlı. Mesai başlatmak için butona basın, sonra kartınızı okuyucuya
              okutun.
            </div>
            <div className="grid-two" style={{ gap: "var(--sp-3)" }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Ad Soyad</label>
                <input value={fullName} readOnly disabled />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>TC Kimlik No</label>
                <input value={identityNo} readOnly disabled />
              </div>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Kart UID</label>
              <input value={effectiveCard.uid} readOnly disabled />
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="alert alert-error" role="alert">
              <span>⚠</span>
              <span>TC kimlik numaranıza kayıtlı RFID kart bulunamadı. Önce kartı kaydedin.</span>
            </div>
            <form action={registerAction} className="stack" aria-label="RFID kart kayıt formu">
              <div className="grid-two" style={{ gap: "var(--sp-3)" }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Ad Soyad</label>
                  <input value={fullName} readOnly disabled />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>TC Kimlik No</label>
                  <input value={identityNo} readOnly disabled />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={registerPending} style={{ minWidth: "14rem" }}>
                  {registerPending ? "Kart okutuluyor…" : "Kartı Kaydet"}
                </button>
              </div>
            </form>
          </div>
        )}

        {registerState.error && (
          <div className="alert alert-error" role="alert" style={{ marginTop: "var(--sp-3)" }}>
            <span>⚠</span>
            <span>{registerState.error}</span>
          </div>
        )}

        {registerState.ok && registerState.card && (
          <div className="alert alert-success" role="status" style={{ marginTop: "var(--sp-3)" }}>
            <span>✓</span>
            <span>Kart başarıyla kaydedildi — UID: <strong>{registerState.card.uid}</strong></span>
          </div>
        )}
      </div>

      {effectiveCard && (
        <div className="alert" role="status" style={{ background: "var(--accent-light)" }}>
          <span>ℹ</span>
          <span>
            Mesaiyi başlatmak için <strong>Mesaiyi Başlat</strong> butonuna basın, sonra RFID kartınızı okutun.
          </span>
        </div>
      )}

      {/* Errors */}
      {(inState.error || outState.error) && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>⚠</span>
          <span>{inState.error ?? outState.error}</span>
        </div>
      )}

      {inState.requiresRegistration && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>⚠</span>
          <span>
            {inState.error ?? "RFID kartı bulunamadı. Önce kartınızı kaydedin."}
          </span>
        </div>
      )}

      {/* Success */}
      {(inState.ok || outState.ok) && (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>✓</span>
          <span>{inState.ok ? "Mesai başlatıldı." : "Çıkış kaydedildi."}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="cluster">
        <form action={inAction}>
          <button
            type="submit"
            disabled={needsCardRegistration || isOpen || inPending || outPending}
            aria-label="Mesai başlat"
          >
            {inPending ? <><Spinner /> Kart okutun…</> : "✓ Mesaiyi Başlat"}
          </button>
        </form>

        <form action={outAction}>
          <button
            type="submit"
            className="ghost"
            disabled={!isOpen || inPending || outPending}
            aria-label="Mesai sonlandır"
          >
            {outPending ? <><Spinner dark /> Kaydediliyor…</> : "✗ Çıkış Yap"}
          </button>
        </form>
      </div>

      {todaySchedule && isOpen && (
        <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
          Planlı vardiya: {todaySchedule.start_time} – {todaySchedule.end_time}. Süre dolunca oturum otomatik sonlandırılır.
        </div>
      )}
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
