// components/WorkExperienceCard.tsx
"use client";

import React, { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";

export type WorkExperience = {
  id?: string;
  role: string;
  company: string;
  startDate: string;        // "YYYY-MM"
  endDate?: string | null;  // "YYYY-MM" | null | ""
  isCurrent?: boolean;
};

export type WorkExperienceErrors = {
  role?: { message?: string };
  company?: { message?: string };
  startDate?: { message?: string };
  endDate?: { message?: string };
};

export default function WorkExperienceCard({
  idx,
  exp, // solo para placeholder inicial; RHF controla los values
  error,
  onRemove,
  onMakeCurrent,
}: {
  idx: number;
  exp: WorkExperience;
  error?: WorkExperienceErrors;
  onRemove: (index: number) => void;
  onMakeCurrent: (idx: number, checked: boolean) => void;
}) {
  const { register, setValue, control } = useFormContext();

  // Observa SOLO el flag de "Actual" para deshabilitar el fin sin reinyectar valores
  const isCurrent = !!useWatch({
    control,
    name: `experiences.${idx}.isCurrent`,
  });

  // Si se marca "Actual", limpia endDate a null (sin tocar foco)
  useEffect(() => {
    if (isCurrent) {
      setValue(`experiences.${idx}.endDate`, null as any, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent]);

  return (
    <div className="border rounded-xl p-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm">Rol *</label>
          <input
            className="border rounded-xl p-2 w-full"
            placeholder={exp.role ? undefined : "Ej. Desarrollador Frontend"}
            autoComplete="off"
            {...register(`experiences.${idx}.role` as const)}
          />
          {error?.role?.message && (
            <p className="text-xs text-red-600">{error.role.message}</p>
          )}
        </div>

        <div>
          <label className="text-sm">Empresa *</label>
          <input
            className="border rounded-xl p-2 w-full"
            placeholder={exp.company ? undefined : "Ej. Acme Inc."}
            autoComplete="off"
            {...register(`experiences.${idx}.company` as const)}
          />
          {error?.company?.message && (
            <p className="text-xs text-red-600">{error.company.message}</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-sm">Inicio *</label>
          <input
            type="month"
            className="border rounded-xl p-2 w-full"
            {...register(`experiences.${idx}.startDate` as const)}
          />
          {error?.startDate?.message && (
            <p className="text-xs text-red-600">{error.startDate.message}</p>
          )}
        </div>

        <div>
          <label className="text-sm">Fin</label>
          <div className="flex items-center gap-3">
            <input
              type="month"
              className="border rounded-xl p-2 w-full"
              disabled={isCurrent}
              {...register(`experiences.${idx}.endDate` as const, {
                onChange: (e) => {
                  // si queda vacío, manda null para pasar el schema
                  if (String(e.target.value || "") === "") {
                    setValue(`experiences.${idx}.endDate`, null as any, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }
                },
              })}
            />

            <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                {...register(`experiences.${idx}.isCurrent` as const, {
                  onChange: (e) => onMakeCurrent(idx, e.target.checked),
                })}
              />
              Actual
            </label>
          </div>
          {error?.endDate?.message && (
            <p className="text-xs text-red-600">{error.endDate.message}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="text-red-500 hover:text-red-700 text-sm"
          onClick={() => onRemove(idx)}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
