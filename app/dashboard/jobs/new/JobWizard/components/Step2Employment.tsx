// app/dashboard/jobs/new/JobWizard/components/Step2Employment.tsx
"use client";

import { useFormContext } from "react-hook-form";
import clsx from "clsx";
import { JobForm } from "../types";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  LOCATION_TYPE_OPTIONS,
} from "../lib/job-enums";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export default function Step2Employment({ onNext, onBack }: Props) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<JobForm>();

  const locationType = watch("locationType");
  const employmentType = watch("employmentType");
  const city = watch("city");

  const canNext =
    !!locationType &&
    !!employmentType &&
    !!city &&
    city.trim().length > 0;

  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Location Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Tipo de ubicación *
          </label>

          <select
            {...register("locationType")}
            className={clsx(
              "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60",
              errors.locationType
                ? "border-red-500"
                : "border-zinc-300 dark:border-zinc-700",
              "bg-white dark:bg-zinc-900"
            )}
          >
            {LOCATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {errors.locationType && (
            <p className="text-xs text-red-600">
              {errors.locationType.message}
            </p>
          )}
        </div>

        {/* Employment Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Tipo de empleo *
          </label>

          <select
            {...register("employmentType")}
            className={clsx(
              "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60",
              errors.employmentType
                ? "border-red-500"
                : "border-zinc-300 dark:border-zinc-700",
              "bg-white dark:bg-zinc-900"
            )}
          >
            {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {errors.employmentType && (
            <p className="text-xs text-red-600">
              {errors.employmentType.message}
            </p>
          )}
        </div>
      </div>

      {/* City */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Ciudad *
        </label>

        <input
          type="text"
          {...register("city")}
          placeholder="Ej. Monterrey"
          className={clsx(
            "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60",
            errors.city
              ? "border-red-500"
              : "border-zinc-300 dark:border-zinc-700",
            "bg-white dark:bg-zinc-900"
          )}
        />

        {errors.city && (
          <p className="text-xs text-red-600">
            {errors.city.message}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:justify-between dark:border-zinc-800">
        <button
          type="button"
          className="w-full rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium transition hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:hover:bg-zinc-800"
          onClick={onBack}
        >
          Atrás
        </button>

        <button
          type="button"
          disabled={!canNext}
          className={clsx(
            "w-full rounded-md px-6 py-2.5 text-sm font-medium text-white transition sm:w-auto",
            canNext
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "cursor-not-allowed bg-emerald-300"
          )}
          onClick={onNext}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}