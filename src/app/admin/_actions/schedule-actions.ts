"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export type DaySchedule = {
  dayOfWeek: number; // 0=Pazar, 1=Pzt, 2=Sal, 3=Çar, 4=Per, 5=Cum, 6=Cmt
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  enabled: boolean;
};

export type SaveScheduleResult = {
  ok?: boolean;
  error?: string;
};

export async function saveUserScheduleAction(
  userId: string,
  days: DaySchedule[],
): Promise<SaveScheduleResult> {
  try {
    const admin = await requireRole("admin");

    const target = db
      .prepare("SELECT full_name FROM users WHERE id = ? AND role = 'staff' LIMIT 1")
      .get(userId) as { full_name: string } | undefined;

    if (!target) return { error: "Personel bulunamadı." };

    const enabledDays = days.filter((d) => d.enabled);

    // ── Rule: max 3 days per week
    if (enabledDays.length > 3) {
      return {
        error: `Haftalık maksimum 3 çalışma günü atanabilir. Şu an ${enabledDays.length} gün seçildi.`,
      };
    }

    // ── Validate time format and ordering
    for (const d of enabledDays) {
      if (!/^\d{2}:\d{2}$/.test(d.startTime) || !/^\d{2}:\d{2}$/.test(d.endTime)) {
        return { error: "Geçersiz saat formatı. SS:DD şeklinde girin." };
      }
      if (d.startTime >= d.endTime) {
        return { error: `Bitiş saati, başlangıçtan büyük olmalıdır (${d.startTime} ≥ ${d.endTime}).` };
      }
    }

    // ── Rule: max 22.5 hours (1350 dk) per week
    const totalMinutes = enabledDays.reduce((sum, d) => {
      const [sh, sm] = d.startTime.split(":").map(Number);
      const [eh, em] = d.endTime.split(":").map(Number);
      return sum + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);

    const MAX_WEEKLY_MINUTES = 22.5 * 60; // 1350
    if (totalMinutes > MAX_WEEKLY_MINUTES) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return {
        error: `Haftalık maksimum 22.5 saat çalışılabilir. Seçilen toplam: ${h}s ${m}dk.`,
      };
    }

    // Transaction: delete all days for user, then insert enabled days
    const del = db.prepare("DELETE FROM user_schedules WHERE user_id = ?");
    const ins = db.prepare(
      "INSERT INTO user_schedules (user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)",
    );

    db.transaction(() => {
      del.run(userId);
      for (const d of enabledDays) {
        ins.run(userId, d.dayOfWeek, d.startTime, d.endTime);
      }
    })();

    const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    const summary = enabledDays.map((d) => `${dayNames[d.dayOfWeek]} ${d.startTime}-${d.endTime}`).join(", ");

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "UPDATE_SCHEDULE",
      target: target.full_name,
      detail: enabledDays.length > 0 ? summary : "Tüm günler temizlendi",
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Program kaydedilemedi." };
  }
}
