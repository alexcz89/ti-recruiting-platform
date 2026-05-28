// app/dashboard/jobs/new/JobWizard/components/Step1Basic.tsx
"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { MapPin, DollarSign, Briefcase, CheckCircle2 } from "lucide-react";
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
  return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
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

  const locationType    = watch("locationType");
  const city            = watch("city");
  const title           = watch("title");
  const salaryMin       = watch("salaryMin");
  const salaryMax       = watch("salaryMax");
  const employmentType  = watch("employmentType");
  const companyMode     = watch("companyMode");

  const [salaryMode, setSalaryMode]       = useState<SalaryMode>("rango");
  const [salaryMinFocused, setSalaryMinFocused] = useState(false);
  const [salaryMaxFocused, setSalaryMaxFocused] = useState(false);

  useEffect(() => {
    if (locationType === "REMOTE") {
      setValue("city", "", { shouldDirty: true, shouldValidate: true });
      setValue("country", "", { shouldDirty: true, shouldValidate: false });
      setValue("admin1", "", { shouldDirty: true, shouldValidate: false });
      setValue("cityNorm", "", { shouldDirty: true, shouldValidate: false });
      setValue("admin1Norm", "", { shouldDirty: true, shouldValidate: false });
      setValue("locationLat", null, { shouldDirty: true, shouldValidate: false });
      setValue("locationLng", null, { shouldDirty: true, shouldValidate: false });
    }
  }, [locationType, setValue]);

  // Al cambiar modo sueldo, limpiar el campo que ya no aplica
  function handleSalaryModeChange(mode: SalaryMode) {
    setSalaryMode(mode);
    if (mode === "hasta") {
      setValue("salaryMin", undefined, { shouldDirty: true });
    } else if (mode === "exacto") {
      setValue("salaryMax", undefined, { shouldDirty: true });
    }
  }

  const salaryNeedsSwap =
    salaryMode === "rango" &&
    salaryMin && salaryMax &&
    !Number.isNaN(Number(salaryMin)) && !Number.isNaN(Number(salaryMax)) &&
    Number(salaryMin) > Number(salaryMax);

  const cityRequired = locationType === "HYBRID" || locationType === "ONSITE";

  const canNext =
    !!title?.trim() && !!employmentType &&
    !(cityRequired && !city?.trim()) && !salaryNeedsSwap;

  const disabledMessage = !canNext
    ? !title?.trim()         ? "Falta nombre de vacante"
    : !employmentType        ? "Falta tipo de empleo"
    : cityRequired && !city?.trim() ? "Falta ciudad"
    : null
    : null;

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-4">

        {/* Template Selector compacto */}
        {templates.length > 0 && (
          <TemplateSelector templates={templates} onApply={onApplyTemplate} />
        )}

        {/* Título */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              Nombre de la vacante <span className="text-red-500">*</span>
            </label>
            <FieldCheck ok={!!title?.trim() && title.trim().length >= 3 && !errors.title} />
          </div>
          <input
            className={inputCls(errors.title, "h-11 px-3")}
            placeholder="Ej: Desarrollador Full Stack Senior"
            {...register("title")}
            aria-invalid={errors.title ? "true" : "false"}
          />
          {errors.title ? (
            <p className="flex items-center gap-1 text-xs text-red-600">⚠️ {errors.title.message}</p>
          ) : title && title.length > 0 && title.length < 10 ? (
            <p className="text-xs text-amber-600">💡 Un título más descriptivo atrae más candidatos</p>
          ) : null}
        </div>

        {/* Empresa + Tipo de empleo en fila */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Empresa — radio compacto */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Empresa <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input type="radio" value="own" className="sr-only" {...register("companyMode")} disabled={!presetCompany?.id} />
                <span className={clsx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all w-full",
                  companyMode === "own"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                )}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {presetCompany?.name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="truncate font-medium">{presetCompany?.name || "Mi empresa"}</span>
                </span>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" value="external" className="sr-only" {...register("companyMode")} />
                <span className={clsx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all w-full",
                  companyMode === "external"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                )}>
                  <span className="text-base">🔒</span>
                  <span className="font-medium">Confidencial</span>
                </span>
              </label>
            </div>
          </div>

          {/* Tipo de empleo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Briefcase className="h-4 w-4 text-emerald-500" />
                Tipo de empleo <span className="text-red-500">*</span>
              </label>
              <FieldCheck ok={!!employmentType && !errors.employmentType} />
            </div>
            <select className={inputCls(errors.employmentType, "h-11 px-3")} {...register("employmentType")}>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.employmentType && <p className="text-xs text-red-600">{errors.employmentType.message}</p>}
          </div>
        </div>

        {/* Ubicación */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-emerald-500" />
              Ubicación <span className="text-red-500">*</span>
            </label>
            <FieldCheck ok={locationType === "REMOTE" || (!!city?.trim() && !errors.city)} />
          </div>
          <select className={inputCls(undefined, "h-11 px-3")} {...register("locationType")}>
            <option value="REMOTE">🌎 Remoto</option>
            <option value="HYBRID">🏢 Híbrido</option>
            <option value="ONSITE">🏛️ Presencial</option>
          </select>
          {cityRequired && (
            <div className="min-w-0 overflow-hidden">
              <p className="mb-1 text-xs text-muted-foreground">Escribe ciudad y selecciona una sugerencia.</p>
              <Controller
                control={control}
                name="city"
                render={({ field: { value, onChange } }) => (
                  <LocationAutocomplete
                    value={value || ""}
                    onChange={(next: unknown) => {
                      if (typeof next === "string") { onChange(next); return; }
                      if (next && typeof next === "object") {
                        const place = next as { label?: string; city?: string; country?: string; admin1?: string; cityNorm?: string; admin1Norm?: string; lat?: number; lng?: number; };
                        onChange(place.label || place.city || "");
                        setValue("country", place.country || "");
                        setValue("admin1", place.admin1 || "");
                        setValue("cityNorm", place.cityNorm || "");
                        setValue("admin1Norm", place.admin1Norm || "");
                        setValue("locationLat", typeof place.lat === "number" && Number.isFinite(place.lat) ? place.lat : null);
                        setValue("locationLng", typeof place.lng === "number" && Number.isFinite(place.lng) ? place.lng : null);
                        return;
                      }
                      onChange("");
                      setValue("country", ""); setValue("admin1", "");
                      setValue("cityNorm", ""); setValue("admin1Norm", "");
                      setValue("locationLat", null); setValue("locationLng", null);
                    }}
                    onPlace={() => {}}
                    countries={["mx"]}
                    className={inputCls(errors.city, "h-11 px-3")}
                  />
                )}
              />
              {errors.city && <p className="mt-1 text-xs text-red-600">⚠️ {errors.city.message as string}</p>}
            </div>
          )}
          {!cityRequired && (
            <p className="text-xs text-muted-foreground">Para vacantes remotas la ciudad es opcional.</p>
          )}
        </div>

        {/* Sueldo */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Sueldo <span className="text-xs font-normal text-zinc-400">(opcional)</span>
          </label>

          {/* Segmented mode selector */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
            {SALARY_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                title={m.hint}
                onClick={() => handleSalaryModeChange(m.value)}
                className={clsx(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  salaryMode === m.value
                    ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-700 dark:text-emerald-300"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Inputs según modo */}
          <div className={clsx(
            "grid gap-2",
            salaryMode === "rango" ? "grid-cols-[88px_1fr_1fr]" : "grid-cols-[88px_1fr]"
          )}>
            {/* Moneda */}
            <select className={inputCls(undefined, "h-11 px-2")} {...register("currency")}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>

            {/* Input(s) según modo */}
            {salaryMode === "rango" && (
              <>
                <Controller
                  name="salaryMin"
                  control={control}
                  render={({ field }) => {
                    const raw = typeof field.value === "number" || typeof field.value === "string" ? String(field.value) : "";
                    return (
                      <input
                        type="text" inputMode="numeric"
                        name={field.name} ref={field.ref}
                        className={inputCls(errors.salaryMin, "h-11 px-3")}
                        placeholder="Desde"
                        value={salaryMinFocused ? raw : formatSalary(raw)}
                        onFocus={() => setSalaryMinFocused(true)}
                        onChange={(e) => field.onChange(parseSalaryInput(e.target.value))}
                        onBlur={(e) => { setSalaryMinFocused(false); field.onChange(parseSalaryInput(e.target.value)); field.onBlur(); }}
                      />
                    );
                  }}
                />
                <Controller
                  name="salaryMax"
                  control={control}
                  render={({ field }) => {
                    const raw = typeof field.value === "number" || typeof field.value === "string" ? String(field.value) : "";
                    return (
                      <input
                        type="text" inputMode="numeric"
                        name={field.name} ref={field.ref}
                        className={inputCls(errors.salaryMax, "h-11 px-3")}
                        placeholder="Hasta"
                        value={salaryMaxFocused ? raw : formatSalary(raw)}
                        onFocus={() => setSalaryMaxFocused(true)}
                        onChange={(e) => field.onChange(parseSalaryInput(e.target.value))}
                        onBlur={(e) => { setSalaryMaxFocused(false); field.onChange(parseSalaryInput(e.target.value)); field.onBlur(); }}
                      />
                    );
                  }}
                />
              </>
            )}

            {salaryMode === "hasta" && (
              <Controller
                name="salaryMax"
                control={control}
                render={({ field }) => {
                  const raw = typeof field.value === "number" || typeof field.value === "string" ? String(field.value) : "";
                  return (
                    <input
                      type="text" inputMode="numeric"
                      name={field.name} ref={field.ref}
                      className={inputCls(errors.salaryMax, "h-11 px-3")}
                      placeholder="Sueldo máximo"
                      value={salaryMaxFocused ? raw : formatSalary(raw)}
                      onFocus={() => setSalaryMaxFocused(true)}
                      onChange={(e) => field.onChange(parseSalaryInput(e.target.value))}
                      onBlur={(e) => { setSalaryMaxFocused(false); field.onChange(parseSalaryInput(e.target.value)); field.onBlur(); }}
                    />
                  );
                }}
              />
            )}

            {salaryMode === "exacto" && (
              <Controller
                name="salaryMin"
                control={control}
                render={({ field }) => {
                  const raw = typeof field.value === "number" || typeof field.value === "string" ? String(field.value) : "";
                  return (
                    <input
                      type="text" inputMode="numeric"
                      name={field.name} ref={field.ref}
                      className={inputCls(errors.salaryMin, "h-11 px-3")}
                      placeholder="Sueldo exacto"
                      value={salaryMinFocused ? raw : formatSalary(raw)}
                      onFocus={() => setSalaryMinFocused(true)}
                      onChange={(e) => {
                        const val = parseSalaryInput(e.target.value);
                        field.onChange(val);
                        // En modo exacto, salaryMax = salaryMin
                        setValue("salaryMax", val, { shouldDirty: true });
                      }}
                      onBlur={(e) => {
                        setSalaryMinFocused(false);
                        const val = parseSalaryInput(e.target.value);
                        field.onChange(val);
                        setValue("salaryMax", val, { shouldDirty: true });
                        field.onBlur();
                      }}
                    />
                  );
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/50"
                {...register("showSalary")}
              />
              Mostrar sueldo en la publicación
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

          {(errors.salaryMin || errors.salaryMax) && (
            <p className="text-xs text-red-600">
              ⚠️ {(errors.salaryMin?.message as string) || (errors.salaryMax?.message as string)}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {disabledMessage ? (
            <p className="text-xs text-zinc-400">{disabledMessage}</p>
          ) : <span />}
          <button
            type="button"
            className={clsx(
              "rounded-xl px-6 py-2.5 text-sm font-bold transition-all",
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
