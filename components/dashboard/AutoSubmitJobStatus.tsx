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

const STATUS_COLOR_CLASSES: Record<Status, string> = {
  OPEN:
    "bg-emerald-50 text-emerald-800 border-emerald-300 " +
    "dark:bg-emerald-500/20 dark:text-emerald-50 dark:border-emerald-500/60",
  PAUSED:
    "bg-amber-50 text-amber-800 border-amber-300 " +
    "dark:bg-amber-500/20 dark:text-amber-50 dark:border-amber-500/60",
  CLOSED:
    "bg-zinc-50 text-zinc-800 border-zinc-300 " +
    "dark:bg-zinc-800/80 dark:text-zinc-100 dark:border-zinc-600",
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

        toastSuccess(`Estatus actualizado a “${labels[next] ?? next}”`);
      } catch (err: any) {
        setValue(prev);
        toastError(err?.message || "No se pudo actualizar el estatus");
      }
    });
  };

  const baseClasses =
    "inline-flex h-9 min-w-[150px] items-center rounded-full " +
    "border px-3 pr-7 text-xs font-medium shadow-sm " +
    "appearance-none cursor-pointer " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-emerald-500/80 focus-visible:ring-offset-1 " +
    "disabled:opacity-60 disabled:cursor-not-allowed " +
    "bg-white/95 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100";

  const colorClasses = STATUS_COLOR_CLASSES[value];

  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={onChange}
        disabled={pending}
        className={`${baseClasses} ${colorClasses}`}
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
