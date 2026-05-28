// app/dashboard/jobs/new/JobWizard/components/Step1Basic.tsx
"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CheckCircle2, ChevronRight } from "lucide-react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { JobForm, PresetCompany, TemplateJob } from "../types";
import TemplateSelector from "./TemplateSelector";
import { EMPLOYMENT_TYPE_OPTIONS } from "../lib/job-enums";

type Step1BasicProps = {
  presetCompany: PresetCompany;
  templates: TemplateJob[];
  onApplyTemplate: (id: string) => void;
  onNext: () => void;
};

type SalaryMode = "rango" | "hasta" | "exacto";

const SALARY_MODES: { value: SalaryMode; label: string }[] = [
  { value: "rango",  label: "Rango"  },
  { value: "hasta",  label: "Hasta"  },
  { value: "exacto", label: "Exacto" },
];

// Input base — h-9 (36px), limpio y consistente
const field = (error?: unknown) =>
  clsx(
    "w-full rounded-lg border bg-white px-3 text-sm h-9 transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500",
    "dark:bg-zinc-900 dark:text-zinc-100",
    error
      ? "border-red-400 dark:border-red-500"
      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
  );

function formatSalary(value?: string | number | null): string {
  if (value === null || value === undefined) return "";
  const digits = typeof value === "number" ? String(value) : String(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(digits));
}

function parseSalaryInput(raw: string): number | undefined {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

// Label + check inline
function FieldLabel({
  children,
  required,
  ok,
}: {
  children: React.ReactNode;
  required?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {children}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
    </div>
  );
}

export default function Step1Basic({
  presetCompany,
  templates,
  onApplyTemplate,
  onNext,
}: Step1BasicProps) {
  const { register, control, watch, setValue, formState: { errors } } =
    useFormContext<JobForm>();

  const locationType   = watch("locationType");
  const city           = watch("city");
  const title          = watch("title");
  const salaryMin      = watch("salaryMin");
  const salaryMax      = watch("salaryMax");
  const employmentType = watch("employmentType");
  const companyMode    = watch("companyMode");

  const [salaryMode, setSalaryMode]           = useState<SalaryMode>("rango");
  const [salaryMinFocused, setSalaryMinFocused] = useState(false);
  const [salaryMaxFocused, setSalaryMaxFocused] = useState(false);

  useEffect(() => {
    if (locationType === "REMOTE") {
      setValue("city", ""); setValue("country", ""); setValue("admin1", "");
      setValue("cityNorm", ""); setValue("admin1Norm", "");
      setValue("locationLat", null); setValue("locationLng", null);
    }
  }, [locationType, setValue]);

  function handleSalaryModeChange(mode: SalaryMode) {
    setSalaryMode(mode);
    if (mode === "hasta")  setValue("salaryMin", undefined, { shouldDirty: true });
    if (mode === "exacto") setValue("salaryMax", undefined, { shouldDirty: true });
  }

  const salaryNeedsSwap =
    salaryMode === "rango" && salaryMin && salaryMax &&
    Number(salaryMin) > Number(salaryMax);

  const cityRequired = locationType === "HYBRID" || locationType === "ONSITE";

  const canNext =
    !!title?.trim() && title.trim().length >= 3 &&
    !!employmentType &&
    !(cityRequired && !city?.trim()) &&
    !salaryNeedsSwap;

  const disabledMessage =
    !title?.trim() || title.trim().length < 3 ? "Falta nombre de vacante"
    : !employmentType                          ? "Falta tipo de empleo"
    : cityRequired && !city?.trim()            ? "Falta ciudad"
    : null;

  const locationOk = locationType === "REMOTE" || (!!city?.trim() && !errors.city);

  // Reusable salary input
  function SalaryInput({
    name, placeholder, focused, onFocus, onBlurFn,
  }: {
    name: "salaryMin" | "salaryMax";
    placeholder: string;
    focused: boolean;
    onFocus: () => void;
    onBlurFn: () => void;
  }) {
    const isMin = name === "salaryMin";
    const isExacto = salaryMode === "exacto";
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => {
          const raw = typeof f.value === "number" || typeof f.value === "string" ? String(f.value) : "";
          return (
            <input
              type="text" inputMode="numeric"
              name={f.name} ref={f.ref}
              className={field(errors[name])}
              placeholder={placeholder}
              value={focused ? raw : formatSalary(raw)}
              onFocus={onFocus}
              onChange={(e) => {
                const val = parseSalaryInput(e.target.value);
                f.onChange(val);
                if (isExacto && isMin) setValue("salaryMax", val, { shouldDirty: true });
              }}
              onBlur={(e) => {
                onBlurFn();
                const val = parseSalaryInput(e.target.value);
                f.onChange(val);
                if (isExacto && isMin) setValue("salaryMax", val, { shouldDirty: true });
                f.onBlur();
              }}
            />
          );
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Template selector — discreta fila superior */}
      {templates.length > 0 && (
        <div className="border-b border-zinc-100 px-5 py-2.5 dark:border-zinc-800">
          <TemplateSelector templates={templates} onApply={onApplyTemplate} />
        </div>
      )}

      <div className="space-y-4 p-5">

        {/* ── Nombre ── */}
        <div>
          <FieldLabel required ok={!!title?.trim() && title.trim().length >= 3 && !errors.title}>
            Nombre de la vacante
          </FieldLabel>
          <input
            className={field(errors.title)}
            placeholder="Ej: Desarrollador Full Stack Senior"
            {...register("title")}
          />
          {errors.title ? (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          ) : title && title.length > 0 && title.length < 10 ? (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Un título más descriptivo atrae más candidatos</p>
          ) : null}
        </div>

        {/* ── Empresa + Tipo de empleo ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Empresa */}
          <div>
            <FieldLabel required>Empresa</FieldLabel>
            <div className="flex gap-2">
              {/* Mi empresa */}
              <label className="flex flex-1 cursor-pointer select-none min-w-0">
                <input type="radio" value="own" className="sr-only" {...register("companyMode")} disabled={!presetCompany?.id} />
                <span className={clsx(
                  "flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors",
                  companyMode === "own"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
                )}>
                  <span className={clsx(
                    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                    companyMode === "own" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  )}>
                    {presetCompany?.name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="truncate text-[13px] font-medium">
                    {presetCompany?.name || "Mi empresa"}
                  </span>
                </span>
              </label>
              {/* Confidencial */}
              <label className="flex flex-1 cursor-pointer select-none min-w-0">
                <input type="radio" value="external" className="sr-only" {...register("companyMode")} />
                <span className={clsx(
                  "flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors",
                  companyMode === "external"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
                )}>
                  <span className="shrink-0 text-base leading-none">🔒</span>
                  <span className="truncate text-[13px] font-medium">Confidencial</span>
                </span>
              </label>
            </div>
          </div>

          {/* Tipo de empleo */}
          <div>
            <FieldLabel required ok={!!employmentType && !errors.employmentType}>
              Tipo de empleo
            </FieldLabel>
            <select className={field(errors.employmentType)} {...register("employmentType")}>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Ubicación + Ciudad ── */}
        <div>
          <FieldLabel required ok={locationOk}>Modalidad y ubicación</FieldLabel>
          <div className={clsx("grid gap-2", cityRequired ? "grid-cols-[152px_1fr]" : "grid-cols-1")}>
            <select className={field()} {...register("locationType")}>
              <option value="REMOTE">🌎 Remoto</option>
              <option value="HYBRID">🏢 Híbrido</option>
              <option value="ONSITE">🏛️ Presencial</option>
            </select>
            {cityRequired && (
              <Controller
                control={control}
                name="city"
                render={({ field: f }) => (
                  <LocationAutocomplete
                    value={f.value || ""}
                    onChange={(next: unknown) => {
                      if (typeof next === "string") { f.onChange(next); return; }
                      if (next && typeof next === "object") {
                        const p = next as { label?: string; city?: string; country?: string; admin1?: string; cityNorm?: string; admin1Norm?: string; lat?: number; lng?: number };
                        f.onChange(p.label || p.city || "");
                        setValue("country", p.country || ""); setValue("admin1", p.admin1 || "");
                        setValue("cityNorm", p.cityNorm || ""); setValue("admin1Norm", p.admin1Norm || "");
                        setValue("locationLat", typeof p.lat === "number" ? p.lat : null);
                        setValue("locationLng", typeof p.lng === "number" ? p.lng : null);
                        return;
                      }
                      f.onChange(""); setValue("country", ""); setValue("admin1", "");
                      setValue("cityNorm", ""); setValue("admin1Norm", "");
                      setValue("locationLat", null); setValue("locationLng", null);
                    }}
                    onPlace={() => {}}
                    countries={["mx"]}
                    className={field(errors.city)}
                  />
                )}
              />
            )}
          </div>
          {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city.message as string}</p>}
        </div>

        {/* ── Sueldo ── */}
        <div>
          {/* Label + modo en misma línea */}
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Sueldo <span className="text-xs font-normal text-zinc-400">(opcional)</span>
            </span>
            {/* Segmented control */}
            <div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-[3px] dark:border-zinc-700 dark:bg-zinc-800">
              {SALARY_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleSalaryModeChange(m.value)}
                  className={clsx(
                    "rounded px-2.5 py-[3px] text-[11px] font-semibold transition-all leading-none",
                    salaryMode === m.value
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-300"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className={clsx(
            "grid gap-2",
            salaryMode === "rango" ? "grid-cols-[64px_1fr_1fr]" : "grid-cols-[64px_1fr]"
          )}>
            <select className={field()} {...register("currency")}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
            {salaryMode === "rango" && (
              <>
                <SalaryInput name="salaryMin" placeholder="Desde" focused={salaryMinFocused} onFocus={() => setSalaryMinFocused(true)} onBlurFn={() => setSalaryMinFocused(false)} />
                <SalaryInput name="salaryMax" placeholder="Hasta" focused={salaryMaxFocused} onFocus={() => setSalaryMaxFocused(true)} onBlurFn={() => setSalaryMaxFocused(false)} />
              </>
            )}
            {salaryMode === "hasta" && (
              <SalaryInput name="salaryMax" placeholder="Máximo" focused={salaryMaxFocused} onFocus={() => setSalaryMaxFocused(true)} onBlurFn={() => setSalaryMaxFocused(false)} />
            )}
            {salaryMode === "exacto" && (
              <SalaryInput name="salaryMin" placeholder="Monto exacto" focused={salaryMinFocused} onFocus={() => setSalaryMinFocused(true)} onBlurFn={() => setSalaryMinFocused(false)} />
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-emerald-600"
                {...register("showSalary")}
              />
              Mostrar en la publicación
            </label>
            {salaryNeedsSwap && (
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-500 transition-colors"
                onClick={() => {
                  setValue("salaryMin", salaryMax ?? undefined, { shouldDirty: true });
                  setValue("salaryMax", salaryMin ?? undefined, { shouldDirty: true });
                }}
              >
                ↕ Intercambiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer de navegación ── */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <p className="text-xs text-zinc-400">{!canNext ? disabledMessage : ""}</p>
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold transition-all",
            canNext
              ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-md active:scale-[0.98]"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
          )}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
