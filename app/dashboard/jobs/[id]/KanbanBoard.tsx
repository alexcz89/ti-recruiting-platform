// app/dashboard/jobs/[id]/Kanbanboard.tsx
"use client";

import * as React from "react";
import { useTransition, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fromNow } from "@/lib/dates";
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
  _skills?: string[]; 
};

type AppCard = {
  id: string;
  status: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  candidate: Candidate;
};

export default function Kanbanboard({
  jobId,
  statuses,
  statusLabels,
  applications,
  moveAction,
}: {
  jobId: string;
  statuses: string[];
  statusLabels: Record<string, string>;
  applications: AppCard[];
  moveAction: (fd: FormData) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();

  // Estado local (optimista)
  const [items, setItems] = useState<AppCard[]>(applications);
  const [isPending, startTransition] = useTransition();

  // 🔄 Si cambian las aplicaciones desde el servidor, sincronizamos el estado local
  useEffect(() => {
    setItems(applications);
  }, [applications]);

  // Agrupar por columna
  const grouped = useMemo(() => {
    const map: Record<string, AppCard[]> = {};
    for (const st of statuses) map[st] = [];
    for (const a of items) (map[a.status] ||= []).push(a);
    return map;
  }, [items, statuses]);

  // Manejo del drop (hello-pangea/dnd)
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromStatus = source.droppableId;
    const toStatus = destination.droppableId;
    const fromIndex = source.index;
    const toIndex = destination.index;

    if (fromStatus === toStatus && fromIndex === toIndex) return;

    const prev = items;

    // Copia por columnas
    const cols: Record<string, AppCard[]> = {};
    for (const st of statuses) {
      cols[st] = [...(grouped[st] || [])];
    }

    const sourceCol = cols[fromStatus] || [];
    const destCol = cols[toStatus] || sourceCol;

    const [moved] = sourceCol.splice(fromIndex, 1);
    if (!moved) return;

    const movedCard: AppCard = { ...moved, status: toStatus };
    destCol.splice(toIndex, 0, movedCard);

    cols[fromStatus] = sourceCol;
    cols[toStatus] = destCol;

    const nextItems = statuses.flatMap((st) => cols[st]);
    setItems(nextItems);

    // Llamar acción de servidor
    const fd = new FormData();
    fd.set("appId", draggableId);
    fd.set("newStatus", toStatus);

    startTransition(async () => {
      const res = await moveAction(fd);
      if (!res.ok) {
        // Revertir si falla
        setItems(prev);
        console.error(res.message || "No se pudo mover");
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border glass-card p-3 sm:p-4 overflow-x-auto">
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Contenedor horizontal de columnas */}
        <div className="flex gap-4 lg:gap-5 min-w-[900px] pb-1">
          {statuses.map((st) => {
            const cards = grouped[st] || [];

            return (
              <Droppable
                key={st}
                droppableId={st}
                type="APPLICATION"
                // 👇 Clon bonito mientras arrastras
                renderClone={(provided, snapshot, rubric) => {
                  const sourceCol =
                    grouped[rubric.source.droppableId] || [];
                  const card = sourceCol[rubric.source.index];
                  if (!card) return null;

                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="pointer-events-none"
                    >
                      <Card card={card} jobId={jobId} dragging={true} />
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
                    innerRef={droppableProvided.innerRef}
                    // 👇 aflojamos el tipo para que acepte droppableProps sin pelearse con TS
                    droppableProps={droppableProvided.droppableProps as any}
                  >
                    {cards.map((card, index) => (
                      <Draggable
                        key={card.id}
                        draggableId={card.id}
                        index={index}
                      >
                        {(draggableProvided, draggableSnapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            {...draggableProvided.dragHandleProps}
                            className={
                              draggableSnapshot.isDragging
                                ? "opacity-30 transition-opacity"
                                : "opacity-100 transition-opacity"
                            }
                          >
                            <Card
                              card={card}
                              jobId={jobId}
                              dragging={draggableSnapshot.isDragging}
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

  /* ============ Subcomponentes ============ */

  function Column({
    title,
    count,
    isLoading,
    isDraggingOver,
    innerRef,
    droppableProps,
    children,
  }: {
    title: string;
    count: number;
    isLoading?: boolean;
    isDraggingOver?: boolean;
    innerRef: (element: HTMLDivElement | null) => void;
    // 👇 aquí estaba el problema de tipos; lo dejamos como any
    droppableProps: any;
    children: React.ReactNode;
  }) {
    return (
      <div
        ref={innerRef}
        {...(droppableProps as any)}
        className={[
          "w-[240px] lg:w-[260px] shrink-0 rounded-2xl border glass-card flex flex-col max-h-[72vh] transition-colors",
          isDraggingOver
            ? "border-emerald-400/70 bg-emerald-50/60 dark:bg-emerald-900/10"
            : "",
        ].join(" ")}
      >
        {/* Header columna */}
        <div className="sticky top-0 z-10 bg-[rgb(var(--card))] border-b border-zinc-100 px-3 pt-3 pb-2 flex items-center justify-between gap-2 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
            {title}
          </h3>
          <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {count}
          </span>
        </div>

        {/* Lista de tarjetas */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {count === 0 ? (
            <p className="text-[11px] text-muted text-center py-3">
              Sin candidatos
            </p>
          ) : (
            children
          )}
        </div>

        {/* Footer columna */}
        <div className="px-3 pb-3 pt-2 border-t border-zinc-100 text-[10px] text-muted text-center dark:border-zinc-800">
          {isLoading
            ? "Guardando cambios…"
            : "Arrastra candidatos para moverlos de etapa"}
        </div>
      </div>
    );
  }

  function Card({
    card,
    jobId,
    dragging,
  }: {
    card: AppCard;
    jobId: string;
    dragging: boolean;
  }) {
    const when =
      card.updatedAt
        ? new Date(card.updatedAt)
        : card.createdAt
        ? new Date(card.createdAt)
        : null;

    return (
      <article
        className={[
          "group rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5 text-xs shadow-[0_1px_3px_rgba(15,23,42,0.12)]",
          "hover:border-emerald-500/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 transition-all",
          dragging ? "ring-2 ring-emerald-500/50 scale-[1.02]" : "",
        ].join(" ")}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-medium leading-snug text-zinc-900 truncate max-w-[170px] dark:text-zinc-50">
              {card.candidate.name}
            </h4>
            <p className="mt-0.5 text-[11px] text-zinc-500 truncate max-w-[170px] dark:text-zinc-400">
              {card.candidate.email}
            </p>
          </div>

          {card.candidate.resumeUrl ? (
            <a
              href={card.candidate.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-emerald-500/60 px-2 py-0.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-500/10 shrink-0"
              title="Ver CV"
            >
              CV
            </a>
          ) : null}
        </header>

        {Array.isArray(card.candidate._skills) &&
          card.candidate._skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {card.candidate._skills.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {s}
                </span>
              ))}
              {card.candidate._skills.length > 4 && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  +{card.candidate._skills.length - 4}
                </span>
              )}
            </div>
          )}

        {when && (
          <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">
            Actualizado {fromNow(when)}
          </p>
        )}

        <footer className="mt-2 flex items-center justify-between gap-1">
          <a
            href={`/dashboard/candidates/${card.candidate.id}?jobId=${jobId}&applicationId=${card.id}`}
            className="inline-flex items-center rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title="Ver detalle del candidato"
          >
            Detalle
          </a>
        </footer>
      </article>
    );
  }
}
