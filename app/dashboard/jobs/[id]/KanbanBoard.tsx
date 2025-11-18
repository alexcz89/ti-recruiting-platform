// app/dashboard/jobs/[id]/Kanbanboard.tsx
"use client";

import * as React from "react";
import { useTransition, useMemo, useState } from "react";
import { fromNow } from "@/lib/dates";

type Candidate = {
  id: string;
  name: string;
  email: string;
  resumeUrl?: string | null;
  skills?: string[] | null;
};

type AppCard = {
  id: string;
  status: string;
  createdAt?: string | Date | null;
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
  // Estado local (optimista)
  const [items, setItems] = useState<AppCard[]>(applications);
  const [isPending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, AppCard[]> = {};
    for (const st of statuses) map[st] = [];
    for (const a of items) (map[a.status] ||= []).push(a);
    return map;
  }, [items, statuses]);

  const handleDrop = (appId: string, toStatus: string) => {
    if (!statuses.includes(toStatus)) return;
    const prev = items;
    const idx = prev.findIndex((x) => x.id === appId);
    if (idx < 0) return;
    if (prev[idx].status === toStatus) return;

    // Optimista
    const next = [...prev];
    next[idx] = { ...next[idx], status: toStatus };
    setItems(next);

    // Server Action
    const fd = new FormData();
    fd.set("appId", appId);
    fd.set("newStatus", toStatus);
    startTransition(async () => {
      const res = await moveAction(fd);
      if (!res.ok) {
        // revertir
        setItems(prev);
        console.error(res.message || "No se pudo mover");
      }
    });
  };

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragEnd = () => setDraggingId(null);
  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  return (
    <section className="rounded-2xl border glass-card p-3 sm:p-4 overflow-x-auto">
      {/* Contenedor horizontal de columnas */}
      <div className="flex gap-4 lg:gap-5 min-w-[900px] pb-1">
        {statuses.map((st) => (
          <Column
            key={st}
            title={statusLabels[st] ?? st}
            count={grouped[st]?.length ?? 0}
            isLoading={isPending}
            onDrop={(appId) => handleDrop(appId, st)}
            allowDrop={allowDrop}
          >
            {(grouped[st] || []).map((card) => (
              <Card
                key={card.id}
                card={card}
                jobId={jobId}
                dragging={draggingId === card.id}
                onDragStart={() => onDragStart(card.id)}
                onDragEnd={onDragEnd}
              />
            ))}
          </Column>
        ))}
      </div>
    </section>
  );

  /* ============ Subcomponentes ============ */

  function Column({
    title,
    count,
    isLoading,
    onDrop,
    allowDrop,
    children,
  }: {
    title: string;
    count: number;
    isLoading?: boolean;
    onDrop: (id: string) => void;
    allowDrop: (e: React.DragEvent) => void;
    children: React.ReactNode;
  }) {
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (id) onDrop(id);
    };

    return (
      <div
        className="
          w-[240px] lg:w-[260px] shrink-0
          rounded-2xl border glass-card
          flex flex-col max-h-[72vh]
        "
        onDragOver={allowDrop}
        onDrop={handleDrop}
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
          {isLoading ? "Guardando cambios…" : "Arrastra candidatos para moverlos de etapa"}
        </div>
      </div>
    );
  }

  function Card({
    card,
    jobId,
    dragging,
    onDragStart,
    onDragEnd,
  }: {
    card: AppCard;
    jobId: string;
    dragging: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
  }) {
    const when =
      (card as any).updatedAt
        ? new Date((card as any).updatedAt)
        : card.createdAt
        ? new Date(card.createdAt)
        : null;

    return (
      <article
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", card.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className={[
          "group rounded-xl border border-zinc-200/70 bg-white px-3 py-2.5 text-xs shadow-[0_1px_3px_rgba(15,23,42,0.12)]",
          "hover:border-emerald-500/70 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900",
          dragging ? "opacity-60 ring-2 ring-emerald-500/40" : "",
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

        {Array.isArray(card.candidate.skills) &&
          card.candidate.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {card.candidate.skills.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {s}
                </span>
              ))}
              {card.candidate.skills.length > 4 && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  +{card.candidate.skills.length - 4}
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
