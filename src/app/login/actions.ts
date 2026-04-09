"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { normalizeIdentityNo } from "@/lib/auth";
import { db, type AppRole } from "@/lib/db";
import { createSession } from "@/lib/session";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identityNo = normalizeIdentityNo(
    String(formData.get("identityNo") ?? "").trim(),
  );
  const password = String(formData.get("password") ?? "");

  if (!identityNo || !password) {
    return { error: "Kimlik numarası ve şifre zorunludur." };
  }

  // ── Rate limit check ──
  const limit = checkRateLimit(identityNo);
  if (!limit.allowed) {
    return {
      error: `Çok fazla başarısız deneme. ${limit.retryAfterMinutes} dakika sonra tekrar deneyiniz.`,
    };
  }

  const user = db
    .prepare(
      "SELECT id, role, password_hash, is_active FROM users WHERE identity_no = ? LIMIT 1",
    )
    .get(identityNo) as
    | {
        id: string;
        role: AppRole;
        password_hash: string;
        is_active: number;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordAttempt(identityNo, false);
    return { error: "Kimlik no veya şifre hatalı." };
  }

  if (!user.is_active) {
    recordAttempt(identityNo, false);
    return { error: "Hesabınız pasife alınmıştır. Yöneticinizle iletişime geçin." };
  }

  recordAttempt(identityNo, true);

  writeAudit({
    actorId: user.id,
    actorName: identityNo,
    action: "LOGIN",
    detail: `Role: ${user.role}`,
  });

  await createSession(user.id);

  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
