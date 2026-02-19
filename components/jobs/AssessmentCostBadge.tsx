// components/jobs/AssessmentCostBadge.tsx
import { getAssessmentCost, formatCredits } from "@/lib/assessments/pricing";
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";

interface AssessmentCostBadgeProps {
  type: AssessmentType;
  difficulty: AssessmentDifficulty;
  variant?: "default" | "compact" | "detailed";
  className?: string;
}

export function AssessmentCostBadge({
  type,
  difficulty,
  variant = "default",
  className = "",
}: AssessmentCostBadgeProps) {
  const cost = getAssessmentCost(type, difficulty);

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium ${className}`}
      >
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
          />
        </svg>
        {formatCredits(cost.total)}
      </span>
    );
  }

  if (variant === "detailed") {
    return (
      <div
        className={`inline-flex flex-col gap-1 px-3 py-2 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 ${className}`}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-violet-600 dark:text-violet-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
            />
          </svg>
          <span className="text-xl font-bold text-violet-600 dark:text-violet-400">
            {formatCredits(cost.total)}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            créditos
          </span>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Reserva: {formatCredits(cost.reserve)} • Al completar: +
          {formatCredits(cost.complete)}
        </div>
      </div>
    );
  }

  // default variant
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 ${className}`}
    >
      <svg
        className="w-5 h-5 text-violet-600 dark:text-violet-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
        />
      </svg>
      <div>
        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
          {formatCredits(cost.total)} créditos
        </p>
        <p className="text-xs text-violet-600 dark:text-violet-400">
          por candidato
        </p>
      </div>
    </div>
  );
}