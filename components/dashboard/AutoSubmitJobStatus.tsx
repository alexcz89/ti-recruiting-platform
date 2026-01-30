// components/dashboard/AutoSubmitJobStatus.tsx
"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { toastSuccess, toastError } from "@/lib/ui/toast";

type Status = "OPEN" | "CLOSED" | "PAUSED";

type Props = {
  jobId: string;
  defaultValue: Status;
  labels: Record<string, string>;
};

export default function AutoSubmitJobStatus({
  jobId,
  defaultValue,
  labels,
}: Props) {
  const [value, setValue] = useState<Status>(defaultValue);
  const [pending, startTransition] = useTransition();

  const onChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const next = e.target.value as Status;

    const prev = value;
    setValue(next); // UI optimista

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("jobId", jobId);
        fd.set("status", next);

        const res = await fetch("/dashboard/jobs/status", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          setValue(prev);
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "No se pudo actualizar el estatus");
        }

        toastSuccess(`Estatus actualizado a "${labels[next] ?? next}"`);
      } catch (err: any) {
        setValue(prev);
        toastError(err?.message || "No se pudo actualizar el estatus");
      }
    });
  };

  // 🎨 Clases base comunes
  const baseClasses =
    "inline-flex h-9 min-w-[150px] items-center rounded-full " +
    "border px-3 pr-7 text-xs font-medium shadow-sm " +
    "appearance-none cursor-pointer " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-emerald-500/80 focus-visible:ring-offset-1 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  // 🎨 Función para obtener clases de color según el status
  const getColorClasses = (status: Status) => {
    if (status === "OPEN") {
      return (
        baseClasses +
        " bg-green-50 text-green-700 border-green-300 " +
        "dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
      );
    }
    if (status === "PAUSED") {
      return (
        baseClasses +
        " bg-yellow-50 text-yellow-700 border-yellow-300 " +
        "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700"
      );
    }
    // CLOSED
    return (
      baseClasses +
      " bg-zinc-100 text-zinc-700 border-zinc-300 " +
      "dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600"
    );
  };

  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={onChange}
        disabled={pending}
        className={getColorClasses(value)}
        aria-label="Estatus de la vacante"
      >
        <option value="OPEN">{labels.OPEN ?? "Abierta"}</option>
        <option value="PAUSED">{labels.PAUSED ?? "Pausada"}</option>
        <option value="CLOSED">{labels.CLOSED ?? "Cerrada"}</option>
      </select>

      {/* Flechita custom */}
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 dark:text-zinc-300">
        ▼
      </span>
    </div>
  );
}