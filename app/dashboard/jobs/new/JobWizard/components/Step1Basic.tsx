// app/dashboard/jobs/new/JobWizard/components/Step1Basic.tsx
"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { MapPin, DollarSign, Building2, Briefcase, Check } from "lucide-react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { JobForm, PresetCompany, TemplateJob } from "../types";
import TemplateSelector from "./TemplateSelector";
import { EMPLOYMENT_TYPE_OPTIONS } from "../lib/job-enums";

const SCHEDULE_SUGGESTIONS = [
  "L-V 9:00–18:00",
  "L-V 8:00–17:00",
  "L-S 9:00–18:00",
  "L-V 13:00–22:00",
];

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

  const [salaryMinFocused, setSalaryMinFocused] = useState(false);
  const [salaryMaxFocused, setSalaryMaxFocused] = useState(false);

  useEffect(() => {
    if (locationType === "REMOTE") {
      setValue("city", "", { shouldDirty: true, shouldValidate: true });
      setValue("country", "", { shouldDirty: true, shouldValidate: false });
      setValue("admin1", "", { shouldDirty: true, shouldValidate: false });
      setValue("cityNorm", "", { shouldDirty: true, shouldValidate: false });
      setValue("admin1Norm", "", { shouldDirty: true, shouldValidate: false });
      setValue("locationLat", null, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue("locationLng", null, {
        shouldDirty: true,
        shouldValidate: false,
      });
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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Datos básicos</h3>
            <p className="text-sm text-muted-foreground">
              Información general de la vacante
            </p>
          </div>
        </div>

        {templates.length > 0 && (
          <div className="mb-6">
            <TemplateSelector templates={templates} onApply={onApplyTemplate} />
          </div>
        )}

        <div className="grid gap-6">
          <div className="space-y-2 py-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span>Nombre de la vacante</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls(errors.title)}
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

          <div className="space-y-2 py-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span>Empresa</span>
              <span className="text-red-500">*</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              <label className="relative flex min-h-[110px] cursor-pointer items-center gap-3 rounded-lg border-2 border-zinc-200 bg-white p-5 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20 sm:min-h-[120px] sm:p-6">
                <Check className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-emerald-600 opacity-0 transition-opacity has-[:checked]:opacity-100" />
                <input
                  type="radio"
                  value="own"
                  className="h-4 w-4 shrink-0 text-emerald-600"
                  {...register("companyMode")}
                  disabled={!presetCompany?.id}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">Mi empresa</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {presetCompany?.name || "(no asignada)"}
                  </div>
                </div>
              </label>

              <label className="relative flex min-h-[110px] cursor-pointer items-center gap-3 rounded-lg border-2 border-zinc-200 bg-white p-5 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20 sm:min-h-[120px] sm:p-6">
                <Check className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-emerald-600 opacity-0 transition-opacity has-[:checked]:opacity-100" />
                <input
                  type="radio"
                  value="external"
                  className="h-4 w-4 shrink-0 text-emerald-600"
                  {...register("companyMode")}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">Empresa externa</div>
                  <div className="text-xs text-muted-foreground">
                    Publicar para otra empresa
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
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
                <p className="text-xs text-red-600">
                  {errors.employmentType.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Horario (opcional)
              </label>
              <input
                type="text"
                list="schedule-suggestions"
                placeholder="Ej. L-V 9:00–18:00"
                className={inputCls(undefined, "h-11 px-3 py-2")}
                {...register("schedule")}
              />
              <datalist id="schedule-suggestions">
                {SCHEDULE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid items-start gap-6 py-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 space-y-2 overflow-hidden">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
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
                <div className="relative mt-3 min-w-0 overflow-hidden">
                  <p className="mb-2 text-xs text-muted-foreground">
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
                              typeof place.lat === "number" &&
                                Number.isFinite(place.lat)
                                ? place.lat
                                : null
                            );
                            setValue(
                              "locationLng",
                              typeof place.lng === "number" &&
                                Number.isFinite(place.lng)
                                ? place.lng
                                : null
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
                <p className="mt-3 text-xs text-muted-foreground">
                  Para vacantes remotas no es obligatorio capturar ciudad.
                </p>
              )}
            </div>

            <div className="relative z-10 min-w-0 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span>Sueldo (opcional)</span>
              </label>

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)]">
                <select
                  className={inputCls(
                    undefined,
                    "h-11 w-full sm:w-[112px] sm:min-w-[112px] px-3 py-2 pr-10"
                  )}
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
                      typeof field.value === "number" ||
                      typeof field.value === "string"
                        ? String(field.value)
                        : "";
                    const displayValue = salaryMinFocused
                      ? rawValue
                      : formatSalary(rawValue);

                    return (
                      <input
                        type="text"
                        inputMode="numeric"
                        name={field.name}
                        ref={field.ref}
                        className={inputCls(
                          errors.salaryMin,
                          "h-11 w-full min-w-0 px-3 py-2"
                        )}
                        placeholder="Desde"
                        value={displayValue}
                        onFocus={() => setSalaryMinFocused(true)}
                        onChange={(e) =>
                          field.onChange(parseSalaryInput(e.target.value))
                        }
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
                      typeof field.value === "number" ||
                      typeof field.value === "string"
                        ? String(field.value)
                        : "";
                    const displayValue = salaryMaxFocused
                      ? rawValue
                      : formatSalary(rawValue);

                    return (
                      <input
                        type="text"
                        inputMode="numeric"
                        name={field.name}
                        ref={field.ref}
                        className={inputCls(
                          errors.salaryMax,
                          "h-11 w-full min-w-0 px-3 py-2"
                        )}
                        placeholder="Hasta"
                        value={displayValue}
                        onFocus={() => setSalaryMaxFocused(true)}
                        onChange={(e) =>
                          field.onChange(parseSalaryInput(e.target.value))
                        }
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
                      setValue("salaryMin", salaryMax ?? undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      setValue("salaryMax", salaryMin ?? undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    Intercambiar
                  </button>
                </div>
              )}

              {(errors.salaryMin || errors.salaryMax) && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <span>⚠️</span>
                  {(errors.salaryMin?.message as string) ||
                    (errors.salaryMax?.message as string)}
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
        </div>

        <div className="mt-6 flex flex-col items-stretch gap-2 border-t border-zinc-200 pt-4 sm:items-end dark:border-zinc-800">
          {disabledMessage && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {disabledMessage}
            </p>
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