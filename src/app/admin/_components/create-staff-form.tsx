"use client";

import { useActionState } from "react";
import { createStaffAction, type ActionResult } from "@/app/admin/_actions/actions";

const initial: ActionResult = {};

export function CreateStaffForm() {
  const [state, formAction, isPending] = useActionState(createStaffAction, initial);

  return (
    <form className="stack" action={formAction} aria-label="Personel ekleme formu" noValidate>
      {state.error ? (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>⚠</span>
          <span>{state.error}</span>
        </div>
      ) : null}
      {state.ok ? (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>✓</span>
          <span>Personel başarıyla oluşturuldu.</span>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="staff-fullName">Ad Soyad</label>
        <input
          id="staff-fullName"
          name="fullName"
          type="text"
          required
          placeholder="Ahmet Yılmaz"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="staff-identityNo">Kimlik No</label>
        <input
          id="staff-identityNo"
          name="identityNo"
          type="text"
          inputMode="numeric"
          required
          minLength={6}
          maxLength={11}
          placeholder="12345678901"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="staff-password">Geçici Şifre</label>
        <input
          id="staff-password"
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="En az 6 karakter"
          autoComplete="new-password"
        />
      </div>

      <button type="submit" disabled={isPending} style={{ marginTop: "var(--sp-1)" }}>
        {isPending ? (
          <>
            <Spinner />
            Oluşturuluyor...
          </>
        ) : (
          "+ Personel Oluştur"
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
