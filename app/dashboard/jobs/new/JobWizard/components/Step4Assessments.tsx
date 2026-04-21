// app/dashboard/jobs/new/JobWizard/components/Step4Assessments.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { ClipboardCheck, DollarSign, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { JobForm } from "../types";
import { getAssessmentCost, formatCredits } from "@/lib/assessments/pricing";
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";

type Step4AssessmentsProps = {
  onNext: () => void;
  onBack: () => void;
};

interface AssessmentTemplate {
  id: string;
  title: string;
  description: string | null;
  type: AssessmentType;
  difficulty: AssessmentDifficulty;
  totalQuestions: number;
  timeLimit: number;
  passingScore: number;
  pricing?: {
    reserve: number;
    complete: number;
    total: number;
  };
}

export default function Step4Assessments({
  onNext,
  onBack,
}: Step4AssessmentsProps) {
  const { watch, setValue } = useFormContext<JobForm>();

  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyCredits, setCompanyCredits] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedTemplateId = watch("assessmentTemplateId");

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const templatesRes = await fetch("/api/assessments", { cache: "no-store" });
      if (templatesRes.ok) {
        const data = await templatesRes.json();

        const normalizedTemplates: AssessmentTemplate[] = (data.templates || []).map(
          (t: AssessmentTemplate) => ({
            ...t,
            pricing: t.pricing ?? getAssessmentCost(t.type, t.difficulty),
          })
        );

        setTemplates(normalizedTemplates);
      } else {
        setTemplates([]);
      }

      const creditsRes = await fetch("/api/billing/credits", { cache: "no-store" });
      if (creditsRes.ok) {
        const data = await creditsRes.json();
        setCompanyCredits(Number(data.available ?? 0));
      } else {
        setCompanyCredits(0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setTemplates([]);
      setCompanyCredits(0);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return templates;

    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.type.toLowerCase().includes(query) ||
        t.difficulty.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const selectedTemplateCost = selectedTemplate
    ? selectedTemplate.pricing ??
      getAssessmentCost(selectedTemplate.type, selectedTemplate.difficulty)
    : null;

  const hasLowCredits = companyCredits < 5;

  return (
    <section className="p-6 lg:p-8">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
            <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Evaluación Técnica (Opcional)
            </h3>
            <p className="text-sm text-muted-foreground">
              Envía evaluaciones automáticas a los candidatos que apliquen
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-50/50 to-purple-50/50 p-4 dark:border-violet-800/70 dark:from-violet-900/10 dark:to-purple-900/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Balance de Créditos
                </h4>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Los créditos se consumen cuando los candidatos completan evaluaciones
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                {formatCredits(companyCredits)}
              </p>
              <p className="text-xs text-zinc-500">disponibles</p>
            </div>
          </div>

          {hasLowCredits && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-100 p-2 dark:border-amber-800 dark:bg-amber-900/30">
              <div className="flex items-start gap-2 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Créditos Bajos
                  </p>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-200">
                    Tienes menos de 5 créditos. Los candidatos no recibirán evaluaciones.{" "}
                    <a
                      href="/dashboard/billing/credits"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      Comprar más
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-800/70 dark:bg-blue-900/10">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="text-sm">
              <p className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
                ¿Cómo funcionan las evaluaciones?
              </p>
              <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                <li>• Se envían automáticamente cuando un candidato aplica</li>
                <li>• Reserva: 0.5 créditos al enviar, resto al completar</li>
                <li>• Si no completa en 7 días, se reembolsan los créditos</li>
                <li>• MCQ: 1.0 crédito · Coding: 2.5-4.0 créditos por candidato</li>
              </ul>
            </div>
          </div>
        </div>

        {selectedTemplate && selectedTemplateCost && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedTemplate.title}
                </h4>
                {selectedTemplate.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {selectedTemplate.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md border bg-white px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                    {selectedTemplate.type}
                  </span>
                  <span className="rounded-md border bg-white px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                    {selectedTemplate.difficulty}
                  </span>
                  <span className="rounded-md border bg-white px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                    {selectedTemplate.totalQuestions} preguntas
                  </span>
                  <span className="rounded-md border bg-white px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                    {selectedTemplate.timeLimit} min
                  </span>
                  <span className="rounded-md border bg-white px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                    Passing: {selectedTemplate.passingScore}%
                  </span>
                </div>
              </div>

              <div className="ml-4 text-right">
                <div className="mb-2">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCredits(selectedTemplateCost.total)}
                  </p>
                  <p className="text-xs text-zinc-500">créditos/candidato</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Reserva: {formatCredits(selectedTemplateCost.reserve)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue("assessmentTemplateId", undefined)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {!selectedTemplate && (
          <>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar evaluaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            {loading ? (
              <div className="py-8 text-center text-zinc-500">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-600" />
                <p className="mt-2 text-sm">Cargando evaluaciones...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-8 text-center text-zinc-500">
                <p className="text-sm">
                  {searchQuery
                    ? "No se encontraron evaluaciones"
                    : "No hay evaluaciones disponibles"}
                </p>
              </div>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                {filteredTemplates.map((template) => {
                  const cost =
                    template.pricing ?? getAssessmentCost(template.type, template.difficulty);
                  const canAfford = companyCredits >= cost.reserve;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() =>
                        canAfford && setValue("assessmentTemplateId", template.id)
                      }
                      disabled={!canAfford}
                      className={clsx(
                        "w-full rounded-xl border-2 p-4 text-left transition-all",
                        canAfford
                          ? "border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-zinc-800 dark:hover:border-emerald-700"
                          : "cursor-not-allowed border-zinc-200 opacity-60 dark:border-zinc-800"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg bg-violet-100 p-2 dark:bg-violet-900/20">
                              <ClipboardCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
                                {template.title}
                              </h4>
                              {template.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                                  {template.description}
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                                  {template.type}
                                </span>
                                <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                                  {template.difficulty}
                                </span>
                                <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                                  {template.totalQuestions} preguntas
                                </span>
                                <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                                  {template.timeLimit} min
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                            {formatCredits(cost.total)}
                          </p>
                          <p className="text-xs text-zinc-500">total</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            Reserva: {formatCredits(cost.reserve)}
                          </p>
                          {!canAfford && (
                            <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                              Sin créditos suficientes
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

        <div className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Atrás
          </button>

          <div className="flex items-center gap-3">
            {selectedTemplate && selectedTemplateCost && (
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Costo: {formatCredits(selectedTemplateCost.total)}
                </p>
                <p className="text-xs text-zinc-500">
                  Reserva inicial: {formatCredits(selectedTemplateCost.reserve)}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={onNext}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}