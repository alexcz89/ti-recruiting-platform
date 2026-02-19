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
  pricing: {
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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch templates
      const templatesRes = await fetch("/api/assessments", { cache: "no-store" });
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }

      // Fetch company credits
      const creditsRes = await fetch("/api/billing/credits");
      if (creditsRes.ok) {
        const data = await creditsRes.json();
        setCompanyCredits(data.balance?.available || 0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return templates;
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.type.toLowerCase().includes(query) ||
        t.difficulty.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const hasLowCredits = companyCredits < 5;

  return (
    <section className="p-6 lg:p-8">
      <div className="space-y-6">
        {/* Header */}
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

        {/* Balance de Créditos */}
        <div className="rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-50/50 to-purple-50/50 p-4 dark:border-violet-800/70 dark:from-violet-900/10 dark:to-purple-900/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
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
            <div className="mt-3 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Créditos Bajos
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 mt-0.5">
                    Tienes menos de 5 créditos. Los candidatos no recibirán evaluaciones.{" "}
                    <a
                      href="/dashboard/billing/credits"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Comprar más
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-800/70 dark:bg-blue-900/10">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                ¿Cómo funcionan las evaluaciones?
              </p>
              <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-xs">
                <li>• Se envían automáticamente cuando un candidato aplica</li>
                <li>• Reserva: 0.5 créditos al enviar, resto al completar</li>
                <li>• Si no completa en 7 días, se reembolsan los créditos</li>
                <li>• MCQ: 1.0 crédito | Coding: 2.5-4.0 créditos por candidato</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Evaluación Seleccionada */}
        {selectedTemplate && (
          <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
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
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium border">
                    {selectedTemplate.type}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium border">
                    {selectedTemplate.difficulty}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium border">
                    {selectedTemplate.totalQuestions} preguntas
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium border">
                    {selectedTemplate.timeLimit} min
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium border">
                    Passing: {selectedTemplate.passingScore}%
                  </span>
                </div>
              </div>
              <div className="ml-4 text-right">
                <div className="mb-2">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCredits(selectedTemplate.pricing.total)}
                  </p>
                  <p className="text-xs text-zinc-500">créditos/candidato</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Reserva: {formatCredits(selectedTemplate.pricing.reserve)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue("assessmentTemplateId", null)}
                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selector de Evaluación */}
        {!selectedTemplate && (
          <>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar evaluaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

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
                  const cost = template.pricing;
                  const canAfford = companyCredits >= cost.reserve;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => canAfford && setValue("assessmentTemplateId", template.id)}
                      disabled={!canAfford}
                      className={clsx(
                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                        canAfford
                          ? "border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md cursor-pointer"
                          : "border-zinc-100 dark:border-zinc-800 opacity-50 cursor-not-allowed",
                        "bg-white dark:bg-zinc-900"
                      )}
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

        {/* Navigation */}
        <div className="flex justify-between gap-4 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-6 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            onClick={onBack}
          >
            Atrás
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition"
            onClick={onNext}
          >
            {selectedTemplate ? "Continuar" : "Saltar por ahora"} →
          </button>
        </div>
      </div>
    </section>
  );
}