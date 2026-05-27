// components/ui/WheelPicker.tsx
"use client";

import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const ITEM_H  = 44; // px — mínimo touch target
const PADDING = 2;  // filas fantasma arriba/abajo del centro

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function buildYears(min: number, max: number): string[] {
  const out: string[] = [];
  for (let y = max; y >= min; y--) out.push(String(y));
  return out;
}

function buildDays(month1: number, year: number): string[] {
  const n = new Date(year, month1, 0).getDate();
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
}

/* ─── WheelColumn ────────────────────────────────────────────────────────────── */
function WheelColumn({
  items,
  selectedIndex,
  onChange,
  className = "flex-1",
}: {
  items:         string[];
  selectedIndex: number;
  onChange:      (idx: number) => void;
  className?:    string;
}) {
  const ref       = useRef<HTMLDivElement>(null);
  const settling  = useRef(false);
  const mounted   = useRef(false);
  const timer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Scroll to selectedIndex (instant on first mount, smooth afterwards) */
  useEffect(() => {
    const el = ref.current;
    if (!el || settling.current) return;
    if (!mounted.current) {
      el.scrollTop = selectedIndex * ITEM_H;
      mounted.current = true;
    } else {
      el.scrollTo({ top: selectedIndex * ITEM_H, behavior: "smooth" });
    }
  }, [selectedIndex]);

  /* After finger lifts, snap to nearest item */
  const onScroll = useCallback(() => {
    settling.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      settling.current = false;
      const el = ref.current;
      if (!el) return;
      const idx     = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      onChange(clamped);
    }, 100);
  }, [items.length, onChange]);

  const totalH = ITEM_H * (PADDING * 2 + 1);

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ height: totalH }}>
      {/* Scrollable list */}
      <div
        ref={ref}
        onScroll={onScroll}
        className="absolute inset-0 overflow-y-scroll [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
      >
        {/* Top ghost rows */}
        {Array.from({ length: PADDING }).map((_, i) => (
          <div key={`t${i}`} style={{ height: ITEM_H }} />
        ))}

        {/* Items */}
        {items.map((label, idx) => (
          <div
            key={`${label}-${idx}`}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className={`flex items-center justify-center select-none cursor-pointer transition-all duration-100 ${
              idx === selectedIndex
                ? "font-semibold text-[15px] text-zinc-900 dark:text-white"
                : "text-sm text-zinc-400 dark:text-zinc-500"
            }`}
            onClick={() => {
              ref.current?.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
              onChange(idx);
            }}
          >
            {label}
          </div>
        ))}

        {/* Bottom ghost rows */}
        {Array.from({ length: PADDING }).map((_, i) => (
          <div key={`b${i}`} style={{ height: ITEM_H }} />
        ))}
      </div>

      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 bg-gradient-to-b from-white dark:from-zinc-900 to-transparent pointer-events-none z-10"
        style={{ height: ITEM_H * PADDING }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent pointer-events-none z-10"
        style={{ height: ITEM_H * PADDING }}
      />
      {/* Center selection bar */}
      <div
        className="absolute inset-x-0 pointer-events-none z-10 border-y border-zinc-200 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-800/50"
        style={{ top: ITEM_H * PADDING, height: ITEM_H }}
      />
    </div>
  );
}

