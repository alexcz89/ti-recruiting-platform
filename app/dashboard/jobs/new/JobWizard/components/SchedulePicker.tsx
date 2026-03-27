// app/dashboard/jobs/new/JobWizard/components/SchedulePicker.tsx
"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import clsx from "clsx";

const DAY_CHIPS = [
  { label: "L-V", value: "L-V" },
  { label: "L-S", value: "L-S" },
  { label: "L-D", value: "L-D" },
  { label: "Fines de semana", value: "S-D" },
  { label: "Flexible", value: "Flexible" },
];

const SHIFT_CHIPS = [
  { label: "☀️ Matutino", value: "Matutino" },
  { label: "🌅 Vespertino", value: "Vespertino" },
  { label: "🌙 Nocturno", value: "Nocturno" },
  { label: "🔄 Mixto", value: "Mixto" },
  { label: "Por turnos", value: "Por turnos" },
];

const chipBase =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer select-none active:scale-95";
const chipActive =
  "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200";
const chipInactive =
  "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600";

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

  // Sync on mount from external value (e.g. template applied)
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

  function handleCustom(val: string) {
    setCustom(val);
    onChange(val);
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

  return (
    <div className="space-y-3">
      {/* Días */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Días
        </p>
        <div className="flex flex-wrap gap-2">
          {DAY_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => handleDays(c.value)}
              className={clsx(chipBase, days === c.value ? chipActive : chipInactive)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Turno */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Turno
        </p>
        <div className="flex flex-wrap gap-2">
          {SHIFT_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => handleShift(c.value)}
              className={clsx(chipBase, shift === c.value ? chipActive : chipInactive)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Horario exacto toggle */}
      <button
        type="button"
        onClick={toggleCustom}
        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
      >
        <Clock className="h-3.5 w-3.5" />
        {showCustom ? "Quitar horario exacto" : "Especificar horario exacto"}
      </button>

      {showCustom && (
        <input
          type="text"
          placeholder="Ej. L-J 8:00–17:00 y V 8:00–14:00"
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}

      {/* Preview */}
      {value && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Horario:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {value}
          </span>
        </p>
      )}
    </div>
  );
}