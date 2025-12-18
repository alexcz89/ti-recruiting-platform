// JobWizard/components/QualityIndicator.tsx
"use client";

import { AlertCircle, CheckCircle, Info, TrendingUp } from "lucide-react";
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

  const getScoreLabel = (value: number) => {
    if (value >= 90) return "Excelente";
    if (value >= 75) return "Muy buena";
    if (value >= 60) return "Buena";
    if (value >= 40) return "Regular";
    return "Mejorable";
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium">Calidad:</span>
        <span className={clsx("text-sm font-bold", getScoreColor(score.overall))}>
          {score.overall}%
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold">Calidad de la vacante</h3>
        </div>
        <div className="flex flex-col items-end">
          <span className={clsx("text-3xl font-bold", getScoreColor(score.overall))}>
            {score.overall}%
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {getScoreLabel(score.overall)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={clsx(
              "h-full bg-gradient-to-r transition-all duration-500",
              getScoreGradient(score.overall)
            )}
            style={{ width: `${score.overall}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="text-sm">
          <div className="text-zinc-500 dark:text-zinc-400 mb-2">Completitud</div>
          <div className="font-semibold">{score.completeness}%</div>
        </div>
        <div className="text-sm">
          <div className="text-zinc-500 dark:text-zinc-400 mb-2">Calidad</div>
          <div className="font-semibold">{score.quality}%</div>
        </div>
      </div>

      {/* Issues */}
      {score.issues.length > 0 && (
        <div className="space-y-3 mb-6">
          {score.issues.map((issue, idx) => (
            <div
              key={idx}
              className={clsx(
                "flex items-start gap-3 rounded-lg p-3 text-xs",
                issue.type === "error" &&
                  "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",
                issue.type === "warning" &&
                  "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400",
                issue.type === "info" &&
                  "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400"
              )}
            >
              {issue.type === "error" && <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              {issue.type === "warning" && <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              {issue.type === "info" && <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {score.suggestions.length > 0 && (
        <div className="space-y-3">
          {score.suggestions.slice(0, 3).map((suggestion, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-emerald-500" />
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
