// JobWizard/components/Stepper.tsx
"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

type StepperProps = {
  step: number;
  total?: number;
  maxStepVisited: number;
  stepCompletion: boolean[];
  onJump?: (n: number) => void;
};

const STEP_LABELS = [
  "Básicos",
  "Empleo",
  "Prestaciones",
  "Detalles",
  "Revisión",
];

export default function Stepper({
  step,
  total = 5,
  maxStepVisited,
  stepCompletion,
  onJump,
}: StepperProps) {
  const items = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="mb-6 p-4">
      <ol className="flex items-center justify-between gap-4">
        {items.map((n, idx) => {
          const done = n < step;
          const active = n === step;
          const canJump = n <= maxStepVisited;
          const isComplete = stepCompletion[idx];

          return (
            <li key={n} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => canJump && onJump?.(n)}
                disabled={!canJump}
                className={clsx(
                  "group relative flex flex-col items-center gap-2 transition-all duration-200",
                  canJump ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                )}
                aria-current={active ? "step" : undefined}
              >
                {/* Circle */}
                <div
                  className={clsx(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold text-sm transition-all duration-200",
                    active &&
                      "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 scale-110",
                    done &&
                      !active &&
                      "border-emerald-500 bg-emerald-500 text-white",
                    !done &&
                      !active &&
                      "border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                    canJump && !active && "group-hover:scale-105"
                  )}
                >
                  {done && !active ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{n}</span>
                  )}
                  
                  {/* Checkmark for completed step */}
                  {isComplete && !done && !active && (
                    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white ring-2 ring-white dark:ring-zinc-900">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Label */}
                <span
                  className={clsx(
                    "text-[11px] sm:text-xs font-medium transition-colors hidden sm:block text-center leading-snug whitespace-nowrap",
                    active && "text-emerald-600 dark:text-emerald-400",
                    done && !active && "text-emerald-600 dark:text-emerald-400",
                    !done && !active && "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  {STEP_LABELS[idx] || `Paso ${n}`}
                </span>
              </button>

              {/* Connector Line */}
              {n < total && (
                <div className="flex-1 px-4">
                  <div
                    className={clsx(
                      "h-0.5 transition-colors duration-300",
                      done
                        ? "bg-emerald-500"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile progress bar */}
      <div className="mt-4 sm:hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
          <span>Paso {step} de {total}</span>
          <span>{Math.round((step / total) * 100)}% completado</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
