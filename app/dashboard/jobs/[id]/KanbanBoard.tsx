// app/dashboard/jobs/[id]/Kanbanboard.tsx
"use client";

import * as React from "react";
import { useTransition, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fromNow } from "@/lib/dates";
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
  email: string;
  resumeUrl?: string | null;
  phone?: string | null;
  location?: string | null;
  _skills?: string[];
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
  MAYBE:    { header: "text-violet-700 dark:text-violet-300", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200", drag: "border-violet-400/50 bg-violet-50/50 dark:bg-violet-900/10" },
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

// Etapas del pipeline (excluye REJECTED del avance rápido)
const NEXT_STAGE: Record<string, string | null> = {
  REVIEW: "MAYBE",
  MAYBE: "ACCEPTED",
  ACCEPTED: null,
  REJECTED: null,
};
const NEXT_STAGE_LABEL: Record<string, string> = {
  MAYBE: "Preselecto",
  ACCEPTED: "Entrevista",
};

export default function Kanbanboard({
  jobId,
  statuses,
  statusLabels,
  applications,
  hasMatchSignals = false,
  moveAction,
}: {
  jobId: string;
  statuses: string[];
  statusLabels: Record<string, string>;
  applications: AppCard[];
  hasMatchSignals?: boolean;
  moveAction: (fd: FormData) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AppCard[]>(applications);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(applications);
  }, [applications]);

  const grouped = useMemo(() => {
    const map: Record<string, AppCard[]> = {};
    for (const st of statuses) map[st] = [];
    for (const a of items) (map[a.status] ||= []).push(a);
    return map;
  }, [items, statuses]);

  // Ejecutar acción de mover (drag o quick action)
  const doMove = (appId: string, fromStatus: string, toStatus: string, fromIdx: number, toIdx: number) => {
    const prev = items;

    const cols: Record<string, AppCard[]> = {};
    for (const st of statuses) cols[st] = [...(grouped[st] || [])];

    const sourceCol = cols[fromStatus] || [];
    const destCol = cols[toStatus] || sourceCol;
    const [moved] = sourceCol.splice(fromIdx, 1);
    if (!moved) return;

    destCol.splice(toIdx, 0, { ...moved, status: toStatus });
    cols[fromStatus] = sourceCol;
    cols[toStatus] = destCol;

    setItems(statuses.flatMap((st) => cols[st]));

    const fd = new FormData();
    fd.set("appId", appId);
    fd.set("newStatus", toStatus);

    startTransition(async () => {
      const res = await moveAction(fd);
      if (!res.ok) {
        setItems(prev);
        console.error(res.message || "No se pudo mover");
        return;
      }
      router.refresh();
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    doMove(draggableId, source.droppableId, destination.droppableId, source.index, destination.index);
  };

  const handleQuickMove = (card: AppCard, toStatus: string) => {
    const fromCol = grouped[card.status] || [];
    const fromIdx = fromCol.findIndex((c) => c.id === card.id);
    if (fromIdx < 0) return;
    const toCol = grouped[toStatus] || [];
    doMove(card.id, card.status, toStatus, fromIdx, toCol.length);
  };

  return (
    <section className="rounded-2xl border glass-card p-3 sm:p-4 overflow-x-auto">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 lg:gap-4 min-w-[860px] pb-1">
          {statuses.map((st) => {
            const cards = grouped[st] || [];
            const accent = COLUMN_ACCENT[st] ?? COLUMN_ACCENT.REVIEW;

            return (
              <Droppable
                key={st}
                droppableId={st}
                type="APPLICATION"
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
                      <Draggable key={card.id} draggableId={card.id} index={index}>
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
                              nextStatus={NEXT_STAGE[st] ?? null}
                              nextStatusLabel={NEXT_STAGE[st] ? NEXT_STAGE_LABEL[NEXT_STAGE[st]!] : undefined}
                              onMoveNext={() => NEXT_STAGE[st] && handleQuickMove(card, NEXT_STAGE[st]!)}
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
          "flex-1 min-w-[210px] max-w-[340px] rounded-2xl border glass-card flex flex-col max-h-[72vh] transition-colors",
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
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
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
    // Nombre truncado del examen para mostrar en el badge
    const rawTitle = assessment.templateTitle ?? "";
    const shortTitle = rawTitle.length > 22 ? rawTitle.slice(0, 21) + "…" : rawTitle;

    if (assessment.state === "COMPLETED") {
      const hasScore = typeof assessment.score === "number";
      const pct = hasScore ? Math.round(assessment.score!) : null;
      const passed = assessment.passed;

      const colorClass =
        passed === true
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300"
          : passed === false
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-300"
          : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-900/20 dark:text-violet-300";

      const hoverClass =
        passed === true
          ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          : passed === false
          ? "hover:bg-rose-100 dark:hover:bg-rose-900/40"
          : "hover:bg-violet-100 dark:hover:bg-violet-900/40";

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
          {shortTitle && (
            <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-400 truncate">
              {shortTitle}
            </p>
          )}
          {assessment.attemptId ? (
            <a
              href={`/dashboard/assessments/attempts/${assessment.attemptId}/results`}
              onClick={(e) => e.stopPropagation()}
              title="Ver resultados"
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
          {shortTitle && (
            <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-400 truncate">{shortTitle}</p>
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
          {shortTitle && (
            <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-400 truncate">{shortTitle}</p>
          )}
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-900/20 dark:text-violet-300">
            📋 Enviada · pendiente
          </span>
        </div>
      );
    }

    if (assessment.state === "EXPIRED") {
      return (
        <div className="mt-2 flex flex-col gap-0.5">
          {shortTitle && (
            <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-400 truncate">{shortTitle}</p>
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
    card, jobId, dragging, hasMatchSignals, nextStatus, nextStatusLabel, onMoveNext,
  }: {
    card: AppCard;
    jobId: string;
    dragging: boolean;
    hasMatchSignals?: boolean;
    nextStatus?: string | null;
    nextStatusLabel?: string;
    onMoveNext?: () => void;
  }) {
    const now = Date.now();
    const createdMs = card.createdAt ? new Date(card.createdAt).getTime() : null;
    const updatedMs = card.updatedAt ? new Date(card.updatedAt).getTime() : createdMs;
    const isNew = createdMs !== null && now - createdMs < 48 * 60 * 60 * 1000;
    const daysStale = updatedMs !== null ? Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24)) : null;
    const isStale = card.status === "REVIEW" && daysStale !== null && daysStale >= 5;
    const phone = card.candidate.phone;
    const waNumber = phone?.replace(/\D/g, "");
    const hasWhatsApp = phone?.trim().startsWith("+52");
    const score = card._score;
    const locked = card._locked;

    return (
      <article
        className={[
          "group rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5 text-xs shadow-[0_1px_3px_rgba(15,23,42,0.08)]",
          "dark:border-zinc-800 dark:bg-zinc-900 transition-all",
          dragging ? "ring-2 ring-emerald-500/50 scale-[1.02] shadow-lg" : "hover:border-emerald-500/50 hover:shadow-md",
          isStale ? "border-l-2 border-l-amber-400" : "",
        ].join(" ")}
      >
        {/* Header: nombre + badges + score */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-semibold leading-snug text-zinc-900 truncate max-w-[140px] dark:text-zinc-50">
                {card.candidate.name}
              </h4>
              {isNew && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Nueva
                </span>
              )}
            </div>
            {card.candidate.location && (
              <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-zinc-400 truncate max-w-[170px]">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {card.candidate.location}
              </p>
            )}
          </div>

          {/* AI Match + CV */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {card.candidate.resumeUrl && (
              <a
                href={card.candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-emerald-500/60 px-2 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                title="Ver CV"
                onClick={(e) => e.stopPropagation()}
              >
                CV
              </a>
            )}
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

        {/* Barra de match */}
        {hasMatchSignals && !locked && score !== null && score !== undefined && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-1 rounded-full transition-all ${scoreBg(score)}`} style={{ width: `${score}%` }} />
          </div>
        )}

        {/* Skills */}
        {Array.isArray(card.candidate._skills) && card.candidate._skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.candidate._skills.slice(0, 3).map((s) => (
              <span key={s} className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {s}
              </span>
            ))}
            {card.candidate._skills.length > 3 && (
              <span className="text-[10px] text-zinc-400">+{card.candidate._skills.length - 3}</span>
            )}
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

        {/* Footer: acciones rápidas */}
        {(() => {
          const completed = (card._assessments ?? []).filter(a => a.state === "COMPLETED" && a.attemptId);
          const singleResult = completed.length >= 1 ? completed[0] : null;
          return (
        <div className="mt-2.5 flex items-center justify-between gap-1">
          {/* Izquierda: Ver perfil + Ver resultados (solo si hay exactamente 1 completado) */}
          <div className="flex items-center gap-1 min-w-0">
            <a
              href={`/dashboard/candidates/${card.candidate.id}?jobId=${jobId}&applicationId=${card.id}`}
              className="inline-flex shrink-0 items-center rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              Ver perfil
            </a>

            {singleResult && (
              <a
                href={`/dashboard/assessments/attempts/${singleResult.attemptId}/results`}
                onClick={(e) => e.stopPropagation()}
                className={[
                  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  singleResult.passed === true
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : singleResult.passed === false
                    ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-600/40 dark:bg-rose-900/20 dark:text-rose-300"
                    : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-600/40 dark:bg-violet-900/20 dark:text-violet-300",
                ].join(" ")}
                title="Ver resultados"
              >
                📊 Resultados
              </a>
            )}
          </div>

          {/* Derecha: WhatsApp + avanzar etapa */}
          <div className="flex shrink-0 items-center gap-1">
            {hasWhatsApp && waNumber && (
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noreferrer"
                title="Contactar por WhatsApp"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300"
                onClick={(e) => e.stopPropagation()}
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            )}

            {nextStatus && nextStatusLabel && onMoveNext && (
              <button
                type="button"
                title={`Mover a ${nextStatusLabel}`}
                onClick={(e) => { e.stopPropagation(); onMoveNext(); }}
                className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-500 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300 transition-colors"
              >
                {nextStatusLabel} →
              </button>
            )}
          </div>
        </div>
          );
        })()}
      </article>
    );
  }
}
