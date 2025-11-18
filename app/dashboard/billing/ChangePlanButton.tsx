// app/dashboard/billing/ChangePlanButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlanId } from "@/config/plans";

type Props = {
  planId: PlanId;
  isCurrent: boolean;
};

export default function ChangePlanButton({ planId, isCurrent }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Si ya es el plan actual, sólo mostramos el botón deshabilitado
  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold cursor-default border border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300"
      >
        Plan actual
      </button>
    );
  }

  const busy = loading || isPending;

  const handleClick = () => {
    if (busy) return;

    setLoading(true);

    fetch("/api/billing/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.error("Change plan error", data);
          toast.error(data?.error || "No se pudo cambiar de plan");
          return;
        }

        toast.success("Plan actualizado correctamente");

        startTransition(() => {
          router.refresh();
        });
      })
      .catch((err) => {
        console.error("Network error changing plan", err);
        toast.error("No se pudo conectar con el servidor");
      })
      .finally(() => setLoading(false));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
    >
      {busy ? "Cambiando..." : "Cambiar a este plan"}
    </button>
  );
}
