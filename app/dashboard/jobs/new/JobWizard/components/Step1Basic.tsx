// JobWizard/components/Step1Basic.tsx
"use client";

import { Controller, useFormContext } from "react-hook-form";
import { MapPin, DollarSign, Building2 } from "lucide-react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { JobForm, PresetCompany, TemplateJob } from "../types";
import TemplateSelector from "./TemplateSelector";

type Step1BasicProps = {
  presetCompany: PresetCompany;
  templates: TemplateJob[];
  onApplyTemplate: (id: string) => void;
  onNext: () => void;
};

const inputCls = (err?: any) =>
  clsx(
    "w-full rounded-lg border bg-white p-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
    err ? "border-red-500 dark:border-red-500" : "border-zinc-300"
  );

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

  const canNext =
    !!title?.trim() &&
    !(
      (locationType === "HYBRID" || locationType === "ONSITE") &&
      !city?.trim()
    ) &&
    !(
      salaryMin &&
      salaryMax &&
      !Number.isNaN(Number(salaryMin)) &&
      !Number.isNaN(Number(salaryMax)) &&
      Number(salaryMin) > Number(salaryMax)
    );

  return (
    <section className="p-6 lg:p-8">
      <div className="space-y-10">
        {/* Header */}
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

        {/* Template Selector */}
        {templates.length > 0 && (
          <div className="mb-6">
            <TemplateSelector
              templates={templates}
              onApply={onApplyTemplate}
            />
          </div>
        )}

        <div className="grid gap-10">
        {/* Título */}
        <div className="space-y-2 py-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>Nombre de la vacante</span>
            <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls(errors.title)}
            placeholder="Ej: Desarrollador Full Stack Senior"
            {...register("title")}
            aria-invalid={errors.title ? "true" : "false"}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          {errors.title && (
            <p id="title-error" className="text-xs text-red-600 flex items-center gap-1">
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

        {/* Empresa */}
        <div className="space-y-2 py-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>Empresa</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="grid gap-10 sm:grid-cols-2">
            <label className="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 border-zinc-200 bg-white min-h-[120px] p-6 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20">
              <input
                type="radio"
                value="own"
                className="h-4 w-4 text-emerald-600"
                {...register("companyMode")}
                disabled={!presetCompany?.id}
              />
              <div className="flex-1">
                <div className="font-medium text-foreground">Mi empresa</div>
                <div className="text-xs text-muted-foreground">
                  {presetCompany?.name || "(no asignada)"}
                </div>
              </div>
            </label>

            <label className="relative flex cursor-pointer items-center gap-3 rounded-lg border-2 border-zinc-200 bg-white min-h-[120px] p-6 transition-all hover:border-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20">
              <input
                type="radio"
                value="confidential"
                className="h-4 w-4 text-emerald-600"
                {...register("companyMode")}
              />
              <div className="flex-1">
                <div className="font-medium text-foreground">Confidencial</div>
                <div className="text-xs text-muted-foreground">
                  Ocultar nombre
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Ubicación y Sueldo en grid */}
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Ubicación */}
          <div className="space-y-2 py-4">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-emerald-500" />
              <span>Ubicación</span>
              <span className="text-red-500">*</span>
            </label>
            <select
              className={inputCls()}
              {...register("locationType")}
            >
              <option value="REMOTE">🌎 Remoto</option>
              <option value="HYBRID">🏢 Híbrido</option>
              <option value="ONSITE">🏛️ Presencial</option>
            </select>

            {(locationType === "HYBRID" || locationType === "ONSITE") && (
              <div className="mt-3">
                <Controller
                  control={control}
                  name="city"
                  render={({ field: { value, onChange } }) => (
                    <LocationAutocomplete
                      value={value || ""}
                      onChange={(next: any) => {
                        if (typeof next === "string") {
                          onChange(next);
                          return;
                        }
                        if (next && typeof next === "object") {
                          onChange(next.label || next.city || "");
                          setValue("country", next.country || "");
                          setValue("admin1", next.admin1 || "");
                          setValue("cityNorm", next.cityNorm || "");
                          setValue("admin1Norm", next.admin1Norm || "");
                          setValue(
                            "locationLat",
                            typeof next.lat === "number" && Number.isFinite(next.lat)
                              ? next.lat
                              : null
                          );
                          setValue(
                            "locationLng",
                            typeof next.lng === "number" && Number.isFinite(next.lng)
                              ? next.lng
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
                    />
                  )}
                />
                {errors.city && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.city.message as string}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sueldo */}
          <div className="space-y-2 py-4">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span>Sueldo (opcional)</span>
            </label>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
              <select
                className="rounded-lg border border-zinc-300 bg-white p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900"
                {...register("currency")}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
              <input
                className={inputCls(errors.salaryMin)}
                type="number"
                placeholder="Mínimo"
                {...register("salaryMin")}
                min={0}
              />
              <input
                className={inputCls(errors.salaryMax)}
                type="number"
                placeholder="Máximo"
                {...register("salaryMax")}
                min={0}
              />
            </div>
            {(errors.salaryMin || errors.salaryMax) && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <span>⚠️</span>
                {(errors.salaryMin?.message as string) ||
                  (errors.salaryMax?.message as string)}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
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

        {/* Navigation */}
        <div className="flex justify-end gap-3 pt-8 mt-8 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            className={clsx(
              "rounded-lg px-6 py-3 font-semibold transition-all",
              canNext
                ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                : "bg-emerald-300 text-white cursor-not-allowed"
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
