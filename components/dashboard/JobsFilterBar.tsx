// components/dashboard/JobsFilterBar.tsx
"use client";

import * as React from "react";

type SearchParams = {
  title?: string;
  location?: string;
  date?: "any" | "7" | "30" | "90";
  status?: "ALL" | "OPEN" | "PAUSED" | "CLOSED";
  sort?: "title" | "total" | "pending" | "createdAt" | "status";
  dir?: "asc" | "desc";
};

type Props = {
  titleOptions: string[];
  locationOptions: string[];
  sp: Required<Pick<SearchParams, "title" | "location" | "date" | "status" | "sort" | "dir">>;
  dateWindows: Array<{ value: NonNullable<SearchParams["date"]>; label: string }>;
};

export default function JobsFilterBar({ titleOptions, locationOptions, sp, dateWindows }: Props) {
  // Auto-submit al cambiar cualquier select
  const onChange: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.currentTarget.requestSubmit();
  };

  const labelClass =
    "block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-300";

  const selectClass =
    "w-full rounded-xl border border-zinc-200 bg-white/95 px-3 py-2.5 text-sm " +
    "text-zinc-900 shadow-sm " +
    "focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500/80 " +
    "disabled:opacity-60 disabled:cursor-not-allowed " +
    "dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 " +
    "dark:placeholder:text-zinc-500";

  return (
    <form
      className="grid grid-cols-1 md:grid-cols-12 gap-3"
      method="GET"
      onChange={onChange}
    >
      {/* Vacante */}
      <div className="md:col-span-4">
        <label className={labelClass}>Vacante</label>
        <div className="relative">
          <select
            name="title"
            defaultValue={sp.title || ""}
            className={`${selectClass} appearance-none pr-9`}
          >
            <option value="">Todas</option>
            {titleOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-500 dark:text-zinc-400">
            ▼
          </span>
        </div>
      </div>

      {/* Ubicación */}
      <div className="md:col-span-4">
        <label className={labelClass}>Ubicación</label>
        <div className="relative">
          <select
            name="location"
            defaultValue={sp.location || ""}
            className={`${selectClass} appearance-none pr-9`}
          >
            <option value="">Todas</option>
            <option value="REMOTE">Remoto</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-500 dark:text-zinc-400">
            ▼
          </span>
        </div>
      </div>

      {/* Estatus */}
      <div className="md:col-span-2">
        <label className={labelClass}>Estatus</label>
        <div className="relative">
          <select
            name="status"
            defaultValue={sp.status || "OPEN"}
            className={`${selectClass} appearance-none pr-9`}
          >
            <option value="ALL">Todas</option>
            <option value="OPEN">Abierta</option>
            <option value="PAUSED">Pausada</option>
            <option value="CLOSED">Cerrada</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-500 dark:text-zinc-400">
            ▼
          </span>
        </div>
      </div>

      {/* Fecha */}
      <div className="md:col-span-2">
        <label className={labelClass}>Fecha</label>
        <div className="relative">
          <select
            name="date"
            defaultValue={sp.date || "any"}
            className={`${selectClass} appearance-none pr-9`}
          >
            {dateWindows.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-500 dark:text-zinc-400">
            ▼
          </span>
        </div>
      </div>

      {/* Preserva sort/dir actuales en el submit */}
      <input type="hidden" name="sort" value={sp.sort || "createdAt"} />
      <input type="hidden" name="dir" value={sp.dir || "desc"} />
    </form>
  );
}
