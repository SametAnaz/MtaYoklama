"use client";

import { useActionState, useState } from "react";
import { resetStaffPasswordAction, type ChangePasswordState } from "@/app/_actions/password-actions";

type Staff = { id: string; full_name: string };

const init: ChangePasswordState = {};

export function ResetStaffPasswordForm({ staff }: { staff: Staff[] }) {
  const [state, action, isPending] = useActionState(resetStaffPasswordAction, init);
  const [selectedId, setSelectedId] = useState("");

  return (
    <form action={action} className="stack" noValidate>
      {state.error && (
        <div className="alert alert-error" role="alert">
          <span>{state.error}</span>
        </div>
      )}
      {state.ok && (
        <div className="alert alert-success" role="status">
          <span>
            {staff.find((s) => s.id === selectedId)?.full_name ?? "Personel"} için şifre sıfırlandı.
          </span>
        </div>
      )}

      <input type="hidden" name="staffId" value={selectedId} />

      <div className="field">
        <label htmlFor="reset-staff-select">Personel</label>
        <select
          id="reset-staff-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isPending}
        >
          <option value="">— Personel seçin —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="reset-newPassword">Yeni Şifre</label>
        <input
          id="reset-newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="En az 6 karakter"
          disabled={isPending}
        />
      </div>

      <div className="field">
        <label htmlFor="reset-confirmPassword">Şifre Tekrar</label>
        <input
          id="reset-confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="Tekrar girin"
          disabled={isPending}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={isPending || !selectedId}
          style={{ minWidth: "10rem", opacity: !selectedId ? 0.5 : 1 }}
        >
          {isPending ? "Sıfırlanıyor…" : "Şifreyi Sıfırla"}
        </button>
      </div>
    </form>
  );
}
