// app/dashboard/jobs/[id]/Kanbanboard.tsx
"use client";

import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRecruiterApplicationReadModel, type RecruiterApplicationReadInput } from "@/lib/hiring-process/recruiter-read-model";
import { PIPELINE_LABELS, getRecruitingPresentation, getRecruitingActions } from "@/lib/hiring-process/recruiting-presentation";
import CandidateProfileLink from "@/components/dashboard/CandidateProfileLink";
import { toastError } from "@/lib/ui/toast";
import { Lock, MapPin } from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

type Candidate = {
  id: string;
  name: string;
  city?: string | null;
};

type AssessmentMeta = {
  state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
  score: number | null;
  passed: boolean | null;
  attemptId: string | null;
  templateTitle: string | null;
};

type AppCard = {
  id: string;
  status: string;
  displayStatus: string;
  applicationStatus: string;
  stage: string | null;
  disposition: string | null;
  stateVersion: number;
  writerCompatibility: "CANONICAL" | "LEGACY" | "NONE";
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  _score?: number | null;
  _locked?: boolean;
  _assessments?: AssessmentMeta[];
  candidate: Candidate;
};

// Colores por etapa del pipeline
const COLUMN_ACCENT: Record<string, { header: string; badge: string; drag: string }> = {
  REVIEW:   { header: "text-zinc-700 dark:text-zinc-300",    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",           drag: "border-zinc-400/50 bg-zinc-50/60 dark:bg-zinc-800/20" },
  MAYBE:    { header: "text-amber-700 dark:text-amber-300",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",     drag: "border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10" },
  ACCEPTED: { header: "text-sky-700 dark:text-sky-300",       badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",            drag: "border-sky-400/50 bg-sky-50/50 dark:bg-sky-900/10" },
  REJECTED: { header: "text-rose-600 dark:text-rose-400",     badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",        drag: "border-rose-400/50 bg-rose-50/50 dark:bg-rose-900/10" },
};

// Colores del score de match
function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}
function scoreBg(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-rose-400";
}

export default function Kanbanboard({
  jobId,
  statuses,
  statusLabels,
  applications,
  hasMatchSignals = false,
  canonicalRecruiterReadsEnabled = false,
  autoReviewEnabled = false,
  moveAction,
}: {
  jobId: string;
  statuses: string[];
  statusLabels: Record<string, string>;
  applications: AppCard[];
  hasMatchSignals?: boolean;
  canonicalRecruiterReadsEnabled?: boolean;
  autoReviewEnabled?: boolean;
  moveAction: (fd: FormData) => Promise<{ ok: boolean; message?: string; application?: { stage: string | null; disposition: string | null; stateVersion: number; status: string; recruiterInterest: string } }>;
}) {
  const router = useRouter();
  const [section, setSection] = useState("ACTIVE");
  const [outcome, setOutcome] = useState("ALL");
  const [items, setItems] = useState<AppCard[]>(applications);
  const [mobileSelection, setMobileSelection] = useState({ jobId: "", stage: "" });
  const [isPending, setIsPending] = useState(false);
  const [dragSourceStatus, setDragSourceStatus] = useState<string | null>(null);
  const moveInFlight = React.useRef(false);
  const reviewCommand = React.useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    setItems(applications);
  }, [applications]);

  useEffect(() => {
    setMobileSelection((current) => {
      if (current.jobId === jobId && statuses.includes(current.stage)) return current;
      let saved: string | null = null;
      try {
        saved = window.sessionStorage.getItem(`kanban-stage:${jobId}`);
      } catch {
        // The selector still works when browser storage is unavailable.
      }
      return { jobId, stage: saved && statuses.includes(saved) ? saved : statuses[0] ?? "" };
    });
  }, [jobId, statuses]);

  const selectedStage = mobileSelection.jobId === jobId && statuses.includes(mobileSelection.stage)
    ? mobileSelection.stage : statuses[0] ?? "";

  const selectMobileStage = (stage: string) => {
    setMobileSelection({ jobId, stage });
    try {
      window.sessionStorage.setItem(`kanban-stage:${jobId}`, stage);
    } catch {
      // Keep the selection in component state for this visit.
    }
  };

  const isCardWritable = (card: AppCard) =>
    card.writerCompatibility !== "NONE";

  const presentation = (a: AppCard) => getRecruitingPresentation({ ...a, stage: a.stage as RecruiterApplicationReadInput["stage"], disposition: a.disposition as RecruiterApplicationReadInput["disposition"], status: a.applicationStatus, recruiterInterest: a.status }, canonicalRecruiterReadsEnabled);
  const grouped = useMemo(() => {
    const map: Record<string, AppCard[]> = {};
    for (const st of statuses) map[st] = [];
    for (const a of items) {
      const p = getRecruitingPresentation({ ...a, stage: a.stage as RecruiterApplicationReadInput["stage"], disposition: a.disposition as RecruiterApplicationReadInput["disposition"], status: a.applicationStatus, recruiterInterest: a.status }, canonicalRecruiterReadsEnabled);
      if (p.section === "ACTIVE" && p.column) map[p.column]?.push(a);
    }
    return map;
  }, [items, statuses, canonicalRecruiterReadsEnabled]);

  // Ejecutar acción de mover (drag o quick action)
  const doMove = (appId: string, fromStatus: string, toStatus: string, fromIdx: number, toIdx: number) => {
    if (moveInFlight.current || fromStatus === toStatus) return;
    const moved = (grouped[fromStatus] || [])[fromIdx];
    if (!moved || moved.id !== appId || !isCardWritable(moved)) return;
    const source = { ...moved, stage: moved.stage as RecruiterApplicationReadInput["stage"], disposition: moved.disposition as RecruiterApplicationReadInput["disposition"], status: moved.applicationStatus, recruiterInterest: moved.status };
    const intent = toStatus === "REVIEW" && fromStatus === "APPLIED" ? "START_REVIEW"
      : toStatus === "INTERVIEW" ? "MOVE_TO_INTERVIEW" : toStatus === "OFFER" ? "MOVE_TO_OFFER" : null;
    if (!intent || !getRecruitingActions(source, canonicalRecruiterReadsEnabled).includes(intent)) return;
    const writerStatus = intent === "START_REVIEW" ? "REVIEW" : "ACCEPTED";
    const startsReview = intent === "START_REVIEW";
    const fd = new FormData();
    fd.set("appId", appId);
    fd.set("newStatus", writerStatus);
    fd.set("intent", intent);
    {
      fd.set("expectedVersion", String(moved.stateVersion));
      if (startsReview) {
        const key = `${appId}:${moved.stateVersion}`;
        if (reviewCommand.current?.key !== key) reviewCommand.current = { key, id: crypto.randomUUID() };
        fd.set("commandId", reviewCommand.current.id);
      } else {
        fd.set("commandId", crypto.randomUUID());
      }
    }

    moveInFlight.current = true;
    setIsPending(true);
    void (async () => {
      try {
        const res = await moveAction(fd);
        if (!res.ok) throw new Error("No se pudo mover");
        if (res.application) {
          const saved = res.application;
          const confirmedBucket = getRecruiterApplicationReadModel({
            stage: saved.stage as RecruiterApplicationReadInput["stage"],
            disposition: saved.disposition as RecruiterApplicationReadInput["disposition"],
            status: saved.status,
            recruiterInterest: saved.recruiterInterest,
          }, { canonicalReadsEnabled: canonicalRecruiterReadsEnabled }).bucket;
          setItems((current) => current.map((item) => item.id === appId ? {
            ...item, stage: saved.stage, disposition: saved.disposition,
            stateVersion: saved.stateVersion, applicationStatus: saved.status,
            status: saved.recruiterInterest,
            displayStatus: confirmedBucket,
          } : item));
        }
        router.refresh();
      } catch {
        toastError("No se pudo mover el candidato. Actualiza la página e intenta de nuevo.");
        router.refresh();
      } finally {
        moveInFlight.current = false;
        setIsPending(false);
      }
    })();
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    doMove(draggableId, source.droppableId, destination.droppableId, source.index, destination.index);
  };

  return (
    <section className="min-w-0 md:rounded-2xl md:border md:border-zinc-200/70 md:bg-zinc-50/40 md:p-3 dark:md:border-zinc-800 dark:md:bg-zinc-950/20">
      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">Total de postulaciones: {items.length}</p>
      <nav aria-label="Procesos de candidatura" className="mb-3 flex flex-wrap gap-2">
        {([ ["ACTIVE", "Activos"], ["CLOSED", "Cerrados"], ["HOLD", "En pausa"], ["RECONCILIATION", "Requiere conciliación"] ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)} className={`min-h-11 rounded-lg border px-3 text-sm ${section === key ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"}`}>{label} ({items.filter(a => presentation(a).section === key).length})</button>)}
      </nav>
      {section !== "ACTIVE" ? <div className="space-y-3">
        {section === "CLOSED" && <label className="block text-sm">Resultado <select value={outcome} onChange={e => setOutcome(e.target.value)} className="rounded border bg-[rgb(var(--card))] p-2">{["ALL", "REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"].map(key => <option key={key} value={key}>{key === "ALL" ? "Todos" : PIPELINE_LABELS[key]} ({items.filter(a => presentation(a).section === "CLOSED" && (key === "ALL" || presentation(a).outcome === key)).length})</option>)}</select></label>}
        {items.filter(a => presentation(a).section === section && (section !== "CLOSED" || outcome === "ALL" || presentation(a).outcome === outcome)).map(card => <Card key={card.id} card={card} jobId={jobId} dragging={false} hasMatchSignals={hasMatchSignals} />)}
        {items.filter(a => presentation(a).section === section && (section !== "CLOSED" || outcome === "ALL" || presentation(a).outcome === outcome)).length === 0 && <p className="p-4 text-sm">No hay candidaturas en esta sección.</p>}
      </div> : <>
      <div className="md:hidden">
        <label htmlFor="kanban-stage" className="mb-1.5 block text-sm font-medium">Etapa</label>
        <select id="kanban-stage" className="min-h-11 w-full rounded-lg border border-zinc-300 bg-[rgb(var(--card))] px-3 py-2 text-sm dark:border-zinc-700" value={selectedStage} onChange={(event) => selectMobileStage(event.target.value)}>
          {statuses.map((stage) => <option key={stage} value={stage}>{statusLabels[stage] ?? stage} ({grouped[stage]?.length ?? 0})</option>)}
        </select>
        <div className="mt-2.5 space-y-2.5" aria-live="polite">
          {(grouped[selectedStage] ?? []).map((card) => <Card key={card.id} card={card} jobId={jobId} dragging={false} hasMatchSignals={hasMatchSignals} />)}
          {(grouped[selectedStage] ?? []).length === 0 && <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">No hay candidatos en esta etapa.</p>}
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
      <DragDropContext
        onDragStart={(start) => setDragSourceStatus(start.source.droppableId)}
        onDragEnd={(result) => {
          setDragSourceStatus(null);
          handleDragEnd(result);
        }}
      >
        <div className="flex w-max gap-3 pb-1">
          {statuses.map((st) => {
            const cards = grouped[st] || [];
            const accent = COLUMN_ACCENT[st] ?? COLUMN_ACCENT.REVIEW;
            return (
              <Droppable
                key={st}
                droppableId={st}
                type="APPLICATION"
                isDropDisabled={
                  dragSourceStatus !== null &&
                  !((dragSourceStatus === "APPLIED" && st === "REVIEW") || (dragSourceStatus === "REVIEW" && st === "INTERVIEW") || (dragSourceStatus === "INTERVIEW" && st === "OFFER"))
                }
                renderClone={(provided, _snapshot, rubric) => {
                  const card = (grouped[rubric.source.droppableId] || [])[rubric.source.index];
                  if (!card) return null;
                  return (
                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="pointer-events-none">
                      <Card card={card} jobId={jobId} dragging hasMatchSignals={hasMatchSignals} />
                    </div>
                  );
                }}
              >
                {(droppableProvided, droppableSnapshot) => (
                  <Column
                    title={statusLabels[st] ?? st}
                    count={cards.length}
                    isLoading={isPending}
                    isDraggingOver={droppableSnapshot.isDraggingOver}
                    accent={accent}
                    innerRef={droppableProvided.innerRef}
                    droppableProps={droppableProvided.droppableProps as any}
                  >
                    {cards.map((card, index) => (
                      <Draggable
                        key={card.id}
                        draggableId={card.id}
                        index={index}
                        isDragDisabled={isPending || !isCardWritable(card)}
                      >
                        {(draggableProvided, draggableSnapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            {...draggableProvided.dragHandleProps}
                            className={draggableSnapshot.isDragging ? "opacity-30 transition-opacity" : "opacity-100 transition-opacity"}
                          >
                            <Card
                              card={card}
                              jobId={jobId}
                              dragging={draggableSnapshot.isDragging}
                              hasMatchSignals={hasMatchSignals}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {droppableProvided.placeholder}
                  </Column>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
      </div>
      </>}
    </section>
  );

  /* ============ Column ============ */

  function Column({
    title, count, isLoading, isDraggingOver, accent, innerRef, droppableProps, children,
  }: {
    title: string;
    count: number;
    isLoading?: boolean;
    isDraggingOver?: boolean;
    accent: { header: string; badge: string; drag: string };
    innerRef: (element: HTMLDivElement | null) => void;
    droppableProps: any;
    children: React.ReactNode;
  }) {
    return (
      <div
        ref={innerRef}
        {...(droppableProps as any)}
        className={[
          "w-[310px] shrink-0 rounded-xl border border-zinc-200/70 bg-white/70 flex flex-col max-h-[72vh] transition-colors dark:border-zinc-800 dark:bg-zinc-900/70",
          isDraggingOver ? accent.drag : "",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 bg-[rgb(var(--card))] border-b border-zinc-100 px-3 pt-3 pb-2 flex items-center justify-between gap-2 dark:border-zinc-800">
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent.header}`}>
            {title}
          </h3>
          <span className={`inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full text-[11px] font-semibold ${accent.badge}`}>
            {count}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
              <span className="text-2xl opacity-30">↓</span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Arrastra candidatos aquí
              </p>
            </div>
          ) : (
            children
          )}
        </div>

        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 text-[10px] text-zinc-400 text-center dark:border-zinc-800">
          {isLoading ? "Guardando…" : `${count} candidato${count !== 1 ? "s" : ""}`}
        </div>
      </div>
    );
  }

  /* ============ AssessmentBadge ============ */

  function AssessmentBadge({ assessment }: { assessment: AssessmentMeta }) {
    const rawTitle = assessment.templateTitle ?? "";
    const titleClass = "line-clamp-2 break-words text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-300";

    if (assessment.state === "COMPLETED") {
      const hasScore = typeof assessment.score === "number";
      const pct = hasScore ? Math.round(assessment.score!) : null;
      const passed = assessment.passed;

      const colorClass =
        passed === true
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300"
          : passed === false
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-300"
          : "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-900/20 dark:text-teal-300";

      const hoverClass =
        passed === true
          ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          : passed === false
          ? "hover:bg-rose-100 dark:hover:bg-rose-900/40"
          : "hover:bg-teal-100 dark:hover:bg-teal-900/40";

      const icon = passed === true ? "✓" : passed === false ? "✗" : "📊";
      const label = passed === true ? "Aprobó" : passed === false ? "No aprobó" : "Completado";

      const badge = (
        <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass} ${assessment.attemptId ? hoverClass + " cursor-pointer transition-colors" : ""}`}>
          <span>{icon}</span>
          {hasScore ? (
            <>
              <span className="font-black">{pct}%</span>
              <span className="font-normal opacity-70">· {label}</span>
            </>
          ) : (
            <span>{label}</span>
          )}
        </span>
      );

      return (
        <div className="mt-2 flex flex-col gap-0.5">
          {/* Nombre del examen */}
          {rawTitle && (
            <p className={titleClass} title={rawTitle}>
              {rawTitle}
            </p>
          )}
          {assessment.attemptId ? (
            <a
              href={`/dashboard/assessments/attempts/${assessment.attemptId}/results`}
              onClick={(e) => e.stopPropagation()}
              title="Ver resultados"
              aria-label={`Ver resultados de ${rawTitle || "la evaluación"}`}
              className="w-fit rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              {badge}
            </a>
          ) : badge}
        </div>
      );
    }

    if (assessment.state === "STARTED") {
      return (
        <div className="mt-2 flex flex-col gap-0.5">
          {rawTitle && (
            <p className={titleClass} title={rawTitle}>{rawTitle}</p>
          )}
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-900/20 dark:text-sky-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
            </span>
            En progreso
          </span>
        </div>
      );
    }

    if (assessment.state === "SENT") {
      return (
        <div className="mt-2 flex flex-col gap-0.5">
          {rawTitle && (
            <p className={titleClass} title={rawTitle}>{rawTitle}</p>
          )}
          <span className="inline-flex w-fit items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:border-teal-500/30 dark:bg-teal-900/20 dark:text-teal-300">
            📋 Enviada · pendiente
          </span>
        </div>
      );
    }

    if (assessment.state === "EXPIRED") {
      return (
        <div className="mt-2 flex flex-col gap-0.5">
          {rawTitle && (
            <p className={titleClass} title={rawTitle}>{rawTitle}</p>
          )}
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300">
            ⚠ Expirada
          </span>
        </div>
      );
    }

    return null;
  }

  /* ============ Card ============ */

  function Card({
    card, jobId, dragging, hasMatchSignals,
  }: {
    card: AppCard;
    jobId: string;
    dragging: boolean;
    hasMatchSignals?: boolean;
  }) {
    const now = Date.now();
    const createdMs = card.createdAt ? new Date(card.createdAt).getTime() : null;
    const updatedMs = card.updatedAt ? new Date(card.updatedAt).getTime() : createdMs;
    const isNew = createdMs !== null && now - createdMs < 48 * 60 * 60 * 1000;
    const daysStale = updatedMs !== null ? Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24)) : null;
    const isStale = card.status === "REVIEW" && daysStale !== null && daysStale >= 5;
    const score = card._score;
    const locked = card._locked;

    return (
      <article
        className={[
          "group rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5 text-xs shadow-sm",
          "dark:border-zinc-800 dark:bg-zinc-900 transition-all",
          dragging ? "ring-2 ring-emerald-500/50 scale-[1.02] shadow-lg" : "hover:border-emerald-500/50 hover:shadow-md",
          isStale ? "border-l-2 border-l-amber-400" : "",
        ].join(" ")}
      >
        {/* Header: nombre + badges + score */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="min-w-0 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                <CandidateProfileLink applicationId={card.id} jobId={jobId} source={{ stage: card.stage as RecruiterApplicationReadInput["stage"], disposition: card.disposition as RecruiterApplicationReadInput["disposition"], stateVersion: card.stateVersion, status: card.applicationStatus, recruiterInterest: card.status }} enabled={autoReviewEnabled} href={`/dashboard/candidates/${card.candidate.id}?jobId=${jobId}&applicationId=${card.id}`} className="break-words text-zinc-900 hover:text-emerald-700 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-50 dark:hover:text-emerald-300">{card.candidate.name}</CandidateProfileLink>
              </h4>
              {isNew && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Nueva
                </span>
              )}
            </div>
            {card.candidate.city && (
              <p className="mt-0.5 flex max-w-[170px] items-center gap-0.5 truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {card.candidate.city}
              </p>
            )}
          </div>

          {/* AI Match */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {hasMatchSignals && (
              locked ? (
                <div className="flex items-center gap-0.5 rounded-md border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-700">
                  <Lock className="h-2.5 w-2.5 text-zinc-400" />
                  <span className="text-[9px] text-zinc-400">Pro</span>
                </div>
              ) : score !== null && score !== undefined ? (
                <span className={`text-sm font-black leading-none ${scoreColor(score)}`}>
                  {score}%
                </span>
              ) : null
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          {presentation(card).section !== "ACTIVE" && <span>{presentation(card).label}</span>}
          {presentation(card).preselected && <span className="rounded bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-900 dark:text-amber-100">Preselecto</span>}
          {presentation(card).assessmentStage && <span>Evaluación técnica</span>}
        </div>
        {/* Barra de match */}
        {hasMatchSignals && !locked && score !== null && score !== undefined && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-1 rounded-full transition-all ${scoreBg(score)}`} style={{ width: `${score}%` }} />
          </div>
        )}

        {/* Badges de assessments (uno por template enviado) */}
        {(card._assessments ?? []).length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {(card._assessments!).map((a, i) => (
              <AssessmentBadge key={i} assessment={a} />
            ))}
          </div>
        )}

        {/* Alerta de candidato estancado */}
        {isStale && (
          <div className="mt-2 flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <span>⚠</span>
            <span>Sin revisar hace {daysStale} días</span>
          </div>
        )}

      </article>
    );
  }
}
