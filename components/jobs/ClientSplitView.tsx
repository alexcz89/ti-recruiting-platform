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
  const detailRef = React.useRef<HTMLDivElement>(null);

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
      // Scroll to top of page so user sees detail from the start
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    }
  };

  const handleBack = () => {
    setShowDetail(false);
    setSelectedJob(null);
  };

  // Mobile: show either feed OR detail, not both
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
          <div ref={detailRef} id="job-detail-panel">
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

  // Desktop: split view
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      <aside className="md:col-span-5 space-y-3">
        <JobsFeed
          initial={filters}
          selectedId={selectedJob?.id ?? null}
          onSelect={(job) => setSelectedJob(job)}
          onFirstLoad={(job) => {
            setSelectedJob((curr: SelectedJob) => curr ?? job ?? null);
          }}
        />
      </aside>

      <section id="job-detail-panel" className="md:col-span-7">
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
      </section>
    </div>
  );
}