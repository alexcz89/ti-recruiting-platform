// JobWizard/components/QualityIndicator.tsx
"use client";

import { Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { QualityScore } from "../hooks/useQualityScore";
import clsx from "clsx";

type QualityIndicatorProps = {
  score: QualityScore;
  compact?: boolean;
};

// Maps useQualityScore step numbers to wizard step labels (step 3 = Prestaciones, step 4 = Detalles)
const STEP_LABEL_MAP: Record<number, string> = {
  1: "Básicos",
  2: "Prestaciones",
  3: "Prestaciones",
  4: "Detalles",
  5: "Evaluaciones",
};

export default function QualityIndicator({
  score,
  compact = false,
}: QualityIndicatorProps) {
  const getScoreColor = (value: number) => {
    if (value >= 90) return "text-green-600 dark:text-green-400";
    if (value >= 75) return "text-emerald-600 dark:text-emerald-400";
    if (value >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (value >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-zinc-500 dark:text-zinc-400";
  };

  const getScoreGradient = (value: number) => {
    if (value >= 90) return "from-green-500 to-emerald-500";
    if (value >= 75) return "from-emerald-500 to-emerald-600";
    if (value >= 60) return "from-yellow-500 to-orange-500";
    if (value >= 40) return "from-orange-500 to-red-500";
    return "from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-500";
  };

  const getLevelLabel = (value: number) => {
    if (value >= 90) return "Excelente";
    if (value >= 75) return "Muy buena";
    if (value >= 60) return "Buena";
    if (value >= 40) return "Mejorable";
    return "Baja";
  };

  // Tells the user which specific wizard step to complete, not how many abstract "pasos"
  const progressMessage = (() => {
    if (score.overall >= 60) return `Nivel actual: ${getLevelLabel(score.overall)}`;
    const stepsWithIssues = [...new Set(score.issues.map((i) => i.step))];
    if (stepsWithIssues.length === 0) return `Nivel actual: ${getLevelLabel(score.overall)}`;
    const stepNames = [...new Set(stepsWithIssues.map((s) => STEP_LABEL_MAP[s] ?? `Paso ${s}`))];
    if (stepNames.length === 1) return `Completa ${stepNames[0]} para subir`;
    return `Completa ${stepNames.length} pasos para subir`;
  })();

  const topIssues = score.issues.slice(0, 3);
  const isNew = score.overall < 40;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium">Calidad:</span>
        <span className={clsx("text-sm font-bold", getScoreColor(score.overall))}>
          {score.overall}%
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold">Calidad de la vacante</h3>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={clsx("text-2xl font-semibold", getScoreColor(score.overall))}
            title="Puntuación basada en título, descripción, skills, sueldo, prestaciones, educación, idiomas y evaluaciones técnicas."
          >
            {score.overall}%
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {isNew ? "Ve completando los pasos" : progressMessage}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={clsx(
              "h-full bg-gradient-to-r transition-all duration-500",
              getScoreGradient(score.overall)
            )}
            style={{ width: `${score.overall}%` }}
          />
        </div>
      </div>

      {/* Completitud/Calidad solo aparece cuando hay suficiente contenido para que sean útiles */}
      {!isNew && (
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="text-sm">
            <div className="mb-1 text-zinc-500 dark:text-zinc-400">Completitud</div>
            <div className="font-semibold">{score.completeness}%</div>
          </div>
          <div className="text-sm">
            <div className="mb-1 text-zinc-500 dark:text-zinc-400">Calidad</div>
            <div className="font-semibold">{score.quality}%</div>
          </div>
        </div>
      )}

      {topIssues.length > 0 && (
        <div className="mb-4 space-y-2">
          {topIssues.map((issue, idx) => (
            <div
              key={`${issue.step}-${idx}-${issue.message}`}
              className="flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <AlertTriangle
                className={clsx(
                  "mt-0.5 h-3.5 w-3.5 flex-shrink-0",
                  issue.type === "error"
                    ? "text-red-500"
                    : issue.type === "warning"
                      ? "text-amber-500"
                      : "text-blue-500"
                )}
              />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {score.suggestions.length > 0 && (
        <div className="space-y-2">
          {score.suggestions.slice(0, 3).map((suggestion, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-400 dark:text-blue-400" />
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
