// app/auth/signup/candidate/components/ProgressBar.tsx
"use client";

interface Props {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ currentStep, totalSteps }: Props) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full">
      {/* Labels superiores */}
      <div className="mb-2 flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
        <span>Paso {currentStep} de {totalSteps}</span>
        <span>{Math.round(progress)}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Etiquetas de pasos */}
      <div className="mt-3 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
        <span className={currentStep >= 1 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
          Datos básicos
        </span>
        <span className={currentStep >= 2 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
          Seguridad
        </span>
        <span className={currentStep >= 3 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
          Perfil
        </span>
      </div>
    </div>
  );
}