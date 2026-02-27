"use client";

// components/dashboard/AssignTemplateModal.tsx
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  Clock,
  BarChart3,
  AlertCircle,
} from "lucide-react";

type Job = {
  id: string;
  title: string;
  location: string | null;
  remote: boolean;
  status: string;
  assignedTemplateIds: string[];
};

type Template = {
  id: string;
  title: string;
  description: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  type: "MCQ" | "CODING" | "MIXED";
  totalQuestions: number;
  timeLimit: number;
  passingScore: number;
};

type Props = {
  templateId: string;
  templateTitle: string;
  jobs: Job[];
  template: Template | null;
  onClose: () => void;
};

const DIFF_COLOR: Record<string, string> = {
  JUNIOR: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  MID: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SENIOR: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

const DIFF_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid Level",
  SENIOR: "Senior",
};

export default function AssignTemplateModal({
  templateId,
  templateTitle,
  jobs,
  template,
  onClose,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [successJobId, setSuccessJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Focus trap: enfocar el dialog al montar
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  async function handleAssign(jobId: string) {
    setError(null);
    setAssigningJobId(jobId);

    try {
      const res = await fetch(
        `/api/dashboard/jobs/${encodeURIComponent(jobId)}/assign-template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, isRequired: true }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "No se pudo asignar el template");
        return;
      }

      setSuccessJobId(jobId);

      // Refrescar en background y cerrar después de 1.2s
      startTransition(() => {
        router.refresh();
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setError(e?.message || "Error de conexión");
    } finally {
      setAssigningJobId(null);
    }
  }

  const openJobs = jobs.filter((j) => j.status === "OPEN" || j.status === "PAUSED");
  const alreadyAssignedJobs = jobs.filter((j) =>
    j.assignedTemplateIds.includes(templateId)
  );
  const assignableJobs = openJobs.filter(
    (j) => !j.assignedTemplateIds.includes(templateId)
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-2xl outline-none dark:border-zinc-800/50 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-zinc-100 bg-gradient-to-br from-violet-50 to-blue-50 p-5 dark:border-zinc-800 dark:from-violet-950/30 dark:to-blue-950/30">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-violet-200 to-blue-200 opacity-30 blur-2xl dark:from-violet-800 dark:to-blue-800" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 p-2 shadow-lg shadow-violet-500/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Asignar evaluación
                </p>
                <h2
                  id="assign-modal-title"
                  className="mt-0.5 text-lg font-black text-zinc-900 dark:text-zinc-50"
                >
                  {templateTitle}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Template info pills */}
          {template && (
            <div className="relative mt-3 flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${DIFF_COLOR[template.difficulty] ?? ""}`}>
                {DIFF_LABEL[template.difficulty] ?? template.difficulty}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Clock className="h-2.5 w-2.5" />
                {template.timeLimit} min
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <BarChart3 className="h-2.5 w-2.5" />
                {template.totalQuestions} preguntas
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Mínimo {template.passingScore}%
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {jobs.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-zinc-400" />
              <p className="mt-3 font-bold text-zinc-700 dark:text-zinc-300">No tienes vacantes activas</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Publica una vacante primero para poder asignarle un template.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Vacantes asignables */}
              {assignableJobs.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Vacantes disponibles ({assignableJobs.length})
                  </p>
                  <div className="space-y-2">
                    {assignableJobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        isAssigning={assigningJobId === job.id}
                        isSuccess={successJobId === job.id}
                        isDisabled={
                          !!assigningJobId ||
                          !!successJobId ||
                          isPending
                        }
                        onAssign={() => handleAssign(job.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Vacantes ya asignadas */}
              {alreadyAssignedJobs.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Ya asignado ({alreadyAssignedJobs.length})
                  </p>
                  <div className="space-y-2">
                    {alreadyAssignedJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/10"
                      >
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {job.title}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {job.remote ? "Remoto" : job.location || "—"}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          Asignado ✓
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ninguna asignable */}
              {assignableJobs.length === 0 && alreadyAssignedJobs.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    No hay vacantes abiertas disponibles.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
            Al asignar, los candidatos que postules podrán recibir esta evaluación.
          </p>
        </div>
      </div>
    </div>
  );
}

function JobRow({
  job,
  isAssigning,
  isSuccess,
  isDisabled,
  onAssign,
}: {
  job: Job;
  isAssigning: boolean;
  isSuccess: boolean;
  isDisabled: boolean;
  onAssign: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
        isSuccess
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
          : "border-zinc-200 bg-white hover:border-violet-200 hover:bg-violet-50/30 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-violet-800/50 dark:hover:bg-violet-950/10"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {job.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {job.remote ? "Remoto" : job.location || "—"}
          </p>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
              job.status === "OPEN"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            {job.status === "OPEN" ? "Abierta" : "Pausada"}
          </span>
        </div>
      </div>

      <button
        onClick={onAssign}
        disabled={isDisabled}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
          isSuccess
            ? "bg-emerald-600 text-white"
            : "bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-md shadow-violet-500/20 hover:scale-[1.03] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        }`}
      >
        {isSuccess ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Asignado
          </>
        ) : isAssigning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Asignando...
          </>
        ) : (
          <>
            Asignar
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </div>
  );
}