// JobWizard/components/QualityIndicator.tsx
"use client";

import { CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { QualityScore } from "../hooks/useQualityScore";
import clsx from "clsx";

type QualityIndicatorProps = {
  score: QualityScore;
  compact?: boolean;
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
    return "text-red-600 dark:text-red-400";
  };

  const getScoreGradient = (value: number) => {
    if (value >= 90) return "from-green-500 to-emerald-500";
    if (value >= 75) return "from-emerald-500 to-emerald-600";
    if (value >= 60) return "from-yellow-500 to-orange-500";
    if (value >= 40) return "from-orange-500 to-red-500";
    return "from-red-500 to-red-600";
  };

  const getLevelLabel = (value: number) => {
    if (value >= 90) return "Excelente";
    if (value >= 75) return "Muy buena";
    if (value >= 60) return "Buena";
    if (value >= 40) return "Mejorable";
    return "Baja";
  };

  const stepsToGood = (() => {
    if (score.overall >= 60) return 0;
    const uniqueSteps = new Set(score.issues.map((issue) => issue.step)).size;
    return uniqueSteps > 0 ? uniqueSteps : Math.max(1, Math.ceil((60 - score.overall) / 10));
  })();

  const progressMessage =
    stepsToGood > 0
      ? `Faltan ${stepsToGood} pasos para llegar a Buena`
      : `Nivel actual: ${getLevelLabel(score.overall)}`;

  const missingItems = Array.from(
    new Set(
      score.issues.map((issue) => {
        const msg = issue.message.toLowerCase();

        if (msg.includes("skills")) return "Skills";
        if (msg.includes("prestaciones")) return "Prestaciones";
        if (msg.includes("sueldo") || msg.includes("rango salarial")) return "Sueldo";
        if (msg.includes("ingl") || msg.includes("idiomas")) return "Idiomas";
        if (msg.includes("educa") || msg.includes("acad")) return "Educación";
        if (msg.includes("descrip")) return "Descripción";
        if (msg.includes("horario")) return "Horario";
        if (msg.includes("evaluación") || msg.includes("evaluacion")) return "Evaluación";
        return issue.message;
      })
    )
  ).slice(0, 5);

  const topIssues = score.issues.slice(0, 3);

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
        <div className="flex flex-col items-end">
          <span className={clsx("text-2xl font-semibold", getScoreColor(score.overall))}>
            {score.overall}%
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {progressMessage}
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

      {missingItems.length > 0 && (
        <div className="mb-4 rounded-lg border border-zinc-200/70 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Áreas a reforzar
          </div>
          <ul className="mt-2 grid gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            {missingItems.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
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
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}