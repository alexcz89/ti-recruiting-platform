// components/jobs/ClientSplitView.tsx
"use client";

import * as React from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import JobsFeed from "@/components/jobs/JobsFeed";
import JobDetailPanel from "@/components/jobs/JobDetailPanel";
import ApplyButton, { ApplyResult } from "@/components/jobs/ApplyButton";

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
  const [copied, setCopied] = React.useState(false);
  const detailScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset copied when job changes
  React.useEffect(() => { setCopied(false); }, [selectedJob?.id]);

  const handleSelect = (job: any) => {
    setSelectedJob(job);
    if (isMobile) {
      setShowDetail(true);
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } else {
      // Scroll al top del área scrolleable del panel
      setTimeout(() => {
        if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
      }, 50);
    }
  };

  const handleBack = () => {
    setShowDetail(false);
    setSelectedJob(null);
  };

  const handleShare = React.useCallback(async () => {
    if (!selectedJob?.id) return;
    const url = `${window.location.origin}/jobs/${selectedJob.id}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: selectedJob.title || "Vacante", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }, [selectedJob?.id, selectedJob?.title]);

  const applyAction = React.useCallback(async (): Promise<ApplyResult> => {
    const jobId = selectedJob?.id;
    if (!jobId) return { error: "UNKNOWN", message: "Vacante inválida" };
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (res.status === 401) {
        const callback = encodeURIComponent(window.location.pathname + window.location.search);
        return { error: "AUTH", signinUrl: `/auth/signin?callbackUrl=${callback}` };
      }
      if (res.status === 403) { const d = await res.json().catch(() => null); return { error: "ROLE", message: d?.error || "Solo candidatos pueden postular" }; }
      if (res.status === 409) { const d = await res.json().catch(() => null); return { error: "ALREADY_APPLIED", message: d?.error || "Ya postulaste a esta vacante" }; }
      if (res.ok) return { ok: true, redirect: `${window.location.pathname}?applied=1` };
      const d = await res.json().catch(() => null);
      return { error: "UNKNOWN", message: d?.error || "Error al postular" };
    } catch {
      return { error: "UNKNOWN", message: "No se pudo conectar con el servidor" };
    }
  }, [selectedJob?.id]);

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
        onFirstLoad={() => {}}
      />
    );
  }

  // ── Desktop ──────────────────────────────────────────────────────────
  // Panel derecho sticky con altura fija = viewport - navbar - gap.
  // Estructura:
  //   ┌─ sticky wrapper ──────────────────────────┐
  //   │  ┌─ toolbar (siempre visible) ──────────┐ │
  //   │  └─────────────────────────────────────── │
  //   │  ┌─ contenido scrolleable ──────────────┐ │
  //   │  │  <JobDetailPanel hideToolbar />       │ │
  //   │  └─────────────────────────────────────── │
  //   └───────────────────────────────────────────┘
  return (
    <div className="flex gap-6 items-start">
      {/* Feed */}
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

      {/* Panel derecho — sticky, altura fija, scroll interno */}
      <div
        id="job-detail-panel"
        className="w-7/12 sticky top-4 flex flex-col rounded-2xl border glass-card overflow-hidden"
        style={{ height: "calc(100vh - 5rem)" }}
      >
        {selectedJob ? (
          <>
            {/* ── Toolbar siempre visible ── */}
            <div className="flex items-center justify-between gap-2 border-b glass-card px-4 py-3 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-default pr-2">
                  {selectedJob.title}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  title="Compartir"
                  className="inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-sm text-default hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
                  <Share2 className="h-4 w-4 text-muted shrink-0" />
                  <span className="hidden sm:inline text-xs">Compartir</span>
                </button>
                {copied && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-300/50 rounded px-2 py-1 whitespace-nowrap">
                    Link copiado
                  </span>
                )}
                <ApplyButton applyAction={applyAction} jobKey={selectedJob.id} />
              </div>
            </div>

            {/* ── Contenido scrolleable ── */}
            <div ref={detailScrollRef} className="flex-1 overflow-y-auto">
              <JobDetailPanel
                key={selectedJob.id ?? "empty"}
                job={selectedJob}
                canApply={false}   /* toolbar ya está arriba, no duplicar */
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <p className="text-base font-medium text-zinc-700 dark:text-zinc-200">
                Selecciona una vacante
              </p>
              <p className="text-sm text-muted mt-1">
                Aquí verás los detalles completos de la vacante seleccionada.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}