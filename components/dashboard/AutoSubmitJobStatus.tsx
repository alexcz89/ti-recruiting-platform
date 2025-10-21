// components/dashboard/AutoSubmitJobStatus.tsx
"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { toastSuccess, toastError } from "@/lib/ui/toast";

type Props = {
  jobId: string;
  defaultValue: "OPEN" | "CLOSED" | "PAUSED";
  labels: Record<string, string>;
};

export default function AutoSubmitJobStatus({
  jobId,
  defaultValue,
  labels,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  const onChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const next = e.target.value as "OPEN" | "CLOSED" | "PAUSED";

    // Optimista
    const prev = value;
    setValue(next);

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
        toastError(err?.message || "No se pudo actualizar el estatus");
      }
    });
  };

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={pending}
      className="w-full min-w-[160px] border rounded-lg px-2.5 py-2 text-sm disabled:opacity-60"
      aria-label="Estatus de la vacante"
    >
      <option value="OPEN">{labels.OPEN ?? "Abierta"}</option>
      <option value="PAUSED">{labels.PAUSED ?? "Pausada"}</option>
      <option value="CLOSED">{labels.CLOSED ?? "Cerrada"}</option>
    </select>
  );
}
