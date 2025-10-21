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

export default function ClientSplitView({
  filters,
  isCandidate,
}: {
  filters: Filters;
  isCandidate?: boolean;
}) {
  // Volvemos a manejar el objeto job para respetar la API actual de JobsFeed/JobDetailPanel
  const [selectedJob, setSelectedJob] = React.useState<any | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Lista (5/12) */}
      <aside className="md:col-span-5 space-y-3">
        <JobsFeed
          initial={filters}
          selectedId={selectedJob?.id ?? null}
          onSelect={(job) => setSelectedJob(job)}
          onFirstLoad={(job) => {
            // Autoseleccionar la primera vacante si aún no hay selección
            setSelectedJob((curr) => curr ?? job ?? null);
          }}
        />
      </aside>

      {/* Detalle (7/12) */}
      <section className="md:col-span-7">
        <div className="sticky top-24">
          {selectedJob ? (
            <JobDetailPanel job={selectedJob} isCandidate={isCandidate} />
          ) : (
            <div className="border rounded-2xl p-6 bg-white/70 text-sm text-zinc-600 min-h-[50vh] flex items-center">
              Selecciona una vacante de la lista para ver el detalle aquí.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
