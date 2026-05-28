// JobWizard/components/TemplateSelector.tsx
"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { TemplateJob } from "../types";
import clsx from "clsx";

type TemplateSelectorProps = {
  templates: TemplateJob[];
  onApply: (id: string) => void;
};

export default function TemplateSelector({
  templates,
  onApply,
}: TemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (!templates.length) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        Usar vacante anterior
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 px-3 py-2">
      <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <select
        className="flex-1 min-w-0 rounded-md border border-emerald-300 bg-white text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-emerald-800 dark:bg-zinc-900 dark:text-zinc-100"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <option value="">— Selecciona una vacante —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title || `Vacante ${t.id.slice(0, 8)}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={clsx(
          "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
          selectedId
            ? "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95"
            : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800"
        )}
        disabled={!selectedId}
        onClick={() => {
          if (selectedId) {
            onApply(selectedId);
            setExpanded(false);
          }
        }}
      >
        Aplicar
      </button>
      <button
        type="button"
        onClick={() => { setExpanded(false); setSelectedId(""); }}
        className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
