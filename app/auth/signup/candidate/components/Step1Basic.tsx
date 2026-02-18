// app/auth/signup/candidate/components/Step1Basic.tsx
"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  data: {
    firstName: string;
    lastName: string;
    maternalSurname: string;
    email: string;
  };
  onChange: (updates: Partial<Props["data"]>) => void;
  onNext: () => void;
}

export default function Step1Basic({ data, onChange, onNext }: Props) {
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Verificar disponibilidad del email con debounce
  useEffect(() => {
    if (!data.email || !data.email.includes("@")) {
      setEmailAvailable(null);
      return;
    }

    // Limpiar timeout anterior
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout);
    }

    // Establecer nuevo timeout
    const timeout = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const res = await fetch(
          `/api/auth/check-email?email=${encodeURIComponent(data.email)}`
        );
        const result = await res.json();
        setEmailAvailable(!result.exists);
      } catch (error) {
        console.error("Error checking email:", error);
        setEmailAvailable(null);
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    setEmailCheckTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.email]);

  const handleChange = (field: keyof Props["data"]) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const isFormValid = 
    data.firstName.trim().length >= 2 &&
    data.lastName.trim().length >= 2 &&
    data.email.includes("@") &&
    emailAvailable === true;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
          Nombre(s) <span className="text-red-500">*</span>
        </label>
        <input
          id="firstName"
          type="text"
          value={data.firstName}
          onChange={handleChange("firstName")}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Rogelio"
          autoComplete="given-name"
          required
        />
      </div>

      {/* Apellido Paterno */}
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
          Apellido Paterno <span className="text-red-500">*</span>
        </label>
        <input
          id="lastName"
          type="text"
          value={data.lastName}
          onChange={handleChange("lastName")}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Garza"
          autoComplete="family-name"
          required
        />
      </div>

      {/* Apellido Materno */}
      <div>
        <label htmlFor="maternalSurname" className="block text-sm font-medium text-gray-700 mb-2">
          Apellido Materno <span className="text-xs text-gray-400">(opcional)</span>
        </label>
        <input
          id="maternalSurname"
          type="text"
          value={data.maternalSurname}
          onChange={handleChange("maternalSurname")}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Hernández"
          autoComplete="additional-name"
        />
      </div>

      {/* Email con validación */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Correo electrónico <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="email"
            type="email"
            value={data.email}
            onChange={handleChange("email")}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
          
          {/* Indicador de validación */}
          <div className="absolute inset-y-0 right-3 flex items-center">
            {emailChecking && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
            {!emailChecking && emailAvailable === true && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
            {!emailChecking && emailAvailable === false && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Mensaje de disponibilidad */}
        {emailAvailable === false && (
          <p className="mt-1 text-xs text-red-600">
            Este email ya está registrado.{" "}
            <a href="/auth/signin" className="underline hover:text-red-700">
              Iniciar sesión
            </a>
          </p>
        )}
        {emailAvailable === true && (
          <p className="mt-1 text-xs text-emerald-600">
            ✓ Email disponible
          </p>
        )}
      </div>

      {/* Botón Continuar */}
      <button
        type="submit"
        disabled={!isFormValid}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600"
      >
        Continuar →
      </button>
    </form>
  );
}