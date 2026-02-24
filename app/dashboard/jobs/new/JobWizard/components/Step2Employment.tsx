// app/dashboard/jobs/new/JobWizard/components/Step2Employment.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { Briefcase, Clock3, Check } from "lucide-react";
import clsx from "clsx";
import { JobForm } from "../types";
import { EMPLOYMENT_OPTIONS, SCHEDULE_PRESETS } from "../constants";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export default function Step2Employment({ onNext, onBack }: Props) {
  const { watch, setValue, register } = useFormContext<JobForm>();

  return (
    <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Briefcase className="h-5 w-5 text-emerald-500" />
          <span>2) Tipo de empleo</span>
        </h3>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Elige el tipo de contrato y un horario de referencia.
        </p>
      </div>

      {/* Tipo de contrato */}
      <div className="grid gap-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Tipo de contrato *
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EMPLOYMENT_OPTIONS.map((opt) => {
            const active = watch("employmentType") === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setValue("employmentType", opt.value, { shouldDirty: true })
                }
                className={clsx(
                  "group relative flex h-full min-h-[140px] flex-col items-start rounded-xl border p-4 text-left text-xs sm:text-sm transition",
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-100"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/10"
                )}
              >
                {active && (
                  <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-600" />
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                      active
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    )}
                  >
                    {opt.label[0]}
                  </span>
                  <span className="font-semibold whitespace-normal break-words leading-tight hyphens-none line-clamp-2 min-h-[2.5rem]">
                    {opt.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 whitespace-normal break-words hyphens-none">
                  {opt.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Horario */}
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Clock3 className="h-4 w-4 text-emerald-500" />
          Horario de referencia (opcional)
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Ej. L-V 9:00-18:00 (hora local)
        </p>
        <input
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Ej. L-V 9:00-18:00 (hora local)"
          {...register("schedule")}
        />
        <div className="flex flex-wrap gap-2 text-[11px]">
          {SCHEDULE_PRESETS.map((p) => {
            const active = watch("schedule") === p.value;
            return (
              <button
                key={p.value}
                type="button"
                className={clsx(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:hover:bg-zinc-800",
                  active
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-400 dark:text-emerald-100"
                    : "bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
                )}
                onClick={() =>
                  setValue("schedule", p.value, { shouldDirty: true })
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Este campo es informativo. No afecta filtros ni validaciones.
        </p>
      </div>

      {/* Navegación */}
      <div className="flex justify-between gap-4 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          onClick={onBack}
        >
          Atrás
        </button>
        <button
          type="button"
          className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition"
          onClick={onNext}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}