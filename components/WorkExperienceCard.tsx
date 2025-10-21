// components/WorkExperienceCard.tsx
"use client";

import React, { useEffect } from "react";
import { useFormContext } from "react-hook-form";

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
  exp,
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
  const { register, setValue, watch } = useFormContext();
  const isCurrent = watch(`experiences.${idx}.isCurrent`) as boolean | undefined;

  // Si se marca "Actual", limpia endDate a null para que pase el schema
  useEffect(() => {
    if (isCurrent) {
      setValue(`experiences.${idx}.endDate`, null as any, { shouldValidate: true, shouldDirty: true });
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
            {...register(`experiences.${idx}.role` as const)}
            defaultValue={exp.role || ""}
          />
          {error?.role?.message && <p className="text-xs text-red-600">{error.role.message}</p>}
        </div>

        <div>
          <label className="text-sm">Empresa *</label>
          <input
            className="border rounded-xl p-2 w-full"
            {...register(`experiences.${idx}.company` as const)}
            defaultValue={exp.company || ""}
          />
          {error?.company?.message && <p className="text-xs text-red-600">{error.company.message}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-sm">Inicio *</label>
          <input
            type="month"
            className="border rounded-xl p-2 w-full"
            {...register(`experiences.${idx}.startDate` as const)}
            defaultValue={exp.startDate || ""}
          />
          {error?.startDate?.message && <p className="text-xs text-red-600">{error.startDate.message}</p>}
        </div>

        <div>
          <label className="text-sm">Fin</label>
          <div className="flex items-center gap-3">
            <input
              type="month"
              className="border rounded-xl p-2 w-full"
              {...register(`experiences.${idx}.endDate` as const, {
                onChange: (e) => {
                  // si lo deja vacío, guárdalo como null para pasar el schema
                  const v = String(e.target.value || "");
                  if (v === "") {
                    setValue(`experiences.${idx}.endDate`, null as any, { shouldValidate: true, shouldDirty: true });
                  }
                },
              })}
              defaultValue={exp.endDate || ""}
              disabled={!!isCurrent}
            />

            <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                {...register(`experiences.${idx}.isCurrent` as const)}
                defaultChecked={!!exp.isCurrent}
                onChange={(e) => onMakeCurrent(idx, e.target.checked)}
              />
              Actual
            </label>
          </div>
          {error?.endDate?.message && <p className="text-xs text-red-600">{error.endDate.message}</p>}
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