/* ─── Picker Modal ───────────────────────────────────────────────────────────── */
function PickerModal({
  open,
  onClose,
  onOk,
  children,
}: {
  open:     boolean;
  onClose:  () => void;
  onOk:     () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[1px]"
      onPointerDown={onClose}
    >
      <div
        className="w-full sm:w-[340px] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Seleccionar fecha
          </p>
          <button
            type="button"
            onClick={onOk}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors"
          >
            OK
          </button>
        </div>
        {/* Wheel area */}
        <div className="px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MonthYearPicker — value: "YYYY-MM" | "" | null/undefined
   ══════════════════════════════════════════════════════════════════════════════ */
export function MonthYearPicker({
  value,
  onChange,
  placeholder = "Seleccionar mes y año",
  minYear     = 1970,
  maxYear,
  disabled    = false,
}: {
  value?:       string | null;
  onChange:     (v: string) => void;
  placeholder?: string;
  minYear?:     number;
  maxYear?:     number;
  disabled?:    boolean;
}) {
  const curYear = new Date().getFullYear();
  const max     = maxYear ?? curYear;
  const years   = buildYears(minYear, max); // descending [max … min]

  function parse(v?: string | null) {
    const now = new Date();
    if (!v) {
      const yIdx = Math.max(0, years.indexOf(String(now.getFullYear())));
      return { mIdx: now.getMonth(), yIdx };
    }
    const [yyyy, mm] = v.split("-");
    const mIdx = Math.max(0, Math.min(parseInt(mm ?? "1", 10) - 1, 11));
    const yIdx = Math.max(0, years.indexOf(yyyy));
    return { mIdx, yIdx };
  }

  const [open,   setOpen]   = useState(false);
  const [draftM, setDraftM] = useState(0);
  const [draftY, setDraftY] = useState(0);

  function openPicker() {
    if (disabled) return;
    const { mIdx, yIdx } = parse(value);
    setDraftM(mIdx);
    setDraftY(yIdx);
    setOpen(true);
  }

  function handleOk() {
    const yyyy = years[draftY];
    const mm   = String(draftM + 1).padStart(2, "0");
    onChange(`${yyyy}-${mm}`);
    setOpen(false);
  }

  const label = (() => {
    if (!value) return null;
    const [yyyy, mm] = value.split("-");
    const m = parseInt(mm ?? "0", 10) - 1;
    if (m < 0 || m > 11 || !yyyy) return null;
    return `${MONTHS_ES[m]} ${yyyy}`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={[
          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm shadow-sm transition-colors",
          "border-zinc-300 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/70",
          label ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
        ].join(" ")}
      >
        <span>{label ?? placeholder}</span>
        <CalendarIcon />
      </button>

      <PickerModal open={open} onClose={() => setOpen(false)} onOk={handleOk}>
        <div className="flex gap-3">
          <WheelColumn items={MONTHS_ES} selectedIndex={draftM} onChange={setDraftM} />
          <WheelColumn items={years}     selectedIndex={draftY} onChange={setDraftY} className="w-[76px]" />
        </div>
      </PickerModal>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   FullDatePicker — value: "YYYY-MM-DD" | "" | null/undefined
   ══════════════════════════════════════════════════════════════════════════════ */
export function FullDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  minYear     = 1950,
  maxYear,
  disabled    = false,
}: {
  value?:       string | null;
  onChange:     (v: string) => void;
  placeholder?: string;
  minYear?:     number;
  maxYear?:     number;
  disabled?:    boolean;
}) {
  const curYear = new Date().getFullYear();
  const max     = maxYear ?? curYear;
  const years   = buildYears(minYear, max);

  function parse(v?: string | null) {
    const today = new Date();
    if (!v) {
      const yIdx = Math.max(0, years.indexOf(String(today.getFullYear() - 25)));
      return { dIdx: 0, mIdx: today.getMonth(), yIdx };
    }
    const [yyyy, mm, dd] = v.split("-");
    const mIdx = Math.max(0, Math.min(parseInt(mm ?? "1", 10) - 1, 11));
    const yIdx = Math.max(0, years.indexOf(yyyy));
    const dIdx = Math.max(0, parseInt(dd ?? "1", 10) - 1);
    return { dIdx, mIdx, yIdx };
  }

  const [open,   setOpen]   = useState(false);
  const [draftD, setDraftD] = useState(0);
  const [draftM, setDraftM] = useState(0);
  const [draftY, setDraftY] = useState(0);

  const draftYearNum = parseInt(years[draftY] ?? String(max), 10);
  const days         = buildDays(draftM + 1, draftYearNum);
  // Clamp day index if month/year change reduces number of days
  const safeDraftD   = Math.min(draftD, days.length - 1);

  function openPicker() {
    if (disabled) return;
    const { dIdx, mIdx, yIdx } = parse(value);
    setDraftD(dIdx);
    setDraftM(mIdx);
    setDraftY(yIdx);
    setOpen(true);
  }

  function handleOk() {
    const yyyy = years[draftY];
    const mm   = String(draftM + 1).padStart(2, "0");
    const dd   = String(safeDraftD + 1).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
    setOpen(false);
  }

  const label = (() => {
    if (!value) return null;
    const [yyyy, mm, dd] = value.split("-");
    const m = parseInt(mm ?? "0", 10) - 1;
    if (m < 0 || m > 11 || !yyyy || !dd) return null;
    return `${parseInt(dd, 10)} de ${MONTHS_ES[m]} de ${yyyy}`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={[
          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm shadow-sm transition-colors",
          "border-zinc-300 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/70",
          label ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
        ].join(" ")}
      >
        <span>{label ?? placeholder}</span>
        <CalendarIcon />
      </button>

      <PickerModal open={open} onClose={() => setOpen(false)} onOk={handleOk}>
        <div className="flex gap-3">
          <WheelColumn items={days}      selectedIndex={safeDraftD} onChange={setDraftD} className="w-[56px]" />
          <WheelColumn items={MONTHS_ES} selectedIndex={draftM}    onChange={setDraftM} />
          <WheelColumn items={years}     selectedIndex={draftY}    onChange={setDraftY} className="w-[76px]" />
        </div>
      </PickerModal>
    </>
  );
}

/* ─── Shared icon ────────────────────────────────────────────────────────────── */
function CalendarIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
