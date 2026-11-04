// app/dashboard/jobs/[id]/Kanbanboard.tsx
"use client";

import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRecruiterApplicationReadModel, type RecruiterApplicationReadInput } from "@/lib/hiring-process/recruiter-read-model";
import { getRecruiterPipelinePresentation, getRecruiterPipelineOptions, type RecruiterStageOption } from "@/lib/hiring-process/recruiting-presentation";
import CandidateProfileLink from "@/components/dashboard/CandidateProfileLink";
import { toastError } from "@/lib/ui/toast";
import { AlertTriangle, Check, ClipboardList, Lock, MapPin, X } from "lucide-react";
import { RecruiterStateDialog, type ReasonCode } from "./applications/ProcessReasonDialog";
import InterestSelect from "./applications/InterestSelect";
import type { PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
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
  integrityIssue?: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  submittedAt?: string | Date | null;
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
  if (score >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 40) return "text-amber-700 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}
function scoreBg(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-rose-400";
}

function cardPresentation(card: AppCard, reads: boolean) {
  const presentation = getRecruiterPipelinePresentation({ ...card, stage: card.stage as RecruiterApplicationReadInput["stage"], disposition: card.disposition as RecruiterApplicationReadInput["disposition"], status: card.applicationStatus, recruiterInterest: card.status }, reads);
  return card.integrityIssue ? { ...presentation, pipelineState: null, label: "—", integrityIssue: true } : presentation;
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
  const mobileColumns = useMemo(() => [...statuses], [statuses]);
  const columnLabel = (key: string) => statusLabels[key] ?? key;
  const [items, setItems] = useState<AppCard[]>(applications);
  const [mobileSelection, setMobileSelection] = useState({ jobId: "", stage: "" });
  const [isPending, setIsPending] = useState(false);
  const moveInFlight = React.useRef(false);
  const moveCommand = React.useRef<{ key: string; id: string } | null>(null);
  const [requestedMove, setRequestedMove] = useState<{ card: AppCard; option: RecruiterStageOption } | null>(null);
  const [selectorBusy, setSelectorBusy] = useState(false);
  const selectorBusyRef = React.useRef(false);
  const onSelectorBusy = React.useCallback((busy: boolean) => { selectorBusyRef.current = busy; setSelectorBusy(busy); }, []);

  useEffect(() => {
    setItems(applications);
  }, [applications]);

  useEffect(() => {
    setMobileSelection((current) => {
      if (current.jobId === jobId && mobileColumns.includes(current.stage)) return current;
      let saved: string | null = null;
      try {
        saved = window.sessionStorage.getItem(`kanban-stage:${jobId}`);
      } catch {
        // The selector still works when browser storage is unavailable.
      }
      return { jobId, stage: saved && mobileColumns.includes(saved) ? saved : statuses[0] ?? "" };
    });
  }, [jobId, statuses, mobileColumns]);

  const selectedStage = mobileSelection.jobId === jobId && mobileColumns.includes(mobileSelection.stage)
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
    card.writerCompatibility !== "NONE" && !presentation(card).integrityIssue && presentation(card).pipelineState !== "HIRED";

  const presentation = (a: AppCard) => cardPresentation(a, canonicalRecruiterReadsEnabled);
  const grouped = useMemo(() => {
    const map: Record<string, AppCard[]> = {};
    for (const st of mobileColumns) map[st] = [];
    for (const a of items) {
      const p = cardPresentation(a, canonicalRecruiterReadsEnabled);
      const key = p.pipelineState;
      if (key) map[key]?.push(a);
    }
    return map;
  }, [items, mobileColumns, canonicalRecruiterReadsEnabled]);

  const integrityItems = items.filter(card => presentation(card).integrityIssue);

  // Ejecutar acción de mover (drag o quick action)
  const doMove = (appId: string, fromStatus: string, toStatus: string, fromIdx: number, toIdx: number) => {
    if (moveInFlight.current || selectorBusyRef.current || requestedMove || fromStatus === toStatus || !statuses.includes(fromStatus) || !statuses.includes(toStatus)) return;
    const moved = (grouped[fromStatus] || [])[fromIdx];
    if (!moved || moved.id !== appId || !isCardWritable(moved)) return;
    const source = { ...moved, stage: moved.stage as RecruiterApplicationReadInput["stage"], disposition: moved.disposition as RecruiterApplicationReadInput["disposition"], status: moved.applicationStatus, recruiterInterest: moved.status };
    const option = getRecruiterPipelineOptions(source, canonicalRecruiterReadsEnabled).find(option => option.pipelineState === toStatus && !option.disabled);
    if (!option) return;
    if (option.requiresReason || option.requiresConfirmation) { setRequestedMove({ card: moved, option }); return; }
    void submitMove(moved, option);
  };

  async function submitMove(moved: AppCard, option: RecruiterStageOption, reason?: { reasonCode: ReasonCode; reasonText?: string }) {
    if (moveInFlight.current || selectorBusyRef.current) return;
    const fd = new FormData();
    fd.set("appId", moved.id);
    fd.set("intent", "SET_RECRUITING_STATE");
    fd.set("destination", option.destination);
    if (reason) { fd.set("reasonCode", reason.reasonCode); if (reason.reasonText) fd.set("reasonText", reason.reasonText); }
    {
      fd.set("expectedVersion", String(moved.stateVersion));
      const key = JSON.stringify({ id: moved.id, version: moved.stateVersion, destination: option.destination, reason });
      if (moveCommand.current?.key !== key) moveCommand.current = { key, id: crypto.randomUUID() };
      fd.set("commandId", moveCommand.current.id);
    }

    moveInFlight.current = true;
    setIsPending(true);
      try {
        const res = await moveAction(fd);
        if (!res.ok || !res.application || !Number.isInteger(res.application.stateVersion)) throw new Error("No se pudo mover");
        if (res.application) {
          const saved = res.application;
          const confirmedBucket = getRecruiterApplicationReadModel({
            stage: saved.stage as RecruiterApplicationReadInput["stage"],
            disposition: saved.disposition as RecruiterApplicationReadInput["disposition"],
            status: saved.status,
            recruiterInterest: saved.recruiterInterest,
          }, { canonicalReadsEnabled: canonicalRecruiterReadsEnabled }).bucket;
          setItems((current) => current.map((item) => item.id === moved.id ? {
            ...item, stage: saved.stage, disposition: saved.disposition,
            stateVersion: saved.stateVersion, applicationStatus: saved.status,
            status: saved.recruiterInterest,
            displayStatus: confirmedBucket,
            writerCompatibility: saved.stage && saved.disposition ? "CANONICAL" : item.writerCompatibility,
          } : item));
        }
        setRequestedMove(null);
        router.refresh();
      } catch {
        toastError("No se pudo mover el candidato. Actualiza la página e intenta de nuevo.");
        router.refresh();
      } finally {
        moveInFlight.current = false;
        setIsPending(false);
      }
  }

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    doMove(draggableId, source.droppableId, destination.droppableId, source.index, destination.index);
  };

  const applyConfirmedCard = (appId: string, saved: PresentationSource) => {
    const confirmedBucket = getRecruiterApplicationReadModel(saved, { canonicalReadsEnabled: canonicalRecruiterReadsEnabled }).bucket;
    setItems(current => current.map(item => item.id === appId ? {
      ...item, stage: saved.stage, disposition: saved.disposition, stateVersion: saved.stateVersion,
      applicationStatus: saved.status, status: saved.recruiterInterest, displayStatus: confirmedBucket,
      writerCompatibility: saved.stage && saved.disposition ? "CANONICAL" : item.writerCompatibility,
    } : item));
  };

  return (
    <section aria-label="Tablero de candidaturas" className="min-w-0 lg:rounded-2xl lg:border lg:border-zinc-200/70 lg:bg-zinc-50/40 lg:p-3 dark:lg:border-zinc-800 dark:lg:bg-zinc-950/20">
      {integrityItems.length > 0 && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
        <p className="mb-3 text-sm font-medium text-amber-900 dark:text-amber-200">Advertencia de integridad: {integrityItems.length} registro{integrityItems.length === 1 ? "" : "s"} sin etapa verificable. No se incluyen en las columnas; cambios bloqueados.</p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{integrityItems.map(card => <li key={card.id}>{renderCard({ card, jobId, dragging: false, hasMatchSignals })}</li>)}</ul>
      </div>}
      {requestedMove && <RecruiterStateDialog option={requestedMove.option} pending={isPending} onCancel={() => setRequestedMove(null)}
        onConfirm={reason => { void submitMove(requestedMove.card, requestedMove.option, reason); }} />}
      <div className="mx-auto max-w-2xl xl:hidden">
        <label htmlFor="kanban-stage" className="mb-1.5 block text-sm font-medium">Etapa</label>
        <select id="kanban-stage" className="min-h-11 w-full rounded-lg border border-zinc-300 bg-[rgb(var(--card))] px-3 py-2 text-sm dark:border-zinc-700" value={selectedStage} onChange={(event) => selectMobileStage(event.target.value)}>
          {mobileColumns.map(stage => <option key={stage} value={stage}>{columnLabel(stage)} ({grouped[stage]?.length ?? 0})</option>)}
        </select>
        <div className="mt-2.5 space-y-2.5" aria-live="polite">
          {(grouped[selectedStage] ?? []).map((card) => <React.Fragment key={card.id}>{renderCard({ card, jobId, dragging: false, hasMatchSignals })}</React.Fragment>)}
          {(grouped[selectedStage] ?? []).length === 0 && <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">No hay candidatos en esta etapa.</p>}
        </div>
      </div>
      <div className="hidden min-w-0 xl:block">
      <DragDropContext
        onDragEnd={(result) => {
          handleDragEnd(result);
        }}
      >
        <div className="grid min-w-0 grid-cols-5 items-start gap-3">
          {statuses.map((st) => {
            const cards = grouped[st] || [];
            const accent = COLUMN_ACCENT[st] ?? COLUMN_ACCENT.REVIEW;
            return (
              <Droppable
                key={st}
                droppableId={st}
                type="APPLICATION"
                isDropDisabled={isPending || selectorBusy || requestedMove !== null}
                renderClone={(provided, _snapshot, rubric) => {
                  const card = (grouped[rubric.source.droppableId] || [])[rubric.source.index];
                  if (!card) return null;
                  return (
                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="pointer-events-none">
                      {renderCard({ card, jobId, dragging: true, hasMatchSignals })}
                    </div>
                  );
                }}
              >
                {(droppableProvided, droppableSnapshot) => (
                  <Column
                    title={columnLabel(st)}
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
                        isDragDisabled={isPending || selectorBusy || requestedMove !== null || !isCardWritable(card)}
                      >
                        {(draggableProvided, draggableSnapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            {...draggableProvided.dragHandleProps}
                            className={draggableSnapshot.isDragging ? "opacity-30 transition-opacity" : "opacity-100 transition-opacity"}
                          >
                            {renderCard({ card, jobId, dragging: draggableSnapshot.isDragging, hasMatchSignals })}
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
    </section>
  );

  /* ============ Card ============ */

  function renderCard({
    card, jobId, dragging, hasMatchSignals,
  }: {
    card: AppCard;
    jobId: string;
    dragging: boolean;
    hasMatchSignals?: boolean;
  }) {
    const now = Date.now();
    const createdMs = card.createdAt ? new Date(card.createdAt).getTime() : null;
    const isNew = createdMs !== null && now - createdMs < 48 * 60 * 60 * 1000;
    const submittedMs = card.submittedAt
      ? new Date(card.submittedAt).getTime()
      : null;
    const daysPendingReview =
      submittedMs !== null && Number.isFinite(submittedMs)
        ? Math.floor((now - submittedMs) / 86_400_000)
        : null;
    const processState = presentation(card);
    const isStale =
      !processState.integrityIssue && !processState.paused &&
      processState.pipelineState === "APPLIED" &&
      daysPendingReview !== null &&
      daysPendingReview >= 5;
    const score = card._score;
    const locked = card._locked;

    return (
      <article
        className={[
          "group min-w-0 rounded-xl border border-zinc-200 bg-white p-3 text-sm transition-colors duration-150 motion-reduce:transition-none",
          "dark:border-zinc-800 dark:bg-zinc-900",
          dragging ? "ring-2 ring-emerald-500/50" : "hover:border-zinc-300 dark:hover:border-zinc-700",
          isStale ? "border-l-2 border-l-amber-400" : "",
        ].join(" ")}
      >
        {/* Header: nombre + badges + score */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="min-w-0 text-base font-semibold leading-snug text-zinc-900 lg:text-sm dark:text-zinc-50">
                <CandidateProfileLink applicationId={card.id} jobId={jobId} source={{ stage: card.stage as RecruiterApplicationReadInput["stage"], disposition: card.disposition as RecruiterApplicationReadInput["disposition"], stateVersion: card.stateVersion, status: card.applicationStatus, recruiterInterest: card.status }} enabled={autoReviewEnabled && !processState.integrityIssue} href={`/dashboard/candidates/${card.candidate.id}?jobId=${jobId}&applicationId=${card.id}`} className="[overflow-wrap:anywhere] text-zinc-900 hover:text-emerald-700 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-50 dark:hover:text-emerald-300">{card.candidate.name}</CandidateProfileLink>
              </h4>
              {isNew && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Nueva
                </span>
              )}
            </div>
            {card.candidate.city && (
              <p className="mt-1 flex items-start gap-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                <MapPin aria-hidden="true" className="mt-1 h-3 w-3 shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{card.candidate.city}</span>
              </p>
            )}
          </div>

          {/* AI Match y acción contextual */}
          <div className="flex shrink-0 items-center gap-1">
            {hasMatchSignals && (
              locked ? (
                <div className="flex items-center gap-1 rounded-md border border-zinc-200 px-1.5 py-1 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  <Lock aria-hidden="true" className="h-3 w-3" />
                  <span className="text-[11px] font-medium">Pro</span>
                </div>
              ) : score !== null && score !== undefined ? (
                <span className={`text-sm font-bold tabular-nums ${scoreColor(score)}`}>
                  {score}%
                </span>
              ) : null
            )}
            {!dragging && isCardWritable(card) && <div onPointerDown={event => event.stopPropagation()}
              onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
              <InterestSelect variant="icon" applicationId={card.id} initial={card.status as "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED"}
                initialStateVersion={card.stateVersion} legacyStatus={card.applicationStatus}
                canonicalStage={card.stage as RecruiterApplicationReadInput["stage"]} canonicalDisposition={card.disposition as RecruiterApplicationReadInput["disposition"]}
                canonicalRecruiterReadsEnabled={canonicalRecruiterReadsEnabled} disabled={isPending || selectorBusy || requestedMove !== null}
                accessibleLabel={`Cambiar etapa de ${card.candidate.name}`} onBusyChange={onSelectorBusy} onConfirmed={saved => applyConfirmedCard(card.id, saved)} />
            </div>}
          </div>
        </div>

        {(processState.preselected || processState.paused || processState.integrityIssue) && <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {processState.preselected && <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Perfil preseleccionado</span>}
          {processState.paused && <span className="rounded bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">En pausa</span>}
          {processState.integrityIssue && <span className="text-amber-800 dark:text-amber-200">Etapa no verificable · Cambios bloqueados</span>}
        </div>}
        {/* Barra de match */}
        {hasMatchSignals && !locked && score !== null && score !== undefined && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-1 rounded-full transition-all ${scoreBg(score)}`} style={{ width: `${score}%` }} />
          </div>
        )}

        {/* Badges de assessments (uno por template enviado) */}
        {(card._assessments ?? []).length > 0 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-1 dark:border-zinc-800">
            {(card._assessments!).map((a, i) => (
              <AssessmentBadge key={i} assessment={a} />
            ))}
          </div>
        )}

        {/* Alerta de candidato estancado */}
        {isStale && (
          <div className="mt-3 flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Pendiente de revisión desde hace {daysPendingReview} días</span>
          </div>
        )}

      </article>
    );
  }
}

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
        role="region"
        aria-label={title}
        ref={innerRef}
        {...(droppableProps as any)}
        className={[
          "min-w-0 w-full rounded-xl border border-zinc-200/70 bg-white/70 flex flex-col max-h-[72vh] transition-colors dark:border-zinc-800 dark:bg-zinc-900/70",
          isDraggingOver ? accent.drag : "",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 bg-[rgb(var(--card))] border-b border-zinc-100 px-3 pt-3 pb-2 flex items-center justify-between gap-2 dark:border-zinc-800">
          <h3 className={`min-w-0 text-xs font-semibold uppercase tracking-wide ${accent.header}`}>
            {title}
          </h3>
          <span className={`inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full text-[11px] font-semibold ${accent.badge}`}>
            {count}
          </span>
        </div>

        <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-2 py-2">
          {count === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-6 gap-2 text-center">
              <span aria-hidden="true" className="text-2xl opacity-30">↓</span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Arrastra candidatos aquí
              </p>
            </div>
          ) : (
            children
          )}
        </div>

        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 text-[11px] text-zinc-600 text-center dark:border-zinc-800 dark:text-zinc-400">
          {isLoading ? "Guardando…" : `${count} candidato${count !== 1 ? "s" : ""}`}
        </div>
      </div>
    );
  }

  /* ============ AssessmentBadge ============ */

  function AssessmentBadge({ assessment }: { assessment: AssessmentMeta }) {
    const rawTitle = assessment.templateTitle ?? "";
    const titleClass = "[overflow-wrap:anywhere] text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-300";

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

      const Icon = passed === true ? Check : passed === false ? X : ClipboardList;
      const label = passed === true ? "Aprobó" : passed === false ? "No aprobó" : "Completado";

      const badge = (
        <span className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass} ${assessment.attemptId ? hoverClass + " cursor-pointer transition-colors" : ""}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {hasScore ? (
            <>
              <span className="font-black">{pct}%</span>
              <span className="font-normal">· {label}</span>
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75 motion-reduce:animate-none" />
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
            <ClipboardList aria-hidden="true" className="h-3 w-3" /> Evaluación enviada
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
            <AlertTriangle aria-hidden="true" className="h-3 w-3" /> Vencida
          </span>
        </div>
      );
    }

    return null;
  }
