"use client";

import { useActionState } from "react";
import { registerCardAction, type RfidActionState } from "../_actions/rfid-actions";

const init: RfidActionState = {};

export function RegisterCardForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, isPending] = useActionState(async (prev: RfidActionState, fd: FormData) => {
    const result = await registerCardAction(prev, fd);
    if (result.ok && onSuccess) onSuccess();
    return result;
  }, init);

  return (
    <div style={{ position: "relative" }}>
      {/* "Kartı okutun" overlay — action çalışırken gösterilir */}
      {isPending && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-4)",
            padding: "var(--sp-6)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "4px solid var(--accent)",
              borderTopColor: "transparent",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <p style={{ fontWeight: 600, fontSize: "var(--text-lg)", color: "var(--ink)" }}>
            Kartı RFID okuyucuya okutun
          </p>
          <p className="muted" style={{ textAlign: "center", fontSize: "var(--text-sm)" }}>
            Form bilgileri gönderildi. Fiziksel kartı okuyucuya yaklaştırın.
            <br />Süre sınırı: 75 saniye
          </p>
        </div>
      )}

      <form action={action} className="stack">
        {state.error && (
          <div className="alert alert-error" role="alert">
            {state.error}
          </div>
        )}
        {state.ok && state.card && (
          <div className="alert alert-success" role="status">
            Kart başarıyla kaydedildi — UID: <strong>{state.card.uid}</strong>
          </div>
        )}

        <div className="grid-two" style={{ gap: "var(--sp-3)" }}>
          <div className="field">
            <label htmlFor="rfid-first-name">Ad</label>
            <input
              id="rfid-first-name"
              name="first_name"
              type="text"
              placeholder="Ali"
              required
              disabled={isPending}
            />
          </div>
          <div className="field">
            <label htmlFor="rfid-last-name">Soyad</label>
            <input
              id="rfid-last-name"
              name="last_name"
              type="text"
              placeholder="Yılmaz"
              required
              disabled={isPending}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="rfid-tc">TC Kimlik No</label>
          <input
            id="rfid-tc"
            name="tc_no"
            type="text"
            placeholder="12345678901"
            maxLength={11}
            pattern="[0-9]{11}"
            required
            disabled={isPending}
          />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: "var(--sp-1)" }}>
            11 haneli TC kimlik numarası
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={isPending}
            style={{ minWidth: "12rem" }}
          >
            {isPending ? "Kart bekleniyor…" : "Kart Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
