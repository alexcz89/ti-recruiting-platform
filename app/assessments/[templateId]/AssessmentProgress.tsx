// app/assessments/[templateId]/AssessmentProgress.tsx
'use client';

type Props = {
  current: number; // 1-based (p.ej. currentIndex + 1)
  total: number;
  answered: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AssessmentProgress({ current, total, answered }: Props) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeAnswered = Number.isFinite(answered) ? answered : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;

  const answeredPct =
    safeTotal > 0 ? clamp((safeAnswered / safeTotal) * 100, 0, 100) : 0;

  // Indicador de pregunta actual: usar (current-1)/total para que la pregunta 1 arranque en 0%
  const currentPct =
    safeTotal > 0 ? clamp(((safeCurrent - 1) / safeTotal) * 100, 0, 100) : 0;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm text-muted mb-2">
        <span>Progreso</span>
        <span>
          {clamp(safeAnswered, 0, safeTotal)} de {safeTotal} respondidas
        </span>
      </div>

      <div className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        {/* Barra de respondidas */}
        <div
          className="absolute inset-y-0 left-0 bg-emerald-600 transition-all duration-300"
          style={{ width: `${answeredPct}%` }}
        />

        {/* Indicador de pregunta actual */}
        <div
          className="absolute inset-y-0 w-1 bg-blue-600 transition-all duration-300 -translate-x-1/2"
          style={{ left: `${currentPct}%` }}
        />
      </div>
    </div>
  );
}
