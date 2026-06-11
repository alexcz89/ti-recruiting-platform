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

// ✅ Helper para validar que el email sigue siendo disponible en submit
async function validateEmailAvailability(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) return false;
  try {
    const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
    const result = await res.json();
    return result.available === true; // Explícitamente true
  } catch {
    return false;
  }
}

// Clases reutilizables para consistencia y dark mode
const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors";

const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1";

export default function Step1Basic({ data, onChange, onNext }: Props) {
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // ✅ Verificar disponibilidad del email con debounce y AbortController
  // para cancelar requests antiguas
  useEffect(() => {
    if (!data.email || !data.email.includes("@")) {
      setEmailAvailable(null);
      return;
    }

    if (emailCheckTimeout) clearTimeout(emailCheckTimeout);

    // Crear AbortController para esta request
    const abortController = new AbortController();

    const timeout = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const res = await fetch(
          `/api/auth/check-email?email=${encodeURIComponent(data.email)}`,
          { signal: abortController.signal }
        );
        const result = await res.json();
        setEmailAvailable(result.available === true);
      } catch (error) {
        // Si es AbortError, significa que fue cancelado por un request más nuevo
        if (error instanceof Error && error.name === "AbortError") {
          console.debug("Email check cancelled (newer request)");
          return;
        }
        console.error("Error checking email:", error);
        setEmailAvailable(null);
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    setEmailCheckTimeout(timeout);

    // Cleanup: cancelar request si el componente se desmonta o el email cambia
    return () => {
      if (timeout) clearTimeout(timeout);
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.email]);

  const handleChange =
    (field: keyof Props["data"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: e.target.value });
    };

  // ✅ Double-submit prevention: re-validar email en el submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que el email sigue siendo disponible (previene race condition)
    const isStillAvailable = await validateEmailAvailability(data.email);
    if (!isStillAvailable) {
      setEmailAvailable(false);
      // No continuamos al siguiente paso si el email ya no está disponible
      return;
    }

    onNext();
  };

  const isFormValid =
    data.firstName.trim().length >= 2 &&
    data.lastName.trim().length >= 2 &&
    data.email.includes("@") &&
    emailAvailable === true;

  return (
    // ✅ Mobile-optimized form spacing
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-3">

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
          maxLength={50}
          className={inputClass}
          placeholder="Tu nombre"
          autoComplete="given-name"
          required
        />
      </div>

      {/* Apellidos en grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label htmlFor="lastName" className={labelClass}>
            Ap. Paterno <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            value={data.lastName}
            onChange={handleChange("lastName")}
            maxLength={50}
            className={inputClass}
            placeholder="Ap. paterno"
            autoComplete="family-name"
            required
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="maternalSurname" className={labelClass}>
            Ap. Materno <span className="text-xs text-zinc-400 dark:text-zinc-500">(opc.)</span>
          </label>
          <input
            id="maternalSurname"
            type="text"
            value={data.maternalSurname}
            onChange={handleChange("maternalSurname")}
            maxLength={50}
            className={inputClass}
            placeholder="Ap. materno"
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

        {/* Mensajes de validación - mobile optimized */}
        {emailAvailable === false && (
          <div className="mt-2 sm:mt-1 p-2 sm:p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
              Este email ya está registrado.{" "}
              <a
                href="/auth/signin"
                className="underline hover:text-red-600 dark:hover:text-red-200 transition-colors"
              >
                Iniciar sesión
              </a>
            </p>
          </div>
        )}
        {emailAvailable === true && (
          <div className="mt-2 sm:mt-1 p-2 sm:p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              ✓ Email disponible
            </p>
          </div>
        )}
      </div>

      {/* ✅ Mobile-optimized submit button */}
      <button
        type="submit"
        disabled={!isFormValid}
        className="
          w-full rounded-lg px-4 py-3 sm:py-2.5 text-sm font-semibold
          bg-emerald-600 hover:bg-emerald-700
          dark:bg-emerald-500 dark:hover:bg-emerald-400
          text-white dark:text-zinc-900
          transition-colors
          disabled:cursor-not-allowed disabled:opacity-50
          disabled:hover:bg-emerald-600 dark:disabled:hover:bg-emerald-500
          min-h-[44px] sm:min-h-auto
        "
      >
        Continuar →
      </button>
    </form>
  );
}