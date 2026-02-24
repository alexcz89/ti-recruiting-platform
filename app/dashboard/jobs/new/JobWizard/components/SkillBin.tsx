// app/dashboard/jobs/new/JobWizard/components/SkillBin.tsx
"use client";

import { X } from "lucide-react";

type Props = {
  title: string;
  items: string[];
  placeholder: string;
  onRemove: (name: string) => void;
  onDragStart: (name: string, e: React.DragEvent<HTMLSpanElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
};

export default function SkillBin({
  title,
  items,
  placeholder,
  onRemove,
  onDragStart,
  onDrop,
}: Props) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="rounded-md border border-zinc-200 bg-white p-5 min-h-[180px] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {title}
      </p>
      <div className="flex flex-wrap items-start gap-2 min-h-[32px]">
        {items.length === 0 ? (
          <span className="text-xs text-zinc-400">{placeholder}</span>
        ) : (
          items.map((name) => (
            <span
              key={name}
              draggable
              onDragStart={(e) => onDragStart(name, e)}
              className="group inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 transition cursor-pointer hover:bg-emerald-100/70 active:scale-[0.98] focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500/40 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
            >
              {name}
              <button
                type="button"
                aria-label="Remove"
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-700/60 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                onClick={() => onRemove(name)}
                title="Quitar"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}