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

  return (
    <form className="grid grid-cols-1 md:grid-cols-12 gap-3" method="GET" onChange={onChange}>
      {/* Vacante */}
      <div className="md:col-span-4">
        <label className="block text-xs text-zinc-600 mb-1">Vacante</label>
        <select name="title" defaultValue={sp.title || ""} className="w-full border rounded-xl p-3">
          <option value="">Todas</option>
          {titleOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Ubicación */}
      <div className="md:col-span-4">
        <label className="block text-xs text-zinc-600 mb-1">Ubicación</label>
        <select name="location" defaultValue={sp.location || ""} className="w-full border rounded-xl p-3">
          <option value="">Todas</option>
          <option value="REMOTE">Remoto</option>
          {locationOptions.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      {/* Estatus */}
      <div className="md:col-span-2">
        <label className="block text-xs text-zinc-600 mb-1">Estatus</label>
        <select name="status" defaultValue={sp.status || "OPEN"} className="w-full border rounded-xl p-3">
          <option value="ALL">Todas</option>
          <option value="OPEN">Abierta</option>
          <option value="PAUSED">Pausada</option>
          <option value="CLOSED">Cerrada</option>
        </select>
      </div>

      {/* Fecha */}
      <div className="md:col-span-2">
        <label className="block text-xs text-zinc-600 mb-1">Fecha</label>
        <select name="date" defaultValue={sp.date || "any"} className="w-full border rounded-xl p-3">
          {dateWindows.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      {/* Preserva sort/dir actuales en el submit */}
      <input type="hidden" name="sort" value={sp.sort || "createdAt"} />
      <input type="hidden" name="dir" value={sp.dir || "desc"} />
    </form>
  );
}
