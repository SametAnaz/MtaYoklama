"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCardByTc, waitForCardUid } from "@/app/admin/rfid/_actions/rfid-actions";

export type CheckActionState = {
  ok?: boolean;
  error?: string;
  requiresRegistration?: boolean;
};

type DailySchedule = {
  start_time: string;
  end_time: string;
};

function buildLocalIso(date: Date, time: string) {
  const [hours, minutes, seconds = "0"] = time.split(":");
  const copy = new Date(date);
  copy.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return copy.toISOString();
}

function getTodaySchedule(userId: string, dayOfWeek: number) {
  return db
    .prepare(
      "SELECT start_time, end_time FROM user_schedules WHERE user_id = ? AND day_of_week = ? LIMIT 1",
    )
    .get(userId, dayOfWeek) as DailySchedule | undefined;
}

export async function startShiftAction(
  _prevState: CheckActionState,
  _formData: FormData,
): Promise<CheckActionState> {
  try {
    const staff = await requireRole("staff");

    const card = await getCardByTc(staff.identity_no);
    if (!card) {
      return {
        error: "TC kimlik numaranıza kayıtlı RFID kart bulunamadı. Önce kartınızı kaydedin.",
        requiresRegistration: true,
      };
    }

    const todayDow = new Date().getDay();
    const todaySchedule = getTodaySchedule(staff.id, todayDow);

    if (!todaySchedule) {
      return { error: "Bugün için vardiya tanımlı değil." };
    }

    const scannedUid = await waitForCardUid();
    if (scannedUid !== card.uid) {
      return { error: "Okutulan kart sizin kayıtlı kartınızla eşleşmedi." };
    }

    const openLog = db
      .prepare(
        "SELECT id FROM attendance_logs WHERE user_id = ? AND check_out_at IS NULL LIMIT 1",
      )
      .get(staff.id) as { id: number } | undefined;

    if (openLog) {
      return { error: "Zaten açık bir yoklama kaydınız var. Önce çıkış yapın." };
    }

    const scheduledEndAt = buildLocalIso(new Date(), todaySchedule.end_time);

    db.prepare(
      "INSERT INTO attendance_logs (user_id, shift_id, check_in_at, scheduled_end_at, source) VALUES (?, NULL, ?, ?, 'rfid')",
    ).run(staff.id, new Date().toISOString(), scheduledEndAt);

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Giriş kaydedilemedi." };
  }
}

export const checkInAction = startShiftAction;

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
