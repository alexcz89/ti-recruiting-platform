// app/dashboard/jobs/new/JobWizard/components/SchedulePicker.tsx
"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

const DAY_CHIPS = [
  { label: "L–V", value: "L-V" },
  { label: "L–S", value: "L-S" },
  { label: "L–D", value: "L-D" },
  { label: "S–D", value: "S-D" },
  { label: "Flexible", value: "Flexible" },
];

const SHIFT_CHIPS = [
  { label: "Matutino", value: "Matutino", icon: "☀️" },
  { label: "Vespertino", value: "Vespertino", icon: "🌤️" },
  { label: "Nocturno", value: "Nocturno", icon: "🌙" },
  { label: "Mixto", value: "Mixto", icon: "🔄" },
  { label: "Por turnos", value: "Por turnos", icon: "📋" },
];

function buildSchedule(days: string, shift: string, custom: string): string {
  if (custom) return custom;
  if (days && shift) return `${days} · ${shift}`;
  return days || shift || "";
}

type Props = {
  value: string;
  onChange: (val: string) => void;
};

export default function SchedulePicker({ value, onChange }: Props) {
  const [days, setDays] = useState("");
  const [shift, setShift] = useState("");
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (!value) return;
    const matchedDay = DAY_CHIPS.find((c) => value.startsWith(c.value));
    const matchedShift = SHIFT_CHIPS.find((c) => value.includes(c.value));
    if (matchedDay) setDays(matchedDay.value);
    if (matchedShift) setShift(matchedShift.value);
    if (!matchedDay && !matchedShift) {
      setCustom(value);
      setShowCustom(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDays(chip: string) {
    const next = days === chip ? "" : chip;
    setDays(next);
    setCustom("");
    onChange(buildSchedule(next, shift, ""));
  }

  function handleShift(chip: string) {
    const next = shift === chip ? "" : chip;
    setShift(next);
    setCustom("");
    onChange(buildSchedule(days, next, ""));
  }

  function toggleCustom() {
    if (showCustom) {
      setShowCustom(false);
      setCustom("");
      onChange(buildSchedule(days, shift, ""));
    } else {
      setShowCustom(true);
    }
  }

  const dayChip = (active: boolean) =>
    clsx(
      "h-8 rounded-lg border px-2.5 text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap",
      active
        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
        : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
    );

  const shiftChip = (active: boolean) =>
    clsx(
      "flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-xs font-medium transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap",
      active
        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
    );

  return (
    <div className="space-y-2.5">
      {/* Días — una sola fila compacta */}
      <div className="flex flex-wrap gap-1.5">
        {DAY_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => handleDays(c.value)}
            className={dayChip(days === c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Turno */}
      <div className="flex flex-wrap gap-1.5">
        {SHIFT_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => handleShift(c.value)}
            className={shiftChip(shift === c.value)}
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Toggle horario exacto */}
      <button
        type="button"
        onClick={toggleCustom}
        className="text-[11px] text-zinc-400 hover:text-emerald-600 transition-colors underline underline-offset-2"
      >
        {showCustom ? "— quitar horario exacto" : "+ especificar horario exacto"}
      </button>

      {showCustom && (
        <input
          type="text"
          placeholder="Ej. L-J 8:00–17:00 y V 8:00–14:00"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
          className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}

      {/* Badge de preview cuando hay valor */}
      {value && !showCustom && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {value}
        </p>
      )}
    </div>
  );
}