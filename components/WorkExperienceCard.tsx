"use client";
import { useEffect, useMemo, useState } from "react";
import { Controller, Control, UseFormSetValue, useWatch } from "react-hook-form";

export type WorkExperience = {
  role: string;
  company: string;
  startDate: string;       // YYYY-MM
  endDate?: string | null; // YYYY-MM | null
  isCurrent?: boolean;
};

export type WorkExperienceErrors = {
  role?: { message?: string };
  company?: { message?: string };
  startDate?: { message?: string };
  endDate?: { message?: string };
} | undefined;

export type ProfileFormShape = {
  experiences: WorkExperience[];
};

const MONTHS_ES = [
  { v: "01", l: "Enero" },
  { v: "02", l: "Febrero" },
  { v: "03", l: "Marzo" },
  { v: "04", l: "Abril" },
  { v: "05", l: "Mayo" },
  { v: "06", l: "Junio" },
  { v: "07", l: "Julio" },
  { v: "08", l: "Agosto" },
  { v: "09", l: "Septiembre" },
  { v: "10", l: "Octubre" },
  { v: "11", l: "Noviembre" },
  { v: "12", l: "Diciembre" },
];

function splitYM(ym?: string | null) {
  if (!ym || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return { y: "", m: "" };
  return { y: ym.slice(0, 4), m: ym.slice(5, 7) };
}
function joinYM(y: string, m: string) {
  return y && m ? `${y}-${m}` : "";
}

export default function WorkExperienceCard({
  idx,
  control,
  setValue,
  error,
  onRemove,
}: {
  idx: number;
  control: Control<ProfileFormShape>;
  setValue: UseFormSetValue<ProfileFormShape>;
  error: WorkExperienceErrors;
  onRemove: (idx: number) => void;
}) {
  // Observa solo estos campos
  const startDate: string =
    useWatch({ control, name: `experiences.${idx}.startDate` as const }) ?? "";
  const endDate: string | null =
    useWatch({ control, name: `experiences.${idx}.endDate` as const }) ?? null;
  const isCurrent: boolean =
    useWatch({ control, name: `experiences.${idx}.isCurrent` as const }) ?? false;

  // Estado local para selects (evita que se "reseteen" al cambiar una parte)
  const [sMonth, setSMonth] = useState<string>("");
  const [sYear, setSYear] = useState<string>("");
  const [eMonth, setEMonth] = useState<string>("");
  const [eYear, setEYear] = useState<string>("");

  // Sync estados locales cuando cambia el form (por load/reset)
  useEffect(() => {
    const { y, m } = splitYM(startDate);
    setSYear(y); setSMonth(m);
  }, [startDate]);
  useEffect(() => {
    const { y, m } = splitYM(endDate ?? "");
    setEYear(y); setEMonth(m);
  }, [endDate]);

  // Años (1980..actual)
  const YEARS = useMemo(() => {
    const now = new Date().getFullYear();
    const arr: string[] = [];
    for (let y = now; y >= 1980; y--) arr.push(String(y));
    return arr;
  }, []);

  const err = (error ?? {}) as any;

  return (
    <div className="border rounded-xl p-3 grid md:grid-cols-12 gap-3">
      {/* Rol */}
      <div className="md:col-span-3">
        <label className="text-xs">Rol / Posición</label>
        <Controller
          control={control}
          name={`experiences.${idx}.role` as const}
          render={({ field }) => (
            <input className="border rounded-xl p-2 w-full" {...field} />
          )}
        />
        {err.role?.message && <p className="text-[11px] text-red-600">{err.role.message}</p>}
      </div>

      {/* Empresa */}
      <div className="md:col-span-3">
        <label className="text-xs">Empresa</label>
        <Controller
          control={control}
          name={`experiences.${idx}.company` as const}
          render={({ field }) => (
            <input className="border rounded-xl p-2 w-full" {...field} />
          )}
        />
        {err.company?.message && <p className="text-[11px] text-red-600">{err.company.message}</p>}
      </div>

      {/* Inicio Mes */}
      <div className="md:col-span-2">
        <label className="text-xs">Inicio (Mes)</label>
        <select
          className="border rounded-xl p-2 w-full"
          value={sMonth}
          onChange={(e) => {
            const m = e.target.value;
            setSMonth(m);
            const full = joinYM(sYear, m);
            setValue(`experiences.${idx}.startDate`, full);
          }}
        >
          <option value="">Mes</option>
          {MONTHS_ES.map((mm) => (
            <option key={mm.v} value={mm.v}>{mm.l}</option>
          ))}
        </select>
      </div>

      {/* Inicio Año */}
      <div className="md:col-span-2">
        <label className="text-xs">Inicio (Año)</label>
        <select
          className="border rounded-xl p-2 w-full"
          value={sYear}
          onChange={(e) => {
            const y = e.target.value;
            setSYear(y);
            const full = joinYM(y, sMonth);
            setValue(`experiences.${idx}.startDate`, full);
          }}
        >
          <option value="">Año</option>
          {YEARS.map((yy) => (
            <option key={yy} value={yy}>{yy}</option>
          ))}
        </select>
        {err.startDate?.message && <p className="text-[11px] text-red-600">{err.startDate.message}</p>}
      </div>

      {/* Fin Mes */}
      <div className="md:col-span-2">
        <label className="text-xs">Fin (Mes)</label>
        <select
          className="border rounded-xl p-2 w-full"
          value={isCurrent ? "" : eMonth}
          onChange={(e) => {
            const m = e.target.value;
            setEMonth(m);
            const full = joinYM(eYear, m);
            setValue(`experiences.${idx}.endDate`, isCurrent ? null : full || null);
          }}
          disabled={isCurrent}
        >
          <option value="">Mes</option>
          {MONTHS_ES.map((mm) => (
            <option key={mm.v} value={mm.v}>{mm.l}</option>
          ))}
        </select>
      </div>

      {/* Fin Año */}
      <div className="md:col-span-2">
        <label className="text-xs">Fin (Año)</label>
        <select
          className="border rounded-xl p-2 w-full"
          value={isCurrent ? "" : eYear}
          onChange={(e) => {
            const y = e.target.value;
            setEYear(y);
            const full = joinYM(y, eMonth);
            setValue(`experiences.${idx}.endDate`, isCurrent ? null : full || null);
          }}
          disabled={isCurrent}
        >
          <option value="">Año</option>
          {YEARS.map((yy) => (
            <option key={yy} value={yy}>{yy}</option>
          ))}
        </select>
        {err.endDate?.message && <p className="text-[11px] text-red-600">{err.endDate.message}</p>}
      </div>

      {/* Fila inferior: Actual + Eliminar */}
      <div className="md:col-span-12 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-sm">
          <Controller
            control={control}
            name={`experiences.${idx}.isCurrent` as const}
            render={({ field }) => (
              <input
                type="checkbox"
                checked={!!field.value}
                onChange={(e) => {
                  const checked = e.target.checked;
                  field.onChange(checked);
                  if (checked) {
                    setValue(`experiences.${idx}.endDate`, null);
                    setEMonth(""); setEYear("");
                  }
                }}
              />
            )}
          />
          Actual
        </label>

        <button
          type="button"
          className="text-xs text-red-600 hover:underline"
          onClick={() => onRemove(idx)}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
