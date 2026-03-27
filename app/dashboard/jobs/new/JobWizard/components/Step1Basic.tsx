// app/dashboard/jobs/new/JobWizard/components/Step1Basic.tsx
"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { MapPin, DollarSign, Briefcase, Clock } from "lucide-react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { JobForm, PresetCompany, TemplateJob } from "../types";
import TemplateSelector from "./TemplateSelector";
import SchedulePicker from "./SchedulePicker";
import { EMPLOYMENT_TYPE_OPTIONS } from "../lib/job-enums";

type Step1BasicProps = {
  presetCompany: PresetCompany;
  templates: TemplateJob[];
  onApplyTemplate: (id: string) => void;
  onNext: () => void;
};

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

  const locationType = watch("locationType");
  const city = watch("city");
  const title = watch("title");
  const salaryMin = watch("salaryMin");
  const salaryMax = watch("salaryMax");
  const employmentType = watch("employmentType");
  const schedule = watch("schedule") || "";

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

  const salaryNeedsSwap =
    salaryMin && salaryMax &&
    !Number.isNaN(Number(salaryMin)) && !Number.isNaN(Number(salaryMax)) &&
    Number(salaryMin) > Number(salaryMax);

  const cityRequired = locationType === "HYBRID" || locationType === "ONSITE";

  const canNext =
    !!title?.trim() && !!employmentType &&
    !(cityRequired && !city?.trim()) && !salaryNeedsSwap;

  const disabledMessage = !canNext
    ? !title?.trim() ? "Falta nombre de vacante"
    : !employmentType ? "Falta tipo de empleo"
    : cityRequired && !city?.trim() ? "Falta ciudad"
    : null
    : null;

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-5">

        {/* Template Selector */}
        {templates.length > 0 && (
          <TemplateSelector templates={templates} onApply={onApplyTemplate} />
        )}

        {/* Título */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Nombre de la vacante <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls(errors.title, "h-11 px-3")}
            placeholder="Ej: Desarrollador Full Stack Senior"
            {...register("title")}
            aria-invalid={errors.title ? "true" : "false"}
          />
          {errors.title && (
            <p className="flex items-center gap-1 text-xs text-red-600">⚠️ {errors.title.message}</p>
          )}
          {!errors.title && title && title.length < 10 && (
            <p className="text-xs text-amber-600">💡 Un título más descriptivo atrae más candidatos</p>
          )}
        </div>

        {/* Sueldo — debajo del título para máximo impacto */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Sueldo <span className="text-xs font-normal text-zinc-400">(opcional)</span>
          </label>
          <div className="grid grid-cols-[88px_1fr_1fr] gap-2">
            <select
              className={inputCls(undefined, "h-11 px-2")}
              {...register("currency")}
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>

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

        {/* Empresa — tarjetas compactas */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Empresa <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white p-3 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20">
              <input type="radio" value="own" className="sr-only" {...register("companyMode")} disabled={!presetCompany?.id} />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {presetCompany?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mi empresa</p>
                <p className="truncate text-[11px] text-zinc-500">{presetCompany?.name || "(no asignada)"}</p>
              </div>
              <div className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 rounded-full border-2 border-zinc-300 bg-white [label:has(:checked)_&]:border-emerald-500 [label:has(:checked)_&]:bg-emerald-500 dark:bg-zinc-900" />
            </label>

            <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white p-3 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20">
              <input type="radio" value="external" className="sr-only" {...register("companyMode")} />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">🔒</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Confidencial</p>
                <p className="text-[11px] text-zinc-500">Ocultar nombre</p>
              </div>
              <div className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 rounded-full border-2 border-zinc-300 bg-white [label:has(:checked)_&]:border-emerald-500 [label:has(:checked)_&]:bg-emerald-500 dark:bg-zinc-900" />
            </label>
          </div>
        </div>

        {/* Ubicación + Tipo de empleo en una fila */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Ubicación */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-emerald-500" />
              Ubicación <span className="text-red-500">*</span>
            </label>
            <select className={inputCls(undefined, "h-11 px-3")} {...register("locationType")}>
              <option value="REMOTE">🌎 Remoto</option>
              <option value="HYBRID">🏢 Híbrido</option>
              <option value="ONSITE">🏛️ Presencial</option>
            </select>
            {cityRequired && (
              <div className="min-w-0 overflow-hidden">
                <p className="mb-1.5 text-xs text-muted-foreground">Escribe ciudad y selecciona una sugerencia.</p>
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

          {/* Tipo de empleo */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Briefcase className="h-4 w-4 text-emerald-500" />
              Tipo de empleo <span className="text-red-500">*</span>
            </label>
            <select className={inputCls(errors.employmentType, "h-11 px-3")} {...register("employmentType")}>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.employmentType && <p className="text-xs text-red-600">{errors.employmentType.message}</p>}
          </div>
        </div>

        {/* Horario — fila completa */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="h-4 w-4 text-emerald-500" />
            Horario <span className="text-xs font-normal text-zinc-400">(opcional)</span>
          </label>
          <SchedulePicker
            value={schedule}
            onChange={(val) => setValue("schedule", val, { shouldDirty: true })}
          />
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