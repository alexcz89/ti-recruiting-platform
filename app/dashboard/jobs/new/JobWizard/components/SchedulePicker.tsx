// app/dashboard/jobs/new/JobWizard/components/SchedulePicker.tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import clsx from "clsx";

const DAYS = [
  { label: "L", value: "L", full: "Lunes" },
  { label: "M", value: "M", full: "Martes" },
  { label: "X", value: "X", full: "Miércoles" },
  { label: "J", value: "J", full: "Jueves" },
  { label: "V", value: "V", full: "Viernes" },
  { label: "S", value: "S", full: "Sábado" },
  { label: "D", value: "D", full: "Domingo" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return `${h}:00`;
});

// Agrega medias horas para más precisión
const HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

type Shift = {
  days: string[]; // ["L","M","X","J","V"]
  from: string;   // "09:00"
  to: string;     // "18:00"
};

function shiftToString(s: Shift): string {
  if (!s.days.length) return "";
  // Compress consecutive days: L,M,X,J,V → L-V
  const order = ["L", "M", "X", "J", "V", "S", "D"];
  const sorted = [...s.days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  
  // Build ranges
  let ranges: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  
  for (let i = 1; i <= sorted.length; i++) {
    const curr = sorted[i];
    const prevIdx = order.indexOf(prev);
    const currIdx = order.indexOf(curr ?? "");
    
    if (curr && currIdx === prevIdx + 1) {
      prev = curr;
    } else {
      if (rangeStart === prev) {
        ranges.push(rangeStart);
      } else {
        ranges.push(`${rangeStart}-${prev}`);
      }
      rangeStart = curr;
      prev = curr;
    }
  }
  
  const daysStr = ranges.join(", ");
  if (!s.from && !s.to) return daysStr;
  return `${daysStr} ${s.from}–${s.to}`;
}

function buildValue(shifts: Shift[]): string {
  return shifts
    .map(shiftToString)
    .filter(Boolean)
    .join(" | ");
}

const DEFAULT_SHIFT: Shift = {
  days: ["L", "M", "X", "J", "V"],
  from: "09:00",
  to: "18:00",
};

type Props = {
  value: string;
  onChange: (val: string) => void;
};

export default function SchedulePicker({ value, onChange }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([{ ...DEFAULT_SHIFT }]);
  const [initialized, setInitialized] = useState(false);

  // Sync on mount from external value
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (!value) {
      // Default: L-V 9:00-18:00, emit immediately
      onChange(buildValue([{ ...DEFAULT_SHIFT }]));
      return;
    }

    // Try to parse segments separated by |
    const segments = value.split("|").map(s => s.trim()).filter(Boolean);
    const parsed: Shift[] = segments.map(seg => {
      // Try to parse "L-V 09:00–18:00" or "L,M,X 09:00–18:00"
      const timeMatch = seg.match(/(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})/);
      const from = timeMatch?.[1] || "";
      const to = timeMatch?.[2] || "";
      const dayPart = seg.replace(/\d{1,2}:\d{2}[–-]\d{1,2}:\d{2}/, "").trim().replace(/,\s*$/, "");
      
      // Expand ranges like L-V to individual days
      const order = ["L", "M", "X", "J", "V", "S", "D"];
      const days: string[] = [];
      const parts = dayPart.split(",").map(p => p.trim());
      
      for (const part of parts) {
        if (part.includes("-")) {
          const [start, end] = part.split("-");
          const si = order.indexOf(start.trim());
          const ei = order.indexOf(end.trim());
          if (si >= 0 && ei >= 0) {
            for (let i = si; i <= ei; i++) days.push(order[i]);
          }
        } else if (order.includes(part)) {
          days.push(part);
        }
      }
      
      return { days: days.length ? days : ["L","M","X","J","V"], from, to };
    });

    if (parsed.length > 0) setShifts(parsed);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateShifts(next: Shift[]) {
    setShifts(next);
    onChange(buildValue(next));
  }

  function toggleDay(shiftIdx: number, day: string) {
    const next = shifts.map((s, i) => {
      if (i !== shiftIdx) return s;
      const days = s.days.includes(day)
        ? s.days.filter(d => d !== day)
        : [...s.days, day];
      return { ...s, days };
    });
    updateShifts(next);
  }

  function setFrom(shiftIdx: number, from: string) {
    updateShifts(shifts.map((s, i) => i === shiftIdx ? { ...s, from } : s));
  }

  function setTo(shiftIdx: number, to: string) {
    updateShifts(shifts.map((s, i) => i === shiftIdx ? { ...s, to } : s));
  }

  function addShift() {
    updateShifts([...shifts, { days: ["S"], from: "09:00", to: "13:00" }]);
  }

  function removeShift(idx: number) {
    updateShifts(shifts.filter((_, i) => i !== idx));
  }

  const selectCls = "h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <div className="space-y-2">
      {shifts.map((shift, si) => (
        <div key={si} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
          <div className="flex items-start gap-2">
            {/* Días */}
            <div className="flex flex-1 flex-wrap gap-1">
              {DAYS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  title={d.full}
                  onClick={() => toggleDay(si, d.value)}
                  className={clsx(
                    "h-7 w-7 rounded-lg text-xs font-bold transition-all active:scale-95",
                    shift.days.includes(d.value)
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "border border-zinc-200 bg-white text-zinc-500 hover:border-emerald-300 hover:text-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Eliminar turno */}
            {shifts.length > 1 && (
              <button
                type="button"
                onClick={() => removeShift(si)}
                className="mt-0.5 rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Hora inicio – fin */}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <span>Horario:</span>
            <select
              value={shift.from}
              onChange={e => setFrom(si, e.target.value)}
              className={selectCls}
            >
              {HOUR_OPTIONS.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span>—</span>
            <select
              value={shift.to}
              onChange={e => setTo(si, e.target.value)}
              className={selectCls}
            >
              {HOUR_OPTIONS.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {/* Agregar turno */}
      {shifts.length < 3 && (
        <button
          type="button"
          onClick={addShift}
          className="flex items-center gap-1 text-[11px] text-zinc-400 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <Plus className="h-3 w-3" />
          Agregar otro turno
        </button>
      )}

      {/* Preview */}
      {value && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {value}
        </p>
      )}
    </div>
  );
}