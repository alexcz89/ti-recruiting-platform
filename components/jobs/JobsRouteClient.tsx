// components/jobs/JobsRouteClient.tsx
"use client";

import { useMemo, useState } from "react";
import JobSearchBar from "@/components/JobSearchBar";
import JobsFeed from "@/components/jobs/JobsFeed";
import JobDetailPanel from "@/components/jobs/JobDetailPanel";

const EMP_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] as const;
const SENIORITIES = ["JUNIOR", "MID", "SENIOR", "LEAD"] as const;

const EMP_LABEL: Record<string, string> = {
  FULL_TIME: "Tiempo completo",
  PART_TIME: "Medio tiempo",
  CONTRACT: "Contrato",
  INTERNSHIP: "Prácticas",
};
const SEN_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Semi Senior",
  SENIOR: "Senior",
  LEAD: "Líder",
};

type Filters = {
  q?: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  seniority?: string;
  sort?: "recent" | "relevance";
  limit?: number;
};

export default function JobsRouteClient({
  initialFilters,
}: {
  initialFilters: Filters;
  isCandidate?: boolean; // se acepta en el tipo por compatibilidad, pero no se usa
}) {
  // mantenemos el job seleccionado completo, no solo el id
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  const {
    q,
    location,
    remote,
    employmentType,
    seniority,
    sort = "recent",
    limit = 10,
  } = initialFilters;

  // helpers URL
  const buildQS = (overrides: Record<string, string | undefined | null>) => {
    const params = new URLSearchParams();
    const current = {
      q,
      location,
      remote: remote === true ? "true" : remote === false ? "false" : undefined,
      employmentType,
      seniority,
      sort,
    } as Record<string, string | undefined>;

    for (const [k, v] of Object.entries({ ...current, ...overrides })) {
      if (v && v !== "" && v !== "undefined" && v !== "null") params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : "/jobs";
  };

  const removeFilterLink = (key: keyof Filters | "remote") => {
    const copy: Record<string, string | null> = {};
    copy[key] = null;
    // legacy param
    if (key === "location") (copy as any)["loc"] = null;
    return buildQS(copy);
  };

  const hasAnyFilter = !!(
    q ||
    location ||
    remote !== undefined ||
    employmentType ||
    seniority ||
    (sort && sort !== "recent")
  );

  const chips = useMemo(() => {
    const rows: Array<{ label: string; href: string }> = [];
    if (q) rows.push({ label: `Texto: ${q}`, href: removeFilterLink("q") });
    if (location) rows.push({ label: `Ubicación: ${location}`, href: removeFilterLink("location") });
    if (remote === true) rows.push({ label: "Solo remoto", href: removeFilterLink("remote") });
    if (employmentType) {
      rows.push({
        label: `Tipo: ${EMP_LABEL[employmentType] ?? employmentType}`,
        href: removeFilterLink("employmentType"),
      });
    }
    if (seniority) {
      rows.push({
        label: `Seniority: ${SEN_LABEL[seniority] ?? seniority}`,
        href: removeFilterLink("seniority"),
      });
    }
    if (sort) {
      rows.push({
        label: `Orden: ${sort === "recent" ? "Recientes" : "Relevancia"}`,
        href: buildQS({ sort: undefined }),
      });
    }
    return rows;
  }, [q, location, remote, employmentType, seniority, sort]);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Buscador en cabecera */}
        <JobSearchBar />

        {/* Encabezado */}
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">Vacantes</h1>
          <p className="text-sm text-muted">
            Usa el buscador para texto/ubicación y los filtros avanzados para precisar resultados.
          </p>
        </header>

        {/* Filtros avanzados */}
        <details className="rounded-2xl border glass-card p-0">
          <summary className="cursor-pointer select-none rounded-2xl px-4 py-3 text-sm font-medium hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
            Filtros avanzados
          </summary>

          <form className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12" method="GET">
            <input type="hidden" name="q" defaultValue={q} />
            <input type="hidden" name="location" defaultValue={location} />

            <div className="lg:col-span-4">
              <label className="block text-xs text-muted mb-1">Tipo</label>
              <select
                name="employmentType"
                defaultValue={employmentType || ""}
                className="field"
              >
                <option value="">Todos</option>
                {EMP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMP_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs text-muted mb-1">Seniority</label>
              <select
                name="seniority"
                defaultValue={seniority || ""}
                className="field"
              >
                <option value="">Todos</option>
                {SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEN_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs text-muted mb-1">Orden</label>
              <select name="sort" defaultValue={sort} className="field">
                <option value="recent">Más recientes</option>
                <option value="relevance">Más relevantes</option>
              </select>
            </div>

            <div className="lg:col-span-2 flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-default">
                <input
                  type="checkbox"
                  name="remote"
                  value="true"
                  defaultChecked={remote === true}
                  className="h-4 w-4 rounded border border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-400"
                />
                Solo remoto
              </label>
            </div>

            <div className="lg:col-span-12 flex items-center gap-3">
              <button className="btn btn-ghost">Aplicar filtros</button>
              {hasAnyFilter && (
                <a href="/jobs" className="text-sm text-muted hover:underline">
                  Limpiar
                </a>
              )}
            </div>
          </form>
        </details>

        {/* Chips de filtros activos */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium
                           border-zinc-200/70 dark:border-zinc-700/60
                           bg-zinc-50/80 dark:bg-zinc-900/60
                           text-zinc-700 dark:text-zinc-200
                           hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 transition"
                title="Quitar filtro"
              >
                {c.label} <span className="ml-1">×</span>
              </a>
            ))}
          </div>
        )}

        {/* Master–detail: lista + panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section aria-label="Listado de vacantes" className="lg:col-span-7">
            <JobsFeed
              initial={{ q, location, remote, employmentType, seniority, sort, limit }}
              onSelect={(job) => setSelectedJob(job)}
              selectedId={selectedJob?.id ?? null}
            />
          </section>

          <aside
            aria-label="Detalle de vacante"
            className="hidden lg:block lg:col-span-5"
          >
            <div className="sticky top-20">
              {selectedJob ? (
                <JobDetailPanel job={selectedJob} />
              ) : (
                <div className="glass-card p-6 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-base font-medium text-zinc-700 dark:text-zinc-200">
                    Selecciona una vacante
                  </p>
                  <p className="text-sm text-muted mt-1">
                    Aquí verás los detalles completos de la vacante seleccionada.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
