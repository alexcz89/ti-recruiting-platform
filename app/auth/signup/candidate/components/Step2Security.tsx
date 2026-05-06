// app/auth/signup/candidate/components/Step2Security.tsx
"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { calculatePasswordStrength, getPasswordRequirements } from "@/lib/validation";

interface Props {
  data: {
    password: string;
    confirmPassword: string;
  };
  onChange: (updates: Partial<Props["data"]>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Clases reutilizables
const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-3 pr-10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors";

const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function Step2Security({ data, onChange, onNext, onBack }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange =
    (field: keyof Props["data"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: e.target.value });
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const strength = calculatePasswordStrength(data.password);
  const requirements = getPasswordRequirements(data.password);

  const strengthColors = {
    0: { bg: "bg-zinc-200 dark:bg-zinc-700", text: "text-zinc-500 dark:text-zinc-400", label: "" },
    1: { bg: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "Débil" },
    2: { bg: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", label: "Regular" },
    3: { bg: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400", label: "Buena" },
    4: { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Fuerte" },
  };

  const strengthColor = strengthColors[strength as keyof typeof strengthColors];

  const passwordsMatch =
    data.password &&
    data.confirmPassword &&
    data.password === data.confirmPassword;

  const isFormValid = strength >= 3 && passwordsMatch;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Contraseña */}
      <div>
        <label htmlFor="password" className={labelClass}>
          Contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={data.password}
            onChange={handleChange("password")}
            className={inputClass}
            placeholder="Crea una contraseña segura"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Medidor de fortaleza */}
        {data.password && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded transition-colors ${
                    level <= strength ? strengthColor.bg : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs ${strengthColor.text}`}>
              {strengthColor.label && `Fortaleza: ${strengthColor.label}`}
            </p>
          </div>
        )}
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirmar contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={data.confirmPassword}
            onChange={handleChange("confirmPassword")}
            className={inputClass}
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Indicador de coincidencia */}
        {data.confirmPassword && (
          <p className={`mt-1 text-xs ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {passwordsMatch ? "✓ Las contraseñas coinciden" : "✗ Las contraseñas no coinciden"}
          </p>
        )}
      </div>

      {/* Requisitos de contraseña */}
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/50 p-2.5">
        <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Requisitos de contraseña:
        </p>
        <ul className="space-y-1">
          {requirements.map((req, index) => (
            <li
              key={index}
              className={`flex items-center gap-2 text-xs ${
                req.met
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <span>{req.met ? "✓" : "○"}</span>
              <span>{req.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Botones de navegación */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          ← Atrás
        </button>
        <button
          type="submit"
          disabled={!isFormValid}
          className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 dark:disabled:hover:bg-emerald-500"
        >
          Continuar →
        </button>
      </div>
    </form>
  );
}