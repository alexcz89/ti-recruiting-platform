// app/assessments/[templateId]/AssessmentProgress.tsx
'use client';

type Props = {
  current: number;
  total: number;
  answered: number;
};

export default function AssessmentProgress({ current, total, answered }: Props) {
  const progress = (current / total) * 100;
  const answeredProgress = (answered / total) * 100;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm text-muted mb-2">
        <span>Progreso</span>
        <span>
          {answered} de {total} respondidas
        </span>
      </div>

      <div className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        {/* Barra de respondidas */}
        <div
          className="absolute h-full bg-emerald-600 transition-all duration-300"
          style={{ width: `${answeredProgress}%` }}
        />
        
        {/* Indicador de pregunta actual */}
        <div
          className="absolute h-full w-1 bg-blue-600 transition-all duration-300"
          style={{ left: `${progress}%` }}
        />
      </div>
    </div>
  );
}