"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const RFID_API = process.env.RFID_API_URL ?? "http://localhost:8001";

export type RfidActionState = {
  ok?: boolean;
  error?: string;
  card?: CardRecord;
  requiresRegistration?: boolean;
};

export type CardRecord = {
  id: number;
  uid: string;
  first_name: string;
  last_name: string;
  tc_no: string;
  created_at: string;
};

export async function getCardByTc(tcNo: string): Promise<CardRecord | null> {
  try {
    const res = await fetch(`${RFID_API}/cards/by-tc/${encodeURIComponent(tcNo)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as CardRecord;
  } catch {
    return null;
  }
}

export async function waitForCardUid(timeoutMs = 75_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${RFID_API}/scan`, {
      method: "POST",
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail ?? "Kart okutulamadı.");
    }

    const data = (await res.json()) as { uid?: string };
    if (!data.uid) {
      throw new Error("Kart UID alınamadı.");
    }

    return data.uid;
  } finally {
    clearTimeout(timer);
  }
}

/* ─── List all cards ─── */
export async function getCards(): Promise<CardRecord[]> {
  try {
    const res = await fetch(`${RFID_API}/cards`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    return (await res.json()) as CardRecord[];
  } catch {
    return [];
  }
}

/* ─── Check RFID service health ─── */
export async function checkRfidHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RFID_API}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── Register a new card (blocks until card is scanned!) ─── */
export async function registerCardAction(
  _prev: RfidActionState,
  formData: FormData,
): Promise<RfidActionState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") {
    return { error: "Yönetici yetkisi gereklidir." };
  }

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name  = String(formData.get("last_name")  ?? "").trim();
  const tc_no      = String(formData.get("tc_no")      ?? "").trim();

  if (!first_name || !last_name || !tc_no) {
    return { error: "Tüm alanlar zorunludur." };
  }
  if (!/^\d{11}$/.test(tc_no)) {
    return { error: "TC kimlik numarası 11 haneli rakamdan oluşmalıdır." };
  }

  try {
    const controller = new AbortController();
    // 75 saniye timeout — kart okutulması için yeterli süre
    const timer = setTimeout(() => controller.abort(), 75_000);

    let res: Response;
    try {
      res = await fetch(`${RFID_API}/cards/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name, last_name, tc_no }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json();

    if (!res.ok) {
      const msg: string =
        data?.detail ?? data?.message ?? "Kart kaydedilemedi.";
      return { error: msg };
    }

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "RFID_CARD_REGISTERED",
      target: `${first_name} ${last_name}`,
      detail: `UID: ${data.uid ?? "?"}, TC: ${tc_no}`,
    });

    return { ok: true, card: data as CardRecord };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "Süre doldu. Kart 75 saniye içinde okutulmadı." };
    }
    return { error: "RFID servisine bağlanılamadı. Servisin çalıştığından emin olun." };
  }
}

export async function registerCurrentUserCardAction(
  _prev: RfidActionState,
  _formData: FormData,
): Promise<RfidActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") {
    return { error: "Personel yetkisi gereklidir." };
  }

  const existingCard = await getCardByTc(user.identity_no);
  if (existingCard) {
    return { ok: true, card: existingCard };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75_000);

    try {
      const res = await fetch(`${RFID_API}/cards/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: user.full_name, tc_no: user.identity_no }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data?.detail ?? data?.message ?? "Kart kaydedilemedi." };
      }

      writeAudit({
        actorId: user.id,
        actorName: user.full_name,
        action: "RFID_CARD_REGISTERED_SELF",
        detail: `UID: ${data.uid ?? "?"}, TC: ${user.identity_no}`,
      });

      revalidatePath("/dashboard");
      return { ok: true, card: data as CardRecord };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "Süre doldu. Kart 75 saniye içinde okutulmadı." };
    }
    return { error: "RFID servisine bağlanılamadı. Servisin çalıştığından emin olun." };
  }
}

/* ─── Delete a card ─── */
export async function deleteCardAction(uid: string): Promise<RfidActionState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") {
    return { error: "Yönetici yetkisi gereklidir." };
  }

  try {
    const res = await fetch(`${RFID_API}/cards/${encodeURIComponent(uid)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data?.detail ?? "Kart silinemedi." };
    }

    writeAudit({
      actorId: admin.id,
      actorName: admin.full_name,
      action: "RFID_CARD_DELETED",
      detail: `UID: ${uid}`,
    });

    return { ok: true };
  } catch {
    return { error: "RFID servisine bağlanılamadı." };
  }
}
