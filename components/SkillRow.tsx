// components/SkillsRow.tsx
"use client";

import * as React from "react";

export type SkillItem = {
  termId?: string;
  label: string;
  level: 1 | 2 | 3 | 4 | 5;
};

type Option = { id: string; label: string };

export default function SkillsRow({
  idx,
  item,
  options,
  onChange,
  onRemove,
}: {
  idx: number;
  item: SkillItem;
  options: Option[];
  onChange: (idx: number, patch: Partial<SkillItem>) => void;
  onRemove: (idx: number) => void;
}) {
  // Normalizamos para comparar sin acentos y sin mayúsculas
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // Cuando cambia el texto del input, si hay match exacto → set termId; si no, termId = ""
  const handleLabelChange = (v: string) => {
    const exact = options.find((o) => norm(o.label) === norm(v));
    onChange(idx, { label: v, termId: exact?.id || "" });
  };

  const datalistId = `skills-datalist-${idx}`;

  return (
    <div className="flex gap-2 items-center">
      {/* Input con datalist (sugerencias) */}
      <div className="flex-1">
        <input
          className="border rounded-xl p-2 w-full"
          list={datalistId}
          value={item.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Ej. React, Node.js, AWS…"
        />
        <datalist id={datalistId}>
          {options.map((opt) => (
            <option key={`${opt.id}-${opt.label}`} value={opt.label} />
          ))}
        </datalist>
      </div>

      {/* Nivel */}
      <select
        className="border rounded-xl p-2"
        value={item.level}
        onChange={(e) => onChange(idx, { level: Number(e.target.value) as SkillItem["level"] })}
      >
        <option value={1}>Básico</option>
        <option value={2}>Junior</option>
        <option value={3}>Intermedio</option>
        <option value={4}>Avanzado</option>
        <option value={5}>Experto</option>
      </select>

      {/* Eliminar */}
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="text-red-500 hover:text-red-700 text-sm px-2"
        aria-label="Quitar skill"
        title="Quitar skill"
      >
        ×
      </button>
    </div>
  );
}
