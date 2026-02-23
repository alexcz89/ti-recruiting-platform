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

type SelectedJob = any | null;

export default function ClientSplitView({ filters }: { filters: Filters }) {
  const [selectedJob, setSelectedJob] = React.useState<SelectedJob>(null);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleSelect = (job: any) => {
    setSelectedJob(job);
    // En móvil, scroll al panel de detalle
    if (isMobile) {
      setTimeout(() => {
        document.getElementById("job-detail-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Lista de vacantes */}
      <aside className="md:col-span-5 space-y-3">
        <JobsFeed
          initial={filters}
          selectedId={selectedJob?.id ?? null}
          onSelect={handleSelect}
          onFirstLoad={(job) => {
            // En desktop cargamos la primera vacante automáticamente
            // En móvil no, para no empujar el feed fuera de la vista
            if (!isMobile) {
              setSelectedJob((curr: SelectedJob) => curr ?? job ?? null);
            }
          }}
        />
      </aside>

      {/* Detalle de vacante */}
      <section id="job-detail-panel" className="md:col-span-7">
        {selectedJob ? (
          <JobDetailPanel
            key={selectedJob.id ?? "empty"}
            job={selectedJob}
            canApply
          />
        ) : (
          // En móvil ocultamos el placeholder vacío para no confundir
          <div className={`glass-card p-6 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm ${isMobile ? "hidden" : ""}`}>
            <p className="text-base font-medium text-zinc-700 dark:text-zinc-200">
              Selecciona una vacante
            </p>
            <p className="text-sm text-muted mt-1">
              Aquí verás los detalles completos de la vacante seleccionada.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}