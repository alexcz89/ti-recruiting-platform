// app/dashboard/overview/QuickActionButtons.tsx
"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import { updateApplicationStatus } from "./actions";

type Props = {
  applicationId: string;
};

export default function QuickActionButtons({ applicationId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const handleAction = (status: "REVIEWING" | "REJECTED") => {
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, status);
      
      if (result.success) {
        toastSuccess(
          status === "REVIEWING" 
            ? "Candidato movido a 'En revisión'" 
            : "Candidato rechazado"
        );
        setHidden(true);
      } else {
        toastError(result.error || "Error al actualizar");
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleAction("REVIEWING")}
        disabled={isPending}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition"
        title="Aprobar"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleAction("REJECTED")}
        disabled={isPending}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 disabled:opacity-50 transition"
        title="Rechazar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}