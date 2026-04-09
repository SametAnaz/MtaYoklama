"use client";

import { useActionState } from "react";
import { assignShiftAction, type ActionResult } from "@/app/admin/_actions/actions";

const initial: ActionResult = {};

type Shift = { id: number; title: string; starts_at: string };
type Staff = { id: string; full_name: string; identity_no: string };

type Props = {
  shifts: Shift[];
  staff: Staff[];
};

export function AssignShiftForm({ shifts, staff }: Props) {
  const [state, formAction, isPending] = useActionState(assignShiftAction, initial);

  return (
    <form className="stack" action={formAction} aria-label="Vardiya atama formu">
      {state.error ? (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>⚠</span>
          <span>{state.error}</span>
        </div>
      ) : null}
      {state.ok ? (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>✓</span>
          <span>Personel vardiyaya atandı.</span>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "var(--sp-3)",
          gridTemplateColumns: "1fr 1fr auto",
          alignItems: "end",
        }}
      >
        <div className="field">
          <label htmlFor="assign-shiftId">Vardiya</label>
          <select id="assign-shiftId" name="shiftId" required defaultValue="">
            <option value="" disabled>
              Vardiya seçin
            </option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.title} (
                {new Date(shift.starts_at).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "short",
                })}
                )
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="assign-userId">Personel</label>
          <select id="assign-userId" name="userId" required defaultValue="">
            <option value="" disabled>
              Personel seçin
            </option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name} — {member.identity_no}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={isPending} style={{ height: "fit-content" }}>
          {isPending ? "Atanıyor..." : "Ata"}
        </button>
      </div>
    </form>
  );
}
