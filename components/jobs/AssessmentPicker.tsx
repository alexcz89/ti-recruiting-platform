// components/jobs/AssessmentPicker.tsx
"use client";

import { useState, useEffect } from "react";
import { getAssessmentCost, formatCredits } from "@/lib/assessments/pricing";
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";

interface AssessmentTemplate {
  id: string;
  title: string;
  description: string | null;
  type: AssessmentType;
  difficulty: AssessmentDifficulty;
  totalQuestions: number;
  timeLimit: number;
  slug: string;
}

interface AssessmentPickerProps {
  selectedTemplateId?: string;
  onSelect: (templateId: string | null) => void;
  companyCredits?: number;
  className?: string;
}

export function AssessmentPicker({
  selectedTemplateId,
  onSelect,
  companyCredits = 0,
  className = "",
}: AssessmentPickerProps) {
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/assessments");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const query = searchQuery.toLowerCase();
    return (
      template.title.toLowerCase().includes(query) ||
      template.type.toLowerCase().includes(query) ||
      template.difficulty.toLowerCase().includes(query)
    );
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className={className}>
      {/* Header con balance de créditos */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Balance de Créditos
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Los créditos se cobran cuando los candidatos completan las evaluaciones
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
              {formatCredits(companyCredits)}
            </p>
            <p className="text-xs text-zinc-500">créditos disponibles</p>
          </div>
        </div>
        
        {companyCredits < 5 && (
          <div className="mt-3 p-2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs">
            ⚠️ Créditos bajos.{" "}
            <a
              href="/dashboard/billing/credits"
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
            >
              Comprar más
            </a>
          </div>
        )}
      </div>

      {/* Evaluación seleccionada */}
      {selectedTemplate && (
        <div className="mb-6 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {selectedTemplate.type === "CODING" ? "💻" : "📝"}
                </span>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedTemplate.title}
                </h4>
              </div>
              {selectedTemplate.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  {selectedTemplate.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  {selectedTemplate.type}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {selectedTemplate.difficulty}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {selectedTemplate.totalQuestions} preguntas
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {selectedTemplate.timeLimit} min
                </span>
              </div>
            </div>
            <div className="ml-4 text-right">
              <div className="mb-2">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCredits(
                    getAssessmentCost(selectedTemplate.type, selectedTemplate.difficulty).total
                  )}
                </p>
                <p className="text-xs text-zinc-500">créditos/candidato</p>
              </div>
              <button
                onClick={() => onSelect(null)}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buscador */}
      {!selectedTemplate && (
        <>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar evaluaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Lista de evaluaciones */}
          {loading ? (
            <div className="text-center py-8 text-zinc-500">
              <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-violet-600 rounded-full animate-spin" />
              <p className="mt-2 text-sm">Cargando evaluaciones...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <p className="text-sm">
                {searchQuery
                  ? "No se encontraron evaluaciones"
                  : "No hay evaluaciones disponibles"}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {filteredTemplates.map((template) => {
                const cost = getAssessmentCost(template.type, template.difficulty);
                const canAfford = companyCredits >= cost.total;

                return (
                  <button
                    key={template.id}
                    onClick={() => canAfford && onSelect(template.id)}
                    disabled={!canAfford}
                    className={`
                      w-full text-left p-4 rounded-xl border-2 transition-all
                      ${
                        canAfford
                          ? "border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md cursor-pointer"
                          : "border-zinc-100 dark:border-zinc-800 opacity-50 cursor-not-allowed"
                      }
                      bg-white dark:bg-zinc-900
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">
                            {template.type === "CODING" ? "💻" : "📝"}
                          </span>
                          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {template.title}
                          </h4>
                        </div>
                        {template.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium">
                            {template.type}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium">
                            {template.difficulty}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium">
                            {template.totalQuestions} preguntas
                          </span>
                          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium">
                            {template.timeLimit} min
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 text-right flex-shrink-0">
                        <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                          {formatCredits(cost.total)}
                        </p>
                        <p className="text-xs text-zinc-500 mb-1">créditos</p>
                        {!canAfford && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            Sin créditos
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}