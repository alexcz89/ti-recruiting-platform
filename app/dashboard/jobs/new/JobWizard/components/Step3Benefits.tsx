// app/dashboard/jobs/new/JobWizard/components/Step3Benefits.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { useState } from "react";
import clsx from "clsx";
import { JobForm } from "../types";
import { BENEFITS } from "../constants";
import NumberMini from "./NumberMini";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export default function Step3Benefits({ onNext, onBack }: Props) {
  const { watch, setValue, register } = useFormContext<JobForm>();

  const benefits   = watch("benefits");
  const showBenefits = watch("showBenefits");
  const valesMonto  = watch("valesMonto");
  const otrosItems  = watch("otrosItems") ?? [];

  // Input local para agregar un nuevo "otro"
  const [otroInput, setOtroInput] = useState("");

  function addOtro() {
    const trimmed = otroInput.trim();
    if (!trimmed) return;
    // evitar duplicados
    if (otrosItems.includes(trimmed)) { setOtroInput(""); return; }
    setValue("otrosItems", [...otrosItems, trimmed], { shouldDirty: true });
    setOtroInput("");
  }

  function removeOtro(idx: number) {
    setValue(
      "otrosItems",
      otrosItems.filter((_, i) => i !== idx),
      { shouldDirty: true }
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
        3) Prestaciones
      </h3>

      {/* Toggle mostrar prestaciones */}
      <div
        className={clsx(
          "rounded-lg border p-4 flex items-start justify-between gap-4",
          showBenefits
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        )}
      >
        <div className="text-sm">
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            Mostrar prestaciones en la publicación
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Recomendado: aumenta conversiones
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("showBenefits")} />
          {showBenefits ? "Si" : "No"}
        </label>
      </div>

      {/* Grid de prestaciones */}
      <div className="grid sm:grid-cols-2 gap-4">
        {BENEFITS.map((b) => {
          const checked = !!benefits[b.key];
          const isOtros = b.key === "otros";
          const isVales = b.key === "vales";

          return (
            <div key={b.key} className={clsx(isOtros && checked ? "sm:col-span-2" : "")}>
              <label
                className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition cursor-pointer hover:bg-zinc-50 hover:border-zinc-300 dark:hover:bg-zinc-800/40 dark:hover:border-zinc-600 active:scale-[0.98] has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20 dark:has-[:checked]:border-emerald-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/40 has-[:focus-visible]:outline-none"
              >
                <input
                  id={`benefit-${b.key}`}
                  type="checkbox"
                  className="accent-emerald-600"
                  checked={checked}
                  onChange={(e) => {
                    setValue(
                      "benefits",
                      { ...benefits, [b.key]: e.target.checked },
                      { shouldDirty: true }
                    );
                    // Al desmarcar "otros", limpiar la lista
                    if (isOtros && !e.target.checked) {
                      setValue("otrosItems", [], { shouldDirty: true });
                    }
                    // Al desmarcar "vales", limpiar monto
                    if (isVales && !e.target.checked) {
                      setValue("valesMonto", null, { shouldDirty: true });
                    }
                  }}
                />
                <span className="min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-100 whitespace-normal break-normal hyphens-none leading-tight">
                  {b.label}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  {checked && b.key === "aguinaldo" && (
                    <NumberMini label="días" field="aguinaldoDias" />
                  )}
                  {checked && b.key === "vacaciones" && (
                    <NumberMini label="días" field="vacacionesDias" />
                  )}
                  {checked && b.key === "primaVac" && (
                    <NumberMini label="%" field="primaVacPct" max={100} />
                  )}
                  {/* Monto mensual de vales */}
                  {checked && isVales && (
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.preventDefault()}
                    >
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">$</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="monto/mes"
                        value={valesMonto ?? ""}
                        onChange={(e) =>
                          setValue(
                            "valesMonto",
                            e.target.value === "" ? null : Number(e.target.value),
                            { shouldDirty: true }
                          )
                        }
                        className="w-24 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">/ mes</span>
                    </div>
                  )}
                </div>
              </label>

              {/* Panel expandible de "Otros" */}
              {isOtros && checked && (
                <div
                  className="mt-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-3"
                  onClick={(e) => e.preventDefault()}
                >
                  {/* Lista de items agregados */}
                  {otrosItems.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {otrosItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => removeOtro(idx)}
                            className="text-zinc-400 hover:text-red-500 transition leading-none"
                            aria-label={`Eliminar ${item}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input para agregar */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otroInput}
                      onChange={(e) => setOtroInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addOtro(); }
                      }}
                      placeholder="Ej: Gimnasio, Seguro dental, Home office..."
                      className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={addOtro}
                      disabled={!otroInput.trim()}
                      className="rounded border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      + Agregar
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Presiona Enter o el botón para agregar cada beneficio adicional.
                  </p>
                </div>
              )}
            </div>
          );
        })}
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