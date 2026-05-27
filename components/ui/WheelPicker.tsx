// components/ui/WheelPicker.tsx
"use client";

import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const ITEM_H  = 44; // px — touch-friendly row height
const PADDING = 2;  // ghost rows above / below the selected item

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function buildYears(min: number, max: number) {
  const out: string[] = [];
  for (let y = max; y >= min; y--) out.push(String(y));
  return out;
}
function buildDays(month1: number, year: number) {
  const n = new Date(year, month1, 0).getDate();
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
}

/* ══════════════════════════════════════════════════════════════════════════════
   WheelColumn — only the scrollable list, NO visual overlays (they live in
   WheelContainer so they span all columns uniformly).
   ══════════════════════════════════════════════════════════════════════════════ */
function WheelColumn({
  items,
  selectedIndex,
  onChange,
  className = "flex-1",
}: {
  items:         string[];
  selectedIndex: number;
  onChange:      (i: number) => void;
  className?:    string;
}) {
  const ref      = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const mounted  = useRef(false);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Instant scroll on first mount, smooth afterwards */
  useEffect(() => {
    const el = ref.current;
    if (!el || settling.current) return;
    if (!mounted.current) {
      el.scrollTop   = selectedIndex * ITEM_H;
      mounted.current = true;
    } else {
      el.scrollTo({ top: selectedIndex * ITEM_H, behavior: "smooth" });
    }
  }, [selectedIndex]);

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

  const colH = ITEM_H * (PADDING * 2 + 1);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height: colH }}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="absolute inset-0 overflow-y-scroll [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
      >
        {/* top ghost rows */}
        {Array.from({ length: PADDING }).map((_, i) => (
          <div key={`t${i}`} style={{ height: ITEM_H }} />
        ))}

        {items.map((label, idx) => (
          <div
            key={idx}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className={`flex items-center justify-center select-none cursor-pointer transition-all duration-150 ${
              idx === selectedIndex
                ? "font-semibold text-[15px] text-zinc-900 dark:text-white"
                : "text-[13px] text-zinc-400 dark:text-zinc-500"
            }`}
            onClick={() => {
              ref.current?.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
              onChange(idx);
            }}
          >
            {label}
          </div>
        ))}

        {/* bottom ghost rows */}
        {Array.from({ length: PADDING }).map((_, i) => (
          <div key={`b${i}`} style={{ height: ITEM_H }} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   WheelContainer — wraps all columns with ONE set of overlays that span the
   full width: top/bottom fade + centre selection lines.
   ══════════════════════════════════════════════════════════════════════════════ */
function WheelContainer({ children }: { children: ReactNode }) {
  const totalH = ITEM_H * (PADDING * 2 + 1);
  const fadeH  = ITEM_H * PADDING;

  return (
    <div className="relative flex gap-2" style={{ height: totalH }}>
      {children}

      {/* ── top fade ── */}
      <div
        className="absolute inset-x-0 top-0 bg-gradient-to-b from-white dark:from-zinc-900 to-transparent pointer-events-none z-10"
        style={{ height: fadeH }}
      />
      {/* ── bottom fade ── */}
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent pointer-events-none z-10"
        style={{ height: fadeH }}
      />
      {/* ── selection lines (top + bottom of selected row) ── */}
      <div
        className="absolute inset-x-0 pointer-events-none z-10"
        style={{ top: fadeH, height: ITEM_H }}
      >
        <div className="h-px w-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

/* ── Picker Modal ─────────────────────────────────────────────────────────────
   Mobile : bottom sheet (items-end), full width
   Desktop: centred dialog (sm:items-center), max 380 px wide
   ─────────────────────────────────────────────────────────────────────────── */
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
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="w-full sm:w-[380px] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[64px] text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors text-left"
          >
            Cancelar
          </button>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Seleccionar fecha
          </p>
          <button
            type="button"
            onClick={onOk}
            className="min-w-[64px] text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors text-right"
          >
            OK
          </button>
        </div>
        {/* Wheel area */}
        <div className="px-5 py-2 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Trigger button — shared by both pickers
   ══════════════════════════════════════════════════════════════════════════════ */
function TriggerButton({
  label,
  placeholder,
  disabled,
  onClick,
}: {
  label:       string | null;
  placeholder: string;
  disabled:    boolean;
  onClick:     () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm shadow-sm transition-colors",
        "border-zinc-300 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/70",
        label ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
      ].join(" ")}
    >
      <span>{label ?? placeholder}</span>
      <svg
        className="h-4 w-4 shrink-0 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MonthYearPicker
   value: "YYYY-MM" | "" | null | undefined
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
  const max   = maxYear ?? new Date().getFullYear();
  const years = buildYears(minYear, max);

  function parse(v?: string | null) {
    const now  = new Date();
    if (!v) return { mIdx: now.getMonth(), yIdx: Math.max(0, years.indexOf(String(now.getFullYear()))) };
    const [yyyy = "", mm = "1"] = v.split("-");
    return {
      mIdx: Math.max(0, Math.min(parseInt(mm, 10) - 1, 11)),
      yIdx: Math.max(0, years.indexOf(yyyy)),
    };
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
    onChange(`${years[draftY]}-${String(draftM + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  const label = (() => {
    if (!value) return null;
    const [yyyy = "", mm = "0"] = value.split("-");
    const m = parseInt(mm, 10) - 1;
    return m >= 0 && m <= 11 && yyyy ? `${MONTHS_ES[m]} ${yyyy}` : null;
  })();

  return (
    <>
      <TriggerButton
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        onClick={openPicker}
      />
      <PickerModal open={open} onClose={() => setOpen(false)} onOk={handleOk}>
        <WheelContainer>
          {/* Month — takes remaining space */}
          <WheelColumn
            items={MONTHS_ES}
            selectedIndex={draftM}
            onChange={setDraftM}
            className="flex-1"
          />
          {/* Year — fixed width */}
          <WheelColumn
            items={years}
            selectedIndex={draftY}
            onChange={setDraftY}
            className="w-[80px] shrink-0"
          />
        </WheelContainer>
      </PickerModal>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   FullDatePicker
   value: "YYYY-MM-DD" | "" | null | undefined
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
  const max   = maxYear ?? new Date().getFullYear();
  const years = buildYears(minYear, max);

  function parse(v?: string | null) {
    const today = new Date();
    if (!v) {
      const defYear = String(today.getFullYear() - 25);
      return {
        dIdx: 0,
        mIdx: today.getMonth(),
        yIdx: Math.max(0, years.indexOf(defYear)),
      };
    }
    const [yyyy = "", mm = "1", dd = "1"] = v.split("-");
    return {
      dIdx: Math.max(0, parseInt(dd, 10) - 1),
      mIdx: Math.max(0, Math.min(parseInt(mm, 10) - 1, 11)),
      yIdx: Math.max(0, years.indexOf(yyyy)),
    };
  }

  const [open,   setOpen]   = useState(false);
  const [draftD, setDraftD] = useState(0);
  const [draftM, setDraftM] = useState(0);
  const [draftY, setDraftY] = useState(0);

  const draftYearNum = parseInt(years[draftY] ?? String(max), 10);
  const days         = buildDays(draftM + 1, draftYearNum);
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
    const [yyyy = "", mm = "0", dd = "0"] = value.split("-");
    const m = parseInt(mm, 10) - 1;
    if (m < 0 || m > 11 || !yyyy) return null;
    return `${parseInt(dd, 10)} de ${MONTHS_ES[m]} de ${yyyy}`;
  })();

  return (
    <>
      <TriggerButton
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        onClick={openPicker}
      />
      <PickerModal open={open} onClose={() => setOpen(false)} onOk={handleOk}>
        <WheelContainer>
          {/* Day — fixed narrow */}
          <WheelColumn
            items={days}
            selectedIndex={safeDraftD}
            onChange={setDraftD}
            className="w-[52px] shrink-0"
          />
          {/* Month — takes remaining space */}
          <WheelColumn
            items={MONTHS_ES}
            selectedIndex={draftM}
            onChange={setDraftM}
            className="flex-1"
          />
          {/* Year — fixed */}
          <WheelColumn
            items={years}
            selectedIndex={draftY}
            onChange={setDraftY}
            className="w-[80px] shrink-0"
          />
        </WheelContainer>
      </PickerModal>
    </>
  );
}
