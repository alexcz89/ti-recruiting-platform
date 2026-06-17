"use client";

import { useState, useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { ClipboardCheck, DollarSign, AlertCircle, ChevronDown, HelpCircle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { getAssessmentCost, formatCredits } from "@/lib/assessments/pricing";
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";

const TYPE_LABELS: Record<string, string> = {
  CODING: "Coding Challenge",
  MCQ: "Opción Múltiple",
  TEXT: "Respuesta Abierta",
  MIXED: "Mixta",
};

const DIFF_LABELS: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  EXPERT: "Experto",
};

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}
function diffLabel(diff: string) {
  return DIFF_LABELS[diff] ?? diff;
}

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
  // Uso any aquí para que el componente compile aunque JobForm todavía
  // no haya sido actualizado de assessmentTemplateId -> assessmentTemplateIds
  const { watch, setValue } = useFormContext<any>();

  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyCredits, setCompanyCredits] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [infoExpanded, setInfoExpanded] = useState(true);

  const selectedTemplateIds: string[] = watch("assessmentTemplateIds") || [];

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const templatesRes = await fetch("/api/dashboard/assessments/templates", { cache: "no-store" });

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
      console.error("Error fetching assessments step data:", error);
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

  const selectedTemplates = templates.filter((t) =>
    selectedTemplateIds.includes(t.id)
  );

  const totalCost = selectedTemplates.reduce((acc, template) => {
    const cost =
      template.pricing ?? getAssessmentCost(template.type, template.difficulty);
    return acc + cost.total;
  }, 0);

  const totalReserve = selectedTemplates.reduce((acc, template) => {
    const cost =
      template.pricing ?? getAssessmentCost(template.type, template.difficulty);
    return acc + cost.reserve;
  }, 0);

  const hasLowCredits = companyCredits < 5;
  const creditsAfterReserve = companyCredits - totalReserve;

  const toggleTemplate = (id: string) => {
    const exists = selectedTemplateIds.includes(id);

    if (exists) {
      setValue(
        "assessmentTemplateIds",
        selectedTemplateIds.filter((templateId) => templateId !== id),
        { shouldDirty: true }
      );
    } else {
      setValue("assessmentTemplateIds", [...selectedTemplateIds, id], { shouldDirty: true });
    }
  };

  const isSelected = (id: string) => selectedTemplateIds.includes(id);

  return (
    <section className="p-6 lg:p-8">
      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
            <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              4) Evaluaciones Técnicas (Opcional)
            </h3>
            <p className="text-sm text-muted-foreground">
              Puedes asignar evaluaciones automáticas a los candidatos que apliquen
            </p>
          </div>
        </div>

        {/* Credits widget — compact, no hero-metric */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Balance de créditos
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Se reservan al enviar · se consumen al completar
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCredits(companyCredits)}{" "}
                <span className="text-xs font-normal text-zinc-500">créditos</span>
              </p>
              {totalReserve > 0 && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {formatCredits(creditsAfterReserve)} tras reserva
                </p>
              )}
            </div>
          </div>

          {hasLowCredits && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-100 p-2 dark:border-amber-800 dark:bg-amber-900/30">
              <div className="flex items-start gap-2 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Créditos bajos
                  </p>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-200">
                    Tienes menos de 5 créditos disponibles.{" "}
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

        {/* Info box — colapsable */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-800/30">
          <button
            type="button"
            onClick={() => setInfoExpanded(!infoExpanded)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <HelpCircle className="h-4 w-4 shrink-0 text-zinc-400" />
              ¿Cómo funcionan las evaluaciones?
            </div>
            <ChevronDown
              className={clsx(
                "h-4 w-4 text-zinc-400 transition-transform duration-200",
                infoExpanded && "rotate-180"
              )}
            />
          </button>
          {infoExpanded && (
            <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
              <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <li>• Puedes asignar varias evaluaciones a una vacante</li>
                <li>• Se envían automáticamente cuando un candidato aplica</li>
                <li>• Se reserva una parte del costo al enviar la invitación</li>
                <li>• Si el candidato no completa en 7 días, se reembolsan los créditos</li>
              </ul>
            </div>
          )}
        </div>

        {/* Selected templates summary */}
        {selectedTemplates.length > 0 && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Evaluaciones seleccionadas
                </h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedTemplates.length} seleccionada
                  {selectedTemplates.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCredits(totalCost)}
                </p>
                <p className="text-xs text-zinc-500">créditos totales</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Reserva: {formatCredits(totalReserve)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {selectedTemplates.map((template) => {
                const cost =
                  template.pricing ??
                  getAssessmentCost(template.type, template.difficulty);

                return (
                  <div
                    key={template.id}
                    className="rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {template.title}
                        </h5>

                        {template.description && (
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {template.description}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                            {typeLabel(template.type)}
                          </span>
                          <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                            {diffLabel(template.difficulty)}
                          </span>
                          <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                            {template.totalQuestions} preguntas
                          </span>
                          <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                            {template.timeLimit} min
                          </span>
                          <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
                            Aprobación: {template.passingScore}%
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCredits(cost.total)}
                        </p>
                        <p className="text-xs text-zinc-500">total</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          Reserva: {formatCredits(cost.reserve)}
                        </p>

                        <button
                          type="button"
                          onClick={() => toggleTemplate(template.id)}
                          className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Buscar evaluaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {/* Template list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border-2 border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="mt-3 flex gap-2">
                      <div className="h-6 w-20 rounded-md bg-zinc-200 dark:bg-zinc-700" />
                      <div className="h-6 w-16 rounded-md bg-zinc-200 dark:bg-zinc-700" />
                      <div className="h-6 w-24 rounded-md bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-8 text-center text-zinc-500">
            <p className="text-sm">
              {searchQuery
                ? "No se encontraron evaluaciones con ese término"
                : "No hay evaluaciones disponibles"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map((template) => {
              const cost =
                template.pricing ??
                getAssessmentCost(template.type, template.difficulty);

              const alreadyReserved = selectedTemplates
                .filter((t) => t.id !== template.id)
                .reduce((acc, t) => {
                  const c = t.pricing ?? getAssessmentCost(t.type, t.difficulty);
                  return acc + c.reserve;
                }, 0);
              const remainingCredits = companyCredits - alreadyReserved;
              const canAfford = isSelected(template.id) || remainingCredits >= cost.reserve;
              const selected = isSelected(template.id);

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => canAfford && toggleTemplate(template.id)}
                  disabled={!canAfford}
                  className={clsx(
                    "w-full rounded-xl border-2 p-4 text-left transition-all",
                    selected
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                      : canAfford
                      ? "border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-zinc-800 dark:hover:border-emerald-700"
                      : "cursor-not-allowed border-zinc-200 opacity-60 dark:border-zinc-800"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                          <ClipboardCheck
                            className={clsx(
                              "h-4 w-4",
                              selected
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-zinc-500 dark:text-zinc-400"
                            )}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
                              {template.title}
                            </h4>
                            {selected && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            )}
                          </div>

                          {template.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                              {template.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                              {typeLabel(template.type)}
                            </span>
                            <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                              {diffLabel(template.difficulty)}
                            </span>
                            <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                              {template.totalQuestions} preguntas
                            </span>
                            <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                              {template.timeLimit} min
                            </span>
                            <span className="rounded-md border bg-zinc-50 px-2 py-1 text-xs font-medium dark:bg-zinc-900">
                              Aprobación: {template.passingScore}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
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

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Atrás
          </button>

          <div className="flex items-center gap-3">
            {selectedTemplates.length > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Costo total: {formatCredits(totalCost)}
                </p>
                <p className="text-xs text-zinc-500">
                  Reserva inicial: {formatCredits(totalReserve)}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onNext}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {selectedTemplates.length > 0 ? "Continuar" : "Saltar por ahora"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
