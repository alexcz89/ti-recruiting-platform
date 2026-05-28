// app/dashboard/jobs/new/JobWizard/components/Step1Basic.tsx
"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { DollarSign, Briefcase, CheckCircle2 } from "lucide-react";
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

const SALARY_MODES: { value: SalaryMode; label: string; hint: string }[] = [
  { value: "rango",  label: "Rango",  hint: "Desde … Hasta" },
  { value: "hasta",  label: "Hasta",  hint: "Máximo ofrecido" },
  { value: "exacto", label: "Exacto", hint: "Monto fijo" },
];

// h-9 = 36px — compact pero cómodo para desktop
const inputCls = (err?: unknown, extra?: string) =>
  clsx(
    "w-full rounded-lg border bg-white text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
    err ? "border-red-500 dark:border-red-500" : "border-zinc-300",
    extra
  );

function formatSalary(value?: string | number | null): string {
  if (value === null || value === undefined) return "";
  const digits =
    typeof value === "number"
      ? String(value)
      : String(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(digits));
}

function parseSalaryInput(raw: string): number | undefined {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

function FieldCheck({ ok }: { ok: boolean }) {
  if (!ok) return null;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
}

function Label({ children, check }: { children: React.ReactNode; check?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {children}
      </label>
      {check && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
    </div>
  );
}

export default function Step1Basic({
  presetCompany,
  templates,
  onApplyTemplate,
  onNext,
}: Step1BasicProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<JobForm>();

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
      setValue("city", "", { shouldDirty: true, shouldValidate: true });
      setValue("country", ""); setValue("admin1", "");
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
    !Number.isNaN(Number(salaryMin)) && !Number.isNaN(Number(salaryMax)) &&
    Number(salaryMin) > Number(salaryMax);

  const cityRequired = locationType === "HYBRID" || locationType === "ONSITE";

  const canNext =
    !!title?.trim() && !!employmentType &&
    !(cityRequired && !city?.trim()) && !salaryNeedsSwap;

  const disabledMessage =
    !title?.trim()              ? "Falta nombre de vacante"
    : !employmentType           ? "Falta tipo de empleo"
    : cityRequired && !city?.trim() ? "Falta ciudad"
    : null;

  const locationOk = locationType === "REMOTE" || (!!city?.trim() && !errors.city);

  // Shared salary input renderer
  function SalaryInput({
    name, placeholder, focused, onFocus, onBlur: onBlurCb,
  }: {
    name: "salaryMin" | "salaryMax";
    placeholder: string;
    focused: boolean;
    onFocus: () => void;
    onBlur: () => void;
  }) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const raw = typeof field.value === "number" || typeof field.value === "string"
            ? String(field.value) : "";
          const isMin = name === "salaryMin";
          const isExacto = salaryMode === "exacto";
          return (
            <input
              type="text" inputMode="numeric"
              name={field.name} ref={field.ref}
              className={inputCls(errors[name], "h-9 px-3")}
              placeholder={placeholder}
              value={focused ? raw : formatSalary(raw)}
              onFocus={onFocus}
              onChange={(e) => {
                const val = parseSalaryInput(e.target.value);
                field.onChange(val);
                if (isExacto && isMin) setValue("salaryMax", val, { shouldDirty: true });
              }}
              onBlur={(e) => {
                onBlurCb();
                const val = parseSalaryInput(e.target.value);
                field.onChange(val);
                if (isExacto && isMin) setValue("salaryMax", val, { shouldDirty: true });
                field.onBlur();
              }}
            />
          );
        }}
      />
    );
  }

  return (
    <section className="p-4 sm:p-5">
      <div className="space-y-3">

        {/* Template Selector compacto */}
        {templates.length > 0 && (
          <TemplateSelector templates={templates} onApply={onApplyTemplate} />
        )}

        {/* Título */}
        <div className="space-y-1">
          <Label check={!!title?.trim() && title.trim().length >= 3 && !errors.title}>
            Nombre de la vacante <span className="text-red-500 normal-case">*</span>
          </Label>
          <input
            className={inputCls(errors.title, "h-9 px-3")}
            placeholder="Ej: Desarrollador Full Stack Senior"
            {...register("title")}
            aria-invalid={errors.title ? "true" : "false"}
          />
          {errors.title ? (
            <p className="text-xs text-red-600">⚠️ {errors.title.message}</p>
          ) : title && title.length > 0 && title.length < 10 ? (
            <p className="text-xs text-amber-600">💡 Un título más descriptivo atrae más candidatos</p>
          ) : null}
        </div>

        {/* Empresa + Tipo de empleo — misma altura */}
        <div className="grid grid-cols-2 gap-3">
          {/* Empresa */}
          <div className="space-y-1">
            <Label>Empresa <span className="text-red-500 normal-case">*</span></Label>
            <div className="flex gap-2 h-9">
              <label className="flex-1 cursor-pointer min-w-0">
                <input type="radio" value="own" className="sr-only" {...register("companyMode")} disabled={!presetCompany?.id} />
                <span className={clsx(
                  "flex h-full items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-all",
                  companyMode === "own"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                )}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {presetCompany?.name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="truncate text-xs font-semibold">{presetCompany?.name || "Mi empresa"}</span>
                </span>
              </label>
              <label className="flex-1 cursor-pointer min-w-0">
                <input type="radio" value="external" className="sr-only" {...register("companyMode")} />
                <span className={clsx(
                  "flex h-full items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-all",
                  companyMode === "external"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                )}>
                  <span className="text-sm">🔒</span>
                  <span className="text-xs font-semibold truncate">Confidencial</span>
                </span>
              </label>
            </div>
          </div>

          {/* Tipo de empleo */}
          <div className="space-y-1">
            <Label check={!!employmentType && !errors.employmentType}>
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Tipo de empleo <span className="text-red-500 normal-case">*</span>
              </span>
            </Label>
            <select className={inputCls(errors.employmentType, "h-9 px-2")} {...register("employmentType")}>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ubicación + Ciudad inline */}
        <div className="space-y-1">
          <Label check={locationOk}>
            Ubicación <span className="text-red-500 normal-case">*</span>
          </Label>
          <div className={clsx("grid gap-2", cityRequired ? "grid-cols-[160px_1fr]" : "grid-cols-1")}>
            <select className={inputCls(undefined, "h-9 px-2")} {...register("locationType")}>
              <option value="REMOTE">🌎 Remoto</option>
              <option value="HYBRID">🏢 Híbrido</option>
              <option value="ONSITE">🏛️ Presencial</option>
            </select>
            {cityRequired && (
              <Controller
                control={control}
                name="city"
                render={({ field: { value, onChange } }) => (
                  <LocationAutocomplete
                    value={value || ""}
                    onChange={(next: unknown) => {
                      if (typeof next === "string") { onChange(next); return; }
                      if (next && typeof next === "object") {
                        const p = next as { label?: string; city?: string; country?: string; admin1?: string; cityNorm?: string; admin1Norm?: string; lat?: number; lng?: number };
                        onChange(p.label || p.city || "");
                        setValue("country", p.country || ""); setValue("admin1", p.admin1 || "");
                        setValue("cityNorm", p.cityNorm || ""); setValue("admin1Norm", p.admin1Norm || "");
                        setValue("locationLat", typeof p.lat === "number" ? p.lat : null);
                        setValue("locationLng", typeof p.lng === "number" ? p.lng : null);
                        return;
                      }
                      onChange(""); setValue("country", ""); setValue("admin1", "");
                      setValue("cityNorm", ""); setValue("admin1Norm", "");
                      setValue("locationLat", null); setValue("locationLng", null);
                    }}
                    onPlace={() => {}}
                    countries={["mx"]}
                    className={inputCls(errors.city, "h-9 px-3")}
                  />
                )}
              />
            )}
          </div>
          {errors.city && <p className="text-xs text-red-600">⚠️ {errors.city.message as string}</p>}
        </div>

        {/* Sueldo */}
        <div className="space-y-1.5">
          {/* Label + modo en la misma fila */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Sueldo
              <span className="normal-case font-normal text-zinc-400">(opcional)</span>
            </label>
            {/* Segmented control inline */}
            <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
              {SALARY_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  title={m.hint}
                  onClick={() => handleSalaryModeChange(m.value)}
                  className={clsx(
                    "rounded px-2.5 py-0.5 text-[11px] font-semibold transition-all",
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

          {/* Inputs */}
          <div className={clsx(
            "grid gap-2",
            salaryMode === "rango" ? "grid-cols-[72px_1fr_1fr]" : "grid-cols-[72px_1fr]"
          )}>
            <select className={inputCls(undefined, "h-9 px-2 text-xs")} {...register("currency")}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>

            {salaryMode === "rango" && (
              <>
                <SalaryInput name="salaryMin" placeholder="Desde" focused={salaryMinFocused} onFocus={() => setSalaryMinFocused(true)} onBlur={() => setSalaryMinFocused(false)} />
                <SalaryInput name="salaryMax" placeholder="Hasta" focused={salaryMaxFocused} onFocus={() => setSalaryMaxFocused(true)} onBlur={() => setSalaryMaxFocused(false)} />
              </>
            )}
            {salaryMode === "hasta" && (
              <SalaryInput name="salaryMax" placeholder="Sueldo máximo" focused={salaryMaxFocused} onFocus={() => setSalaryMaxFocused(true)} onBlur={() => setSalaryMaxFocused(false)} />
            )}
            {salaryMode === "exacto" && (
              <SalaryInput name="salaryMin" placeholder="Sueldo exacto" focused={salaryMinFocused} onFocus={() => setSalaryMinFocused(true)} onBlur={() => setSalaryMinFocused(false)} />
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors dark:text-zinc-400">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/50"
                {...register("showSalary")}
              />
              Mostrar en la publicación
            </label>
            {salaryNeedsSwap && (
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-500"
                onClick={() => {
                  setValue("salaryMin", salaryMax ?? undefined, { shouldDirty: true, shouldValidate: true });
                  setValue("salaryMax", salaryMin ?? undefined, { shouldDirty: true, shouldValidate: true });
                }}
              >
                ↕ Intercambiar
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-400">{canNext ? "" : disabledMessage}</p>
          <button
            type="button"
            className={clsx(
              "rounded-xl px-6 py-2 text-sm font-bold transition-all",
              canNext
                ? "bg-emerald-600 text-white hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg active:translate-y-0"
                : "cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800"
            )}
            disabled={!canNext}
            onClick={onNext}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </section>
  );
}
