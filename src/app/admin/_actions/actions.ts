"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export type ActionResult = {
  ok?: boolean;
  error?: string;
};

/* ─── Staff ─── */
export async function createStaffAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const identityNo = String(formData.get("identityNo") ?? "").replace(/\D/g, "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!identityNo || identityNo.length < 6) return { error: "Kimlik numarası en az 6 haneli olmalıdır." };
    if (!fullName) return { error: "Ad Soyad zorunludur." };
    if (password.length < 6) return { error: "Şifre en az 6 karakter olmalıdır." };

    const existing = db.prepare("SELECT id FROM users WHERE identity_no = ? LIMIT 1").get(identityNo) as { id: string } | undefined;
    if (existing) return { error: "Bu kimlik numarası zaten kayıtlı." };

    db.prepare(
      "INSERT INTO users (id, identity_no, full_name, role, password_hash, is_active) VALUES (lower(hex(randomblob(16))), ?, ?, 'staff', ?, 1)",
    ).run(identityNo, fullName, bcrypt.hashSync(password, 10));

    writeAudit({ actorId: admin.id, actorName: admin.full_name, action: "CREATE_STAFF", target: fullName, detail: identityNo });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Personel oluşturulamadı." };
  }
}

export async function toggleStaffActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const target = db.prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1").get(userId) as { full_name: string } | undefined;
    db.prepare("UPDATE users SET is_active = ? WHERE id = ? AND role = 'staff'").run(isActive ? 1 : 0, userId);

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: isActive ? "ACTIVATE_STAFF" : "DEACTIVATE_STAFF",
      target: target?.full_name,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Durum güncellenemedi." };
  }
}

/* ─── Shifts ─── */
export async function createShiftAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const title = String(formData.get("title") ?? "").trim();
    const startsAt = String(formData.get("startsAt") ?? "").trim();
    const endsAt = String(formData.get("endsAt") ?? "").trim();
    const repeatRule = String(formData.get("repeatRule") ?? "").trim();

    if (!title) return { error: "Vardiya başlığı zorunludur." };
    if (!startsAt || !endsAt) return { error: "Başlangıç ve bitiş tarihleri zorunludur." };

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Geçersiz tarih formatı." };
    if (end <= start) return { error: "Bitiş tarihi, başlangıçtan sonra olmalıdır." };

    db.prepare(
      "INSERT INTO shifts (title, starts_at, ends_at, repeat_rule, created_by) VALUES (?, ?, ?, ?, ?)",
    ).run(title, start.toISOString(), end.toISOString(), repeatRule || null, admin.id);

    writeAudit({ actorId: admin.id, actorName: admin.full_name, action: "CREATE_SHIFT", target: title });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Vardiya oluşturulamadı." };
  }
}

export async function updateShiftAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const shiftId = Number(formData.get("shiftId") ?? 0);
    const title = String(formData.get("title") ?? "").trim();
    const startsAt = String(formData.get("startsAt") ?? "").trim();
    const endsAt = String(formData.get("endsAt") ?? "").trim();
    const repeatRule = String(formData.get("repeatRule") ?? "").trim();

    if (!shiftId || !title || !startsAt || !endsAt) return { error: "Tüm alanlar zorunludur." };

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Geçersiz tarih formatı." };
    if (end <= start) return { error: "Bitiş tarihi, başlangıçtan sonra olmalıdır." };

    db.prepare(
      "UPDATE shifts SET title = ?, starts_at = ?, ends_at = ?, repeat_rule = ? WHERE id = ?",
    ).run(title, start.toISOString(), end.toISOString(), repeatRule || null, shiftId);

    writeAudit({ actorId: admin.id, actorName: admin.full_name, action: "UPDATE_SHIFT", target: title, detail: `ID: ${shiftId}` });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Vardiya güncellenemedi." };
  }
}

export async function deleteShiftAction(shiftId: number): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const shift = db.prepare("SELECT title FROM shifts WHERE id = ? LIMIT 1").get(shiftId) as { title: string } | undefined;
    if (!shiftId) return { error: "Geçersiz vardiya ID." };

    db.prepare("DELETE FROM shifts WHERE id = ?").run(shiftId);

    writeAudit({ actorId: admin.id, actorName: admin.full_name, action: "DELETE_SHIFT", target: shift?.title, detail: `ID: ${shiftId}` });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Vardiya silinemedi." };
  }
}

/* ─── Assignment ─── */
export async function assignShiftAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const shiftId = Number(formData.get("shiftId") ?? 0);
    const userId = String(formData.get("userId") ?? "");

    if (!shiftId || !userId) return { error: "Vardiya ve personel seçimi zorunludur." };

    const shift = db.prepare("SELECT title FROM shifts WHERE id = ? LIMIT 1").get(shiftId) as { title: string } | undefined;
    const user = db.prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1").get(userId) as { full_name: string } | undefined;

    db.prepare("INSERT OR IGNORE INTO shift_assignments (shift_id, user_id) VALUES (?, ?)").run(shiftId, userId);

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "ASSIGN_SHIFT",
      target: user?.full_name,
      detail: `Vardiya: ${shift?.title}`,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Atama gerçekleştirilemedi." };
  }
}

/* ─── Session management ─── */
export async function revokeSessionAction(token: string): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");

    const session = db
      .prepare("SELECT s.token, u.full_name FROM sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1")
      .get(token) as { token: string; full_name: string } | undefined;

    if (!session) return { error: "Oturum bulunamadı." };

    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "REVOKE_SESSION",
      target: session.full_name,
    });
    revalidatePath("/admin/sessions");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Oturum sonlandırılamadı." };
  }
}

export async function revokeAllUserSessionsAction(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireRole("admin");
    const user = db.prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1").get(userId) as { full_name: string } | undefined;

    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "REVOKE_ALL_SESSIONS",
      target: user?.full_name,
    });
    revalidatePath("/admin/sessions");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Oturumlar sonlandırılamadı." };
  }
}
