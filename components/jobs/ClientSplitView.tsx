// components/jobs/ClientSplitView.tsx
"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
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
  const [showDetail, setShowDetail] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleSelect = (job: any) => {
    setSelectedJob(job);
    if (isMobile) {
      setShowDetail(true);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    } else {
      // Desktop: scroll al top de la página para que el panel sea visible desde arriba
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setShowDetail(false);
    setSelectedJob(null);
  };

  // ── Mobile ───────────────────────────────────────────────────────────
  if (isMobile) {
    if (showDetail && selectedJob) {
      return (
        <div>
          <button
            type="button"
            onClick={handleBack}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a vacantes
          </button>
          <div id="job-detail-panel">
            <JobDetailPanel
              key={selectedJob.id ?? "empty"}
              job={selectedJob}
              canApply
            />
          </div>
        </div>
      );
    }

    return (
      <JobsFeed
        initial={filters}
        selectedId={selectedJob?.id ?? null}
        onSelect={handleSelect}
        onFirstLoad={() => {
          // Don't auto-select on mobile
        }}
      />
    );
  }

  // ── Desktop ──────────────────────────────────────────────────────────
  // El panel derecho es sticky al viewport (top-4).
  // NO tiene overflow-y-auto propio — la página hace scroll normalmente.
  // Esto permite que el toolbar interno con sticky top-0 funcione
  // relativo al scroll de la página, manteniéndose siempre visible.
  return (
    <div className="flex gap-6 items-start">
      {/* Columna izquierda: feed, scroll normal de página */}
      <div className="w-5/12 shrink-0">
        <JobsFeed
          initial={filters}
          selectedId={selectedJob?.id ?? null}
          onSelect={handleSelect}
          onFirstLoad={(job) => {
            setSelectedJob((curr: SelectedJob) => curr ?? job ?? null);
          }}
        />
      </div>

      {/* Columna derecha: sticky al viewport, sin overflow propio */}
      <div
        id="job-detail-panel"
        className="w-7/12 sticky top-4"
      >
        {selectedJob ? (
          <JobDetailPanel
            key={selectedJob.id ?? "empty"}
            job={selectedJob}
            canApply
          />
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
    </div>
  );
}