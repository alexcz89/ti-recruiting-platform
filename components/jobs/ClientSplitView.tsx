// components/jobs/ClientSplitView.tsx
"use client";

import * as React from "react";
import JobsFeed from "@/components/jobs/JobsFeed";
import JobDetailPanel from "@/components/jobs/JobDetailPanel";

type Filters = {
  q?: string;
  location?: string;
  countryCode?: string;
  city?: string;
  remote?: boolean;
  seniority?: string;
  employmentType?: string;
  sort?: "recent" | "relevance";
  limit?: number;
};

// Si quieres, luego tipamos mejor este Job en lugar de "any"
type SelectedJob = any | null;

export default function ClientSplitView({
  filters,
}: {
  filters: Filters;
}) {
  // Mantiene el job seleccionado
  const [selectedJob, setSelectedJob] = React.useState<SelectedJob>(null);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Lista de vacantes (5/12) */}
      <aside className="md:col-span-5 space-y-3">
        <JobsFeed
          initial={filters}
          selectedId={selectedJob?.id ?? null}
          onSelect={(job) => setSelectedJob(job)}
          onFirstLoad={(job) => {
            // Autoseleccionar la primera vacante si aún no hay selección
            setSelectedJob((curr: SelectedJob) => curr ?? job ?? null);
          }}
        />
      </aside>

      {/* Detalle de vacante (7/12) */}
      <section className="md:col-span-7">
        <div className="sticky top-24">
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
      </section>
    </div>
  );
}
