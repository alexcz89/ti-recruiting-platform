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
      {/* Labels */}
      <div className="mb-2 flex justify-between text-xs text-gray-600">
        <span>Paso {currentStep} de {totalSteps}</span>
        <span>{Math.round(progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-emerald-600 transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step labels */}
      <div className="mt-3 flex justify-between text-[10px] text-gray-500">
        <span className={currentStep >= 1 ? "font-semibold text-emerald-600" : ""}>
          Datos básicos
        </span>
        <span className={currentStep >= 2 ? "font-semibold text-emerald-600" : ""}>
          Seguridad
        </span>
        <span className={currentStep >= 3 ? "font-semibold text-emerald-600" : ""}>
          Perfil
        </span>
      </div>
    </div>
  );
}