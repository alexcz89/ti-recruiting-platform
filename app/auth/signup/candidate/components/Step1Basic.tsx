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

// Clases reutilizables para consistencia y dark mode
const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors";

const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

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

    if (emailCheckTimeout) clearTimeout(emailCheckTimeout);

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

    return () => { if (timeout) clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.email]);

  const handleChange =
    (field: keyof Props["data"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Nombre */}
      <div>
        <label htmlFor="firstName" className={labelClass}>
          Nombre(s) <span className="text-red-500">*</span>
        </label>
        <input
          id="firstName"
          type="text"
          value={data.firstName}
          onChange={handleChange("firstName")}
          className={inputClass}
          placeholder="Rogelio"
          autoComplete="given-name"
          required
        />
      </div>

      {/* Apellidos en grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Ap. Paterno <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            value={data.lastName}
            onChange={handleChange("lastName")}
            className={inputClass}
            placeholder="Garza"
            autoComplete="family-name"
            required
          />
        </div>
        <div>
          <label htmlFor="maternalSurname" className={labelClass}>
            Ap. Materno{" "}
            <span className="text-xs text-zinc-400 dark:text-zinc-500">(opc.)</span>
          </label>
          <input
            id="maternalSurname"
            type="text"
            value={data.maternalSurname}
            onChange={handleChange("maternalSurname")}
            className={inputClass}
            placeholder="Hernández"
            autoComplete="additional-name"
          />
        </div>
      </div>

      {/* Email con validación */}
      <div>
        <label htmlFor="email" className={labelClass}>
          Correo electrónico <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="email"
            type="email"
            value={data.email}
            onChange={handleChange("email")}
            className={`${inputClass} pr-10`}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />

          {/* Indicador de validación */}
          <div className="absolute inset-y-0 right-3 flex items-center">
            {emailChecking && (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            )}
            {!emailChecking && emailAvailable === true && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
            {!emailChecking && emailAvailable === false && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Mensajes de validación */}
        {emailAvailable === false && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">
            Este email ya está registrado.{" "}
            <a
              href="/auth/signin"
              className="underline hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              Iniciar sesión
            </a>
          </p>
        )}
        {emailAvailable === true && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            ✓ Email disponible
          </p>
        )}
      </div>

      {/* Botón Continuar — contraste corregido en dark mode */}
      <button
        type="submit"
        disabled={!isFormValid}
        className="
          w-full rounded-lg px-4 py-3 text-sm font-semibold
          bg-emerald-600 hover:bg-emerald-700
          dark:bg-emerald-500 dark:hover:bg-emerald-400
          text-white dark:text-zinc-900
          transition-colors
          disabled:cursor-not-allowed disabled:opacity-50
          disabled:hover:bg-emerald-600 dark:disabled:hover:bg-emerald-500
        "
      >
        Continuar →
      </button>
    </form>
  );
}