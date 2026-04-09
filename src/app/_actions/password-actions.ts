"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export type ChangePasswordState = {
  ok?: boolean;
  error?: string;
};

/* ─────────────────────────────────────────────────────────────
   changeOwnPasswordAction
   Mevcut kullanıcı kendi şifresini değiştirir.
   Hem staff hem admin kullanabilir.
───────────────────────────────────────────────────────────────*/
export async function changeOwnPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const currentPw  = String(formData.get("currentPassword")  ?? "").trim();
    const newPw      = String(formData.get("newPassword")      ?? "").trim();
    const confirmPw  = String(formData.get("confirmPassword")  ?? "").trim();

    if (!currentPw || !newPw || !confirmPw) {
      return { error: "Tüm alanlar zorunludur." };
    }
    if (newPw.length < 6) {
      return { error: "Yeni şifre en az 6 karakter olmalıdır." };
    }
    if (newPw !== confirmPw) {
      return { error: "Yeni şifre ile tekrarı uyuşmuyor." };
    }

    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1")
      .get(user.id) as { password_hash: string } | undefined;

    if (!row || !bcrypt.compareSync(currentPw, row.password_hash)) {
      return { error: "Mevcut şifre hatalı." };
    }

    const hash = bcrypt.hashSync(newPw, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);

    writeAudit({
      actorId: user.id,
      actorName: user.full_name,
      action: "CHANGE_PASSWORD",
      target: user.full_name,
      detail: "Şifre başarıyla değiştirildi.",
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Şifre değiştirilemedi." };
  }
}

/* ─────────────────────────────────────────────────────────────
   resetStaffPasswordAction
   Admin, herhangi bir personelin şifresini sıfırlar.
   Mevcut şifre gerekmez.
───────────────────────────────────────────────────────────────*/
export async function resetStaffPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "admin") {
      return { error: "Bu işlem için yönetici yetkisi gereklidir." };
    }

    const staffId = String(formData.get("staffId") ?? "").trim();
    const newPw   = String(formData.get("newPassword")     ?? "").trim();
    const confirmPw = String(formData.get("confirmPassword") ?? "").trim();

    if (!staffId) return { error: "Personel seçilmedi." };
    if (!newPw || !confirmPw) return { error: "Tüm alanlar zorunludur." };
    if (newPw.length < 6)  return { error: "Yeni şifre en az 6 karakter olmalıdır." };
    if (newPw !== confirmPw) return { error: "Şifreler uyuşmuyor." };

    const target = db
      .prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1")
      .get(staffId) as { full_name: string } | undefined;

    if (!target) return { error: "Personel bulunamadı." };

    const hash = bcrypt.hashSync(newPw, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, staffId);

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "RESET_STAFF_PASSWORD",
      target: target.full_name,
      detail: "Yönetici tarafından şifre sıfırlandı.",
    });

    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Şifre sıfırlanamadı." };
  }
}
