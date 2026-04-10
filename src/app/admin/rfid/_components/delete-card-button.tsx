"use client";

import { useTransition } from "react";
import { deleteCardAction } from "../_actions/rfid-actions";
import { useRouter } from "next/navigation";

export function DeleteCardButton({ uid, name }: { uid: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`"${name}" adlı kişinin kartı (${uid}) silinecek. Emin misiniz?`)) return;
    startTransition(async () => {
      const res = await deleteCardAction(uid);
      if (res.ok) {
        router.refresh();
      } else {
        alert(res.error ?? "Kart silinemedi.");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      style={{
        background: "transparent",
        border: "1.5px solid var(--error)",
        color: "var(--error)",
        borderRadius: "var(--radius-sm)",
        padding: "0.25rem 0.625rem",
        fontSize: "var(--text-sm)",
        cursor: isPending ? "wait" : "pointer",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {isPending ? "Siliniyor…" : "Sil"}
    </button>
  );
}
