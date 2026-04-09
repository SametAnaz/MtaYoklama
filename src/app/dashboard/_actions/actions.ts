"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type CheckActionState = {
  ok?: boolean;
  error?: string;
};

export async function checkInAction(
  _prevState: CheckActionState,
  _formData: FormData,
): Promise<CheckActionState> {
  try {
    const staff = await requireRole("staff");

    const openLog = db
      .prepare(
        "SELECT id FROM attendance_logs WHERE user_id = ? AND check_out_at IS NULL LIMIT 1",
      )
      .get(staff.id) as { id: number } | undefined;

    if (openLog) {
      return { error: "Zaten açık bir yoklama kaydınız var. Önce çıkış yapın." };
    }

    db.prepare(
      "INSERT INTO attendance_logs (user_id, shift_id, check_in_at, source) VALUES (?, NULL, ?, 'web')",
    ).run(staff.id, new Date().toISOString());

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Giriş kaydedilemedi." };
  }
}

export async function checkOutAction(
  _prevState: CheckActionState,
  _formData: FormData,
): Promise<CheckActionState> {
  try {
    const staff = await requireRole("staff");

    const openLog = db
      .prepare(
        "SELECT id FROM attendance_logs WHERE user_id = ? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1",
      )
      .get(staff.id) as { id: number } | undefined;

    if (!openLog) {
      return { error: "Çıkış yapacak açık bir yoklama kaydı bulunamadı." };
    }

    db.prepare("UPDATE attendance_logs SET check_out_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      openLog.id,
    );

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Çıkış kaydedilemedi." };
  }
}
