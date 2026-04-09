"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, type ChangePasswordState } from "@/app/_actions/password-actions";

const init: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, action, isPending] = useActionState(changeOwnPasswordAction, init);

  return (
    <form action={action} className="stack" noValidate>
      {state.error && (
        <div className="alert alert-error" role="alert">
          <span>{state.error}</span>
        </div>
      )}
      {state.ok && (
        <div className="alert alert-success" role="status">
          <span>Şifreniz başarıyla güncellendi.</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="currentPassword">Mevcut Şifre</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••"
          disabled={isPending}
        />
      </div>

      <div className="field">
        <label htmlFor="newPassword">Yeni Şifre</label>
        <input
          id="newPassword"
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
        <label htmlFor="confirmPassword">Yeni Şifre Tekrar</label>
        <input
          id="confirmPassword"
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
        <button type="submit" disabled={isPending} style={{ minWidth: "10rem" }}>
          {isPending ? "Kaydediliyor…" : "Şifreyi Güncelle"}
        </button>
      </div>
    </form>
  );
}
