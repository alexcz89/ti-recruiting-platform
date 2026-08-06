"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ManualScoreForm({ slug, registration }: {
  slug: string;
  registration: {
    id: string;
    qualityScore: number;
    efficiencyScore: number;
    explanationScore: number;
    status: string;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard/contests/${encodeURIComponent(slug)}/registrations/${registration.id}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualityScore: formData.get("qualityScore"),
          efficiencyScore: formData.get("efficiencyScore"),
          explanationScore: formData.get("explanationScore"),
          status: formData.get("status"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo guardar");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={save} className="grid grid-cols-4 gap-1.5">
      <input aria-label="Calidad" title="Calidad (0–10)" name="qualityScore" type="number" min="0" max="10" defaultValue={registration.qualityScore} className="w-14 rounded border border-zinc-300 bg-transparent px-1.5 py-1 text-xs dark:border-zinc-700" />
      <input aria-label="Eficiencia" title="Eficiencia (0–10)" name="efficiencyScore" type="number" min="0" max="10" defaultValue={registration.efficiencyScore} className="w-14 rounded border border-zinc-300 bg-transparent px-1.5 py-1 text-xs dark:border-zinc-700" />
      <input aria-label="Explicación" title="Explicación (0–5)" name="explanationScore" type="number" min="0" max="5" defaultValue={registration.explanationScore} className="w-14 rounded border border-zinc-300 bg-transparent px-1.5 py-1 text-xs dark:border-zinc-700" />
      <select aria-label="Etapa" name="status" defaultValue={registration.status === "REGISTERED" ? "QUALIFIER_SUBMITTED" : registration.status} className="rounded border border-zinc-300 bg-transparent px-1 py-1 text-xs dark:border-zinc-700">
        <option value="QUALIFIER_SUBMITTED">Clasif.</option>
        <option value="FINALIST">Finalista</option>
        <option value="WINNER">Ganador</option>
        <option value="DISQUALIFIED">Descalif.</option>
      </select>
      <button disabled={saving} className="col-span-4 rounded bg-zinc-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 dark:bg-emerald-600">{saving ? "Guardando…" : "Guardar revisión"}</button>
      {error ? <span className="col-span-4 text-[11px] text-red-600">{error}</span> : null}
    </form>
  );
}