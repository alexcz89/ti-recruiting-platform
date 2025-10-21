// components/LanguageRow.tsx
"use client";

import { Controller, useFormContext } from "react-hook-form";
import { LANGUAGE_LEVELS } from "@/lib/skills";

export type LanguageItem = {
  termId: string;
  label: string;
  level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
};

export default function LanguageRow({
  idx,
  item,
  options,
  onRemove,
}: {
  idx: number;
  item: LanguageItem;
  options: { id: string; label: string }[];
  onRemove: (index: number) => void;
}) {
  const { control } = useFormContext();

  return (
    <div className="flex flex-col md:flex-row gap-2 md:items-center">
      {/* Idioma (select forzado al catálogo) */}
      <Controller
        control={control}
        name={`languages.${idx}.termId`}
        render={({ field }) => (
          <select
            {...field}
            className="border rounded-xl p-2 md:flex-1"
          >
            <option value="">Selecciona idioma</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      />

      {/* Nivel */}
      <Controller
        control={control}
        name={`languages.${idx}.level`}
        render={({ field }) => (
          <select
            {...field}
            className="border rounded-xl p-2 md:w-60"
          >
            {LANGUAGE_LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>
                {lvl.label}
              </option>
            ))}
          </select>
        )}
      />

      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="text-red-600 hover:text-red-800 text-sm"
      >
        ×
      </button>
    </div>
  );
}
