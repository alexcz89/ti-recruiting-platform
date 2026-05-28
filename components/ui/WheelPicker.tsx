// components/ui/WheelPicker.tsx
"use client";

import { useState, type ReactNode } from "react";

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function daysInMonth(month1: number, year: number) {
  return new Date(year, month1, 0).getDate();
}

/* ══════════════════════════════════════════════════════════════════════════════
   Shared primitives
   ══════════════════════════════════════════════════════════════════════════════ */

/** Bottom-sheet on mobile, centred dialog on desktop */
function PickerModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="w-full sm:w-[400px] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalToolbar({
  title,
  onCancel,
  onOk,
}: {
  title:    string;
  onCancel: () => void;
  onOk:     () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
      <button
        type="button"
        onClick={onCancel}
        className="min-w-[64px] text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors text-left"
      >
        Cancelar
      </button>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate max-w-[180px] text-center">
        {title}
      </p>
      <button
        type="button"
        onClick={onOk}
        className="min-w-[64px] text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors text-right"
      >
        OK
      </button>
    </div>
  );
}

/** ← YEAR → navigation row */
function YearNav({
  year,
  min,
  max,
  onChange,
}: {
  year:     number;
  min:      number;
  max:      number;
  onChange: (y: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-3 px-5">
      <button
        type="button"
        disabled={year <= min}
        onClick={() => onChange(year - 1)}
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30"
        aria-label="Año anterior"
      >
        <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 w-16 text-center tabular-nums">
        {year}
      </span>
      <button
        type="button"
        disabled={year >= max}
        onClick={() => onChange(year + 1)}
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30"
        aria-label="Año siguiente"
      >
        <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/** 3×4 month grid */
function MonthGrid({
  selected,
  onSelect,
}: {
  selected: number;   // 0-11
  onSelect: (m: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 px-4 pb-4">
      {MONTHS_SHORT.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={[
            "rounded-xl py-3 text-sm font-medium transition-all duration-150",
            i === selected
              ? "bg-emerald-500 text-white shadow-sm scale-[1.03]"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Day number grid (rows of 7) */
function DayGrid({
  count,
  selected,
  onSelect,
}: {
  count:    number;   // total days in month
  selected: number;   // 1-based
  onSelect: (d: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 px-4 pb-4 pt-1">
      {Array.from({ length: count }, (_, i) => i + 1).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onSelect(d)}
          className={[
            "aspect-square rounded-full text-xs font-medium transition-all duration-150 flex items-center justify-center",
            d === selected
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-90",
          ].join(" ")}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

/** Calendar icon trigger button — same visual as before */
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
      <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
  const maxY = maxYear ?? new Date().getFullYear();

  function parse(v?: string | null) {
    const now = new Date();
    if (!v) return { m: now.getMonth(), y: now.getFullYear() };
    const [yyyy = "", mm = "1"] = v.split("-");
    return {
      m: Math.max(0, Math.min(parseInt(mm, 10) - 1, 11)),
      y: parseInt(yyyy, 10) || now.getFullYear(),
    };
  }

  const [open,   setOpen]   = useState(false);
  const [draftM, setDraftM] = useState(0);
  const [draftY, setDraftY] = useState(maxY);

  function openPicker() {
    if (disabled) return;
    const { m, y } = parse(value);
    setDraftM(m);
    setDraftY(Math.min(Math.max(y, minYear), maxY));
    setOpen(true);
  }

  function handleOk() {
    onChange(`${draftY}-${String(draftM + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  const label = (() => {
    if (!value) return null;
    const [yyyy = "", mm = "0"] = value.split("-");
    const m = parseInt(mm, 10) - 1;
    return m >= 0 && m <= 11 && yyyy ? `${MONTHS_FULL[m]} ${yyyy}` : null;
  })();

  return (
    <>
      <TriggerButton
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        onClick={openPicker}
      />
      <PickerModal open={open} onClose={() => setOpen(false)}>
        <ModalToolbar
          title={`${MONTHS_FULL[draftM]} ${draftY}`}
          onCancel={() => setOpen(false)}
          onOk={handleOk}
        />
        <YearNav year={draftY} min={minYear} max={maxY} onChange={setDraftY} />
        <MonthGrid selected={draftM} onSelect={setDraftM} />
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
  const maxY = maxYear ?? new Date().getFullYear();

  function parse(v?: string | null) {
    const today = new Date();
    if (!v) {
      return { d: today.getDate(), m: today.getMonth(), y: today.getFullYear() - 25 };
    }
    const [yyyy = "", mm = "1", dd = "1"] = v.split("-");
    return {
      d: parseInt(dd, 10) || 1,
      m: Math.max(0, Math.min(parseInt(mm, 10) - 1, 11)),
      y: parseInt(yyyy, 10) || (today.getFullYear() - 25),
    };
  }

  const [open,   setOpen]   = useState(false);
  const [draftD, setDraftD] = useState(1);
  const [draftM, setDraftM] = useState(0);
  const [draftY, setDraftY] = useState(maxY - 25);

  const totalDays = daysInMonth(draftM + 1, draftY);
  const safeDay   = Math.min(draftD, totalDays);

  function openPicker() {
    if (disabled) return;
    const { d, m, y } = parse(value);
    setDraftD(d);
    setDraftM(m);
    setDraftY(Math.min(Math.max(y, minYear), maxY));
    setOpen(true);
  }

  function handleOk() {
    const mm = String(draftM + 1).padStart(2, "0");
    const dd = String(safeDay).padStart(2, "0");
    onChange(`${draftY}-${mm}-${dd}`);
    setOpen(false);
  }

  const label = (() => {
    if (!value) return null;
    const [yyyy = "", mm = "0", dd = "0"] = value.split("-");
    const m = parseInt(mm, 10) - 1;
    if (m < 0 || m > 11 || !yyyy) return null;
    return `${parseInt(dd, 10)} de ${MONTHS_FULL[m]} de ${yyyy}`;
  })();

  return (
    <>
      <TriggerButton
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        onClick={openPicker}
      />
      <PickerModal open={open} onClose={() => setOpen(false)}>
        <ModalToolbar
          title={`${safeDay} de ${MONTHS_FULL[draftM]} de ${draftY}`}
          onCancel={() => setOpen(false)}
          onOk={handleOk}
        />
        {/* Year navigation */}
        <YearNav year={draftY} min={minYear} max={maxY} onChange={setDraftY} />
        {/* Month grid */}
        <MonthGrid selected={draftM} onSelect={setDraftM} />
        {/* Day grid — separated by a subtle line */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-5 pb-1">
            Día
          </p>
          <DayGrid count={totalDays} selected={safeDay} onSelect={setDraftD} />
        </div>
      </PickerModal>
    </>
  );
}
