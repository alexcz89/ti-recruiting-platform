// app/dashboard/jobs/[id]/applications/InterestSelect.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";

const LABEL: Record<InterestKey, string> = {
  REVIEW: "En revisión",
  MAYBE: "En duda",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
};

export default function InterestSelect({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: InterestKey;
}) {
  const router = useRouter();
  const [value, setValue] = useState<InterestKey>(initial);
  const [isPending, startTransition] = useTransition();

  async function updateInterest(next: InterestKey) {
    const prev = value;
    setValue(next); // UI optimista

    try {
      const res = await fetch(`/api/applications/${applicationId}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest: next }),
      });
      if (!res.ok) throw new Error(await res.text());

      toast.success("Estado actualizado");

      // 🔄 fuerza a revalidar el árbol del server para refrescar contadores y lista
      router.refresh();
    } catch (err) {
      setValue(prev);
      toast.error("No se pudo actualizar el estado");
      console.error(err);
    }
  }

  return (
    <select
      className="rounded border border-zinc-300 glass-card p-4 md:p-6"
      value={value}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateInterest(e.target.value as InterestKey))}
      aria-label="Estado del candidato"
    >
      <option value="REVIEW">{LABEL.REVIEW}</option>
      <option value="MAYBE">{LABEL.MAYBE}</option>
      <option value="ACCEPTED">{LABEL.ACCEPTED}</option>
      <option value="REJECTED">{LABEL.REJECTED}</option>
    </select>
  );
}
