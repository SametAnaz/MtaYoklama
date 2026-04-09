"use client";

import { useActionState } from "react";
import { createShiftAction, type ActionResult } from "@/app/admin/_actions/actions";

const initial: ActionResult = {};

export function CreateShiftForm() {
  const [state, formAction, isPending] = useActionState(createShiftAction, initial);

  return (
    <form className="stack" action={formAction} aria-label="Vardiya oluşturma formu" noValidate>
      {state.error ? (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>⚠</span>
          <span>{state.error}</span>
        </div>
      ) : null}
      {state.ok ? (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>✓</span>
          <span>Vardiya başarıyla oluşturuldu.</span>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="shift-title">Vardiya Başlığı</label>
        <input
          id="shift-title"
          name="title"
          type="text"
          required
          placeholder="Örn: Sabah Vardiyası"
          autoComplete="off"
        />
      </div>
      <div className="grid-two">
        <div className="field">
          <label htmlFor="shift-startsAt">Başlangıç</label>
          <input id="shift-startsAt" name="startsAt" type="datetime-local" required />
        </div>
        <div className="field">
          <label htmlFor="shift-endsAt">Bitiş</label>
          <input id="shift-endsAt" name="endsAt" type="datetime-local" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="shift-repeatRule">Tekrar Kuralı <span className="subtle">(opsiyonel)</span></label>
        <input
          id="shift-repeatRule"
          name="repeatRule"
          type="text"
          placeholder="FREQ=WEEKLY;BYDAY=MO,TU"
        />
      </div>

      <button type="submit" disabled={isPending} style={{ marginTop: "var(--sp-1)" }}>
        {isPending ? (
          <>
            <Spinner />
            Kaydediliyor...
          </>
        ) : (
          "+ Vardiyayı Kaydet"
        )}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "0.875em",
        height: "0.875em",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}
