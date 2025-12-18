// JobWizard/components/TemplateSelector.tsx
"use client";

import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          Usar plantilla de vacante anterior
        </h4>
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <select
            className="w-full appearance-none rounded-lg border border-emerald-300 bg-white px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-emerald-800 dark:bg-zinc-900"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setIsOpen(!!e.target.value);
            }}
          >
            <option value="">— Selecciona una vacante —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || `Vacante ${t.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>

        <button
          type="button"
          className={clsx(
            "rounded-lg px-4 py-3 text-sm font-medium transition-all",
            selectedId
              ? "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800"
          )}
          disabled={!selectedId}
          onClick={() => {
            if (selectedId) {
              onApply(selectedId);
              setIsOpen(false);
            }
          }}
        >
          Aplicar
        </button>
      </div>

      {/* Preview */}
      {isOpen && selectedTemplate && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3">
            Vista previa:
          </p>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-zinc-500">Título:</span>{" "}
              <span className="font-medium">{selectedTemplate.title}</span>
            </div>
            <div>
              <span className="text-zinc-500">Ubicación:</span>{" "}
              <span className="font-medium">
                {selectedTemplate.locationType === "REMOTE"
                  ? "Remoto"
                  : selectedTemplate.city || "No especificada"}
              </span>
            </div>
            {(selectedTemplate.salaryMin || selectedTemplate.salaryMax) && (
              <div>
                <span className="text-zinc-500">Sueldo:</span>{" "}
                <span className="font-medium">
                  {selectedTemplate.currency}{" "}
                  {selectedTemplate.salaryMin || "—"} -{" "}
                  {selectedTemplate.salaryMax || "—"}
                </span>
              </div>
            )}
            {selectedTemplate.skills && selectedTemplate.skills.length > 0 && (
              <div>
                <span className="text-zinc-500">Skills:</span>{" "}
                <span className="font-medium">
                  {selectedTemplate.skills.length} tecnologías
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-emerald-700 dark:text-emerald-400">
        💡 Ahorra tiempo reutilizando información de vacantes anteriores
      </p>
    </div>
  );
}
