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

export default function Step2Security({ data, onChange, onNext, onBack }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (field: keyof Props["data"]) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  // Calcular fortaleza de la contraseña
  const strength = calculatePasswordStrength(data.password);
  const requirements = getPasswordRequirements(data.password);
  
  const strengthColors = {
    0: { bg: "bg-gray-200", text: "text-gray-600", label: "" },
    1: { bg: "bg-red-500", text: "text-red-600", label: "Débil" },
    2: { bg: "bg-orange-500", text: "text-orange-600", label: "Regular" },
    3: { bg: "bg-yellow-500", text: "text-yellow-600", label: "Buena" },
    4: { bg: "bg-emerald-500", text: "text-emerald-600", label: "Fuerte" },
  };

  const strengthColor = strengthColors[strength as keyof typeof strengthColors];

  // Validar que las contraseñas coincidan
  const passwordsMatch = 
    data.password && 
    data.confirmPassword && 
    data.password === data.confirmPassword;

  const isFormValid = 
    strength >= 3 && // Al menos "Buena"
    passwordsMatch;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Contraseña */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={data.password}
            onChange={handleChange("password")}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Crea una contraseña segura"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Medidor de fortaleza */}
        {data.password && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded ${
                    level <= strength ? strengthColor.bg : "bg-gray-200"
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
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
          Confirmar contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={data.confirmPassword}
            onChange={handleChange("confirmPassword")}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Indicador de coincidencia */}
        {data.confirmPassword && (
          <p className={`mt-1 text-xs ${passwordsMatch ? "text-emerald-600" : "text-red-600"}`}>
            {passwordsMatch ? "✓ Las contraseñas coinciden" : "✗ Las contraseñas no coinciden"}
          </p>
        )}
      </div>

      {/* Requisitos de contraseña */}
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-700">
          Requisitos de contraseña:
        </p>
        <ul className="space-y-1">
          {requirements.map((req, index) => (
            <li
              key={index}
              className={`flex items-center gap-2 text-xs ${
                req.met ? "text-emerald-600" : "text-gray-500"
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
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          ← Atrás
        </button>
        <button
          type="submit"
          disabled={!isFormValid}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600"
        >
          Continuar →
        </button>
      </div>
    </form>
  );
}