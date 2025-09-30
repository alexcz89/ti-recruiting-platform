// components/LanguageRow.tsx
"use client";

import { useMemo, useState, useRef } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { LANGUAGE_LEVELS } from "@/lib/skills";

export type LanguageItem = {
  termId: string; // id del TaxonomyTerm (LANGUAGE)
  label: string;  // texto visible (ej. "Inglés")
  level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
};

type LanguageOption = { id: string; label: string };

export default function LanguageRow({
  idx,
  options,
  onRemove,
}: {
  idx: number;
  options: LanguageOption[];
  onRemove: (idx: number) => void;
}) {
  const { control, setValue } = useFormContext();

  // Observamos el valor del label para filtrar opciones sin romper el control de RHF
  const currentLabel: string =
    useWatch({ control, name: `languages.${idx}.label` }) || "";

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const filtered = useMemo(() => {
    const q = currentLabel.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [currentLabel, options]);

  function selectOption(opt: LanguageOption) {
    setValue(`languages.${idx}.label`, opt.label, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(`languages.${idx}.termId`, opt.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setOpen(false);
  }

  // Cuando el usuario escribe manualmente, “desvinculamos” el termId hasta confirmar
  function handleTyping(nextValue: string) {
    // Solo actualizamos label; RHF controla el input -> escritura fluida
    setValue(`languages.${idx}.label`, nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
    // Si deja de coincidir exacto con alguna opción, limpiamos termId
    const exact = options.find(
      (o) => o.label.toLowerCase() === nextValue.trim().toLowerCase()
    );
    setValue(`languages.${idx}.termId`, exact ? exact.id : "", {
      shouldDirty: true,
      shouldValidate: false,
    });
  }

  // Al salir del input, si el texto coincide EXACTO con una opción -> fijamos termId
  function handleBlur() {
    const exact = options.find(
      (o) => o.label.toLowerCase() === currentLabel.trim().toLowerCase()
    );
    setValue(`languages.${idx}.termId`, exact ? exact.id : "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    // Cerramos el menú un tick después para permitir click en opción (por si acaso)
    setTimeout(() => setOpen(false), 100);
  }

  return (
    <div className="flex flex-col md:flex-row gap-2 md:items-center">
      {/* Idioma (typeahead simple controlado por RHF) */}
      <div className="relative md:flex-1">
        <Controller
          name={`languages.${idx}.label`}
          control={control}
          render={({ field }) => (
            <input
              // RHF controla el input (sin onChange manual que rompa el foco)
              value={field.value ?? ""}
              onChange={(e) => {
                handleTyping(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={handleBlur}
              className="border rounded-xl p-3 w-full"
              placeholder="Ej. Inglés"
              autoComplete="off"
            />
          )}
        />

        {/* termId oculto pero sincronizado */}
        <Controller
          name={`languages.${idx}.termId`}
          control={control}
          render={({ field }) => <input type="hidden" {...field} />}
        />

        {/* Dropdown de sugerencias */}
        {open && filtered.length > 0 && (
          <ul
            ref={menuRef}
            className="absolute z-10 mt-1 w-full max-h-56 overflow-auto bg-white border rounded-xl shadow"
          >
            {filtered.map((opt) => (
              <li
                key={opt.id}
                className="px-3 py-2 cursor-pointer hover:bg-gray-50"
                // mousedown para seleccionar antes del blur del input
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nivel */}
      <div className="md:w-60">
        <Controller
          name={`languages.${idx}.level`}
          control={control}
          render={({ field }) => (
            <select {...field} className="border rounded-xl p-3 w-full">
              {LANGUAGE_LEVELS.map((lv) => (
                <option key={lv.value} value={lv.value}>
                  {lv.label}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Eliminar */}
      <div className="md:w-28 flex md:justify-end">
        <button
          type="button"
          className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50"
          onClick={() => onRemove(idx)}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
