"use client";

import { deleteShiftAction, toggleStaffActiveAction } from "@/app/admin/_actions/actions";
import { useState, useTransition } from "react";

/* ─── Shift Delete Button ─── */
type ShiftDeleteProps = {
  shiftId: number;
  shiftTitle: string;
};

export function ShiftDeleteButton({ shiftId, shiftTitle }: ShiftDeleteProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`"${shiftTitle}" vardiyasını silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteShiftAction(shiftId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      {error ? (
        <p className="error-text" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--sp-1)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="danger sm"
        disabled={isPending}
        onClick={handleDelete}
        aria-label={`${shiftTitle} vardiyasını sil`}
      >
        {isPending ? "Siliniyor..." : "Sil"}
      </button>
    </div>
  );
}

/* ─── Staff Toggle Button ─── */
type StaffToggleProps = {
  userId: string;
  fullName: string;
  isActive: boolean;
};

export function StaffToggleButton({ userId, fullName, isActive }: StaffToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [localActive, setLocalActive] = useState(isActive);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !localActive;
    const verb = next ? "aktifleştirmek" : "pasifleştirmek";
    if (!confirm(`${fullName} kullanıcısını ${verb} istiyor musunuz?`)) return;

    setError(null);
    startTransition(async () => {
      const result = await toggleStaffActiveAction(userId, next);
      if (result.ok) {
        setLocalActive(next);
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {error ? (
        <p className="error-text" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--sp-1)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={localActive ? "ghost sm" : "sm"}
        disabled={isPending}
        onClick={handleToggle}
        aria-label={`${fullName} kullanıcısını ${localActive ? "pasifleştir" : "aktifleştir"}`}
      >
        {isPending ? "..." : localActive ? "Pasifleştir" : "Aktifleştir"}
      </button>
    </div>
  );
}
