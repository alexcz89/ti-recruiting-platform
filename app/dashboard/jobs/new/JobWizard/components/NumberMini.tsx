// app/dashboard/jobs/new/JobWizard/components/NumberMini.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { JobForm } from "../types";

type Props = {
  label: string;
  field: "aguinaldoDias" | "vacacionesDias" | "primaVacPct";
  max?: number;
};

export default function NumberMini({ label, field, max }: Props) {
  const { register } = useFormContext<JobForm>();
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="whitespace-nowrap">{label}:</span>
      <input
        type="number"
        min={0}
        max={max}
        className="h-10 w-16 rounded border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        {...register(field, { valueAsNumber: true })}
      />
    </div>
  );
}