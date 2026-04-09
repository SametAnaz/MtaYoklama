"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form className="card stack" action={formAction} aria-label="Giriş formu" noValidate>
      <div className="field">
        <label htmlFor="identityNo">Kurumsal Kimlik No</label>
        <input
          id="identityNo"
          name="identityNo"
          type="text"
          inputMode="numeric"
          minLength={6}
          maxLength={11}
          required
          placeholder="Örn: 12345678901"
          autoComplete="username"
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Şifre</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder="Şifrenizi girin"
          autoComplete="current-password"
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>

      {state.error ? (
        <div id="login-error" className="alert alert-error" role="alert" aria-live="polite">
          <span>⚠</span>
          <span>{state.error}</span>
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className="w-full" style={{ padding: "0.8rem" }}>
        {isPending ? (
          <>
            <span aria-hidden="true" style={{ display: "inline-block", width: "1em", height: "1em", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            Giriş yapılıyor...
          </>
        ) : (
          "Giriş Yap"
        )}
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
