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
    "w-full rounded-lg border bg-white p-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(digits)
  );
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
    salaryMin &&
    salaryMax &&
    !Number.isNaN(Number(salaryMin)) &&
    !Number.isNaN(Number(salaryMax)) &&
    Number(salaryMin) > Number(salaryMax);

  const cityRequired = locationType === "HYBRID" || locationType === "ONSITE";

  const canNext =
    !!title?.trim() &&
    !!employmentType &&
    !(cityRequired && !city?.trim()) &&
    !salaryNeedsSwap;

  const disabledMessage = !canNext
    ? !title?.trim()
      ? "Falta nombre de vacante"
      : !employmentType
        ? "Falta tipo de empleo"
        : cityRequired && !city?.trim()
          ? "Falta ciudad"
          : null
    : null;

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-5">

        {templates.length > 0 && (
          <TemplateSelector templates={templates} onApply={onApplyTemplate} />
        )}

        {/* Título */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span>Nombre de la vacante</span>
            <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls(errors.title, "h-11 px-3 py-2")}
            placeholder="Ej: Desarrollador Full Stack Senior"
            {...register("title")}
            aria-invalid={errors.title ? "true" : "false"}
          />
          {errors.title && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <span>⚠️</span>
              {errors.title.message}
            </p>
          )}
          {!errors.title && title && title.length < 10 && (
            <p className="text-xs text-amber-600">
              💡 Tip: Un título más descriptivo atrae más candidatos
            </p>
          )}
        </div>

        {/* Empresa — tarjetas horizontales compactas */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span>Empresa</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Mi empresa */}
            <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white p-3 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20">
              <input
                type="radio"
                value="own"
                className="sr-only"
                {...register("companyMode")}
                disabled={!presetCompany?.id}
              />
              {/* Avatar inicial */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {presetCompany?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mi empresa</p>
                <p className="truncate text-[11px] text-zinc-500">{presetCompany?.name || "(no asignada)"}</p>
              </div>
              {/* Check decorativo */}
              <div className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 rounded-full border-2 border-zinc-300 bg-white opacity-0 transition-opacity group-has-[:checked]:opacity-100 dark:bg-zinc-900 [label:has(:checked)_&]:opacity-100 [label:has(:checked)_&]:border-emerald-500 [label:has(:checked)_&]:bg-emerald-500" />
            </label>

            {/* Empresa externa */}
            <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white p-3 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20">
              <input
                type="radio"
                value="external"
                className="sr-only"
                {...register("companyMode")}
              />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">
                🔒
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Confidencial</p>
                <p className="text-[11px] text-zinc-500">Ocultar nombre</p>
              </div>
              <div className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 rounded-full border-2 border-zinc-300 bg-white opacity-0 [label:has(:checked)_&]:opacity-100 [label:has(:checked)_&]:border-emerald-500 [label:has(:checked)_&]:bg-emerald-500 dark:bg-zinc-900" />
            </label>
          </div>
        </div>

        {/* Tipo de empleo + Horario */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Briefcase className="h-4 w-4 text-emerald-500" />
              <span>Tipo de empleo</span>
              <span className="text-red-500">*</span>
            </label>
            <select
              className={inputCls(errors.employmentType, "h-11 px-3 py-2")}
              {...register("employmentType")}
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.employmentType && (
              <p className="text-xs text-red-600">{errors.employmentType.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span>Horario</span>
              <span className="text-xs font-normal text-zinc-400">(opcional)</span>
            </label>
            <SchedulePicker
              value={schedule}
              onChange={(val) => setValue("schedule", val, { shouldDirty: true })}
            />
          </div>
        </div>

        {/* Ubicación y Sueldo */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {/* Ubicación */}
          <div className="min-w-0 space-y-1.5 overflow-hidden">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-emerald-500" />
              <span>Ubicación</span>
              <span className="text-red-500">*</span>
            </label>

            <select
              className={inputCls(undefined, "h-11 px-3 py-2")}
              {...register("locationType")}
            >
              <option value="REMOTE">🌎 Remoto</option>
              <option value="HYBRID">🏢 Híbrido</option>
              <option value="ONSITE">🏛️ Presencial</option>
            </select>

            {cityRequired ? (
              <div className="relative min-w-0 overflow-hidden">
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Escribe ciudad y selecciona una sugerencia.
                </p>
                <Controller
                  control={control}
                  name="city"
                  render={({ field: { value, onChange } }) => (
                    <LocationAutocomplete
                      value={value || ""}
                      onChange={(next: unknown) => {
                        if (typeof next === "string") {
                          onChange(next);
                          return;
                        }
                        if (next && typeof next === "object") {
                          const place = next as {
                            label?: string;
                            city?: string;
                            country?: string;
                            admin1?: string;
                            cityNorm?: string;
                            admin1Norm?: string;
                            lat?: number;
                            lng?: number;
                          };
                          onChange(place.label || place.city || "");
                          setValue("country", place.country || "");
                          setValue("admin1", place.admin1 || "");
                          setValue("cityNorm", place.cityNorm || "");
                          setValue("admin1Norm", place.admin1Norm || "");
                          setValue(
                            "locationLat",
                            typeof place.lat === "number" && Number.isFinite(place.lat) ? place.lat : null
                          );
                          setValue(
                            "locationLng",
                            typeof place.lng === "number" && Number.isFinite(place.lng) ? place.lng : null
                          );
                          return;
                        }
                        onChange("");
                        setValue("country", "");
                        setValue("admin1", "");
                        setValue("cityNorm", "");
                        setValue("admin1Norm", "");
                        setValue("locationLat", null);
                        setValue("locationLng", null);
                      }}
                      onPlace={() => {}}
                      countries={["mx"]}
                      className={inputCls(errors.city, "h-11 px-3 py-2")}
                    />
                  )}
                />
                {errors.city && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <span>⚠️</span>
                    {errors.city.message as string}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Para vacantes remotas no es obligatorio capturar ciudad.
              </p>
            )}
          </div>

          {/* Sueldo */}
          <div className="relative z-10 min-w-0 space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span>Sueldo</span>
              <span className="text-xs font-normal text-zinc-400">(opcional)</span>
            </label>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)]">
              <select
                className={inputCls(undefined, "h-11 w-full sm:w-[112px] sm:min-w-[112px] px-3 py-2 pr-10")}
                {...register("currency")}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>

              <Controller
                name="salaryMin"
                control={control}
                render={({ field }) => {
                  const rawValue =
                    typeof field.value === "number" || typeof field.value === "string"
                      ? String(field.value) : "";
                  const displayValue = salaryMinFocused ? rawValue : formatSalary(rawValue);
                  return (
                    <input
                      type="text" inputMode="numeric"
                      name={field.name} ref={field.ref}
                      className={inputCls(errors.salaryMin, "h-11 w-full min-w-0 px-3 py-2")}
                      placeholder="Desde"
                      value={displayValue}
                      onFocus={() => setSalaryMinFocused(true)}
                      onChange={(e) => field.onChange(parseSalaryInput(e.target.value))}
                      onBlur={(e) => {
                        setSalaryMinFocused(false);
                        field.onChange(parseSalaryInput(e.target.value));
                        field.onBlur();
                      }}
                    />
                  );
                }}
              />

              <Controller
                name="salaryMax"
                control={control}
                render={({ field }) => {
                  const rawValue =
                    typeof field.value === "number" || typeof field.value === "string"
                      ? String(field.value) : "";
                  const displayValue = salaryMaxFocused ? rawValue : formatSalary(rawValue);
                  return (
                    <input
                      type="text" inputMode="numeric"
                      name={field.name} ref={field.ref}
                      className={inputCls(errors.salaryMax, "h-11 w-full min-w-0 px-3 py-2")}
                      placeholder="Hasta"
                      value={displayValue}
                      onFocus={() => setSalaryMaxFocused(true)}
                      onChange={(e) => field.onChange(parseSalaryInput(e.target.value))}
                      onBlur={(e) => {
                        setSalaryMaxFocused(false);
                        field.onChange(parseSalaryInput(e.target.value));
                        field.onBlur();
                      }}
                    />
                  );
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Recomendado: mejora el match y la visibilidad.
            </p>

            {salaryNeedsSwap && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700">
                <span>¿Intercambiar valores?</span>
                <button
                  type="button"
                  className="font-medium text-emerald-700 hover:text-emerald-600"
                  onClick={() => {
                    setValue("salaryMin", salaryMax ?? undefined, { shouldDirty: true, shouldValidate: true });
                    setValue("salaryMax", salaryMin ?? undefined, { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  Intercambiar
                </button>
              </div>
            )}

            {(errors.salaryMin || errors.salaryMax) && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <span>⚠️</span>
                {(errors.salaryMin?.message as string) || (errors.salaryMax?.message as string)}
              </p>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500/50"
                {...register("showSalary")}
              />
              <span>Mostrar sueldo en la publicación</span>
            </label>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col items-stretch gap-2 border-t border-zinc-200 pt-4 sm:items-end dark:border-zinc-800">
          {disabledMessage && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{disabledMessage}</p>
          )}
          <button
            type="button"
            className={clsx(
              "w-full rounded-lg px-6 py-3 font-semibold transition-all sm:w-auto",
              canNext
                ? "bg-emerald-600 text-white hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg active:translate-y-0"
                : "cursor-not-allowed bg-emerald-300 text-white"
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