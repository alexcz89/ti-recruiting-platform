// app/auth/signup/recruiter/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import { z } from "zod";
import {
  RecruiterSimpleSignupSchema,
  type RecruiterSimpleSignupInput,
} from "@/lib/shared/validation/recruiter/simple";
import { createRecruiterAction } from "./actions";

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

type Step = 1 | 2 | 3;
type EmailValidationState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid"
  | "freedomain";

export default function RecruiterSignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RecruiterSimpleSignupInput>({
    companyName: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    size: "1-10",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValidation, setEmailValidation] =
    useState<EmailValidationState>("idle");
  const [emailCheckTimeout, setEmailCheckTimeout] =
    useState<NodeJS.Timeout | null>(null);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    if (name === "email") {
      setEmailValidation("idle");
      if (emailCheckTimeout) clearTimeout(emailCheckTimeout);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        if (value.length > 0) setEmailValidation("invalid");
        return;
      }

      const timeout = setTimeout(() => {
        checkEmailAvailability(value);
      }, 800);
      setEmailCheckTimeout(timeout);
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (!email) return;

    const freeDomains = [
      "gmail.com","hotmail.com","yahoo.com","outlook.com",
      "live.com","icloud.com","msn.com","hotmail.es","yahoo.es",
      "gmail.es","yahoo.com.mx","hotmail.com.mx",
    ];
    const domain = email.split("@")[1]?.toLowerCase();
    if (freeDomains.includes(domain)) {
      setEmailValidation("freedomain");
      return;
    }

    setEmailValidation("checking");
    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setEmailValidation(data.exists ? "taken" : "available");
    } catch {
      setEmailValidation("idle");
    }
  };

  useEffect(() => {
    return () => {
      if (emailCheckTimeout) clearTimeout(emailCheckTimeout);
    };
  }, [emailCheckTimeout]);

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.companyName.trim())
        newErrors.companyName = "El nombre de la empresa es requerido";
      if (!form.size) newErrors.size = "Selecciona el tamaño de la empresa";
    }

    if (step === 2) {
      if (!form.firstName.trim()) newErrors.firstName = "El nombre es requerido";
      if (!form.lastName.trim()) newErrors.lastName = "El apellido es requerido";
      if (!form.email.trim()) {
        newErrors.email = "El correo es requerido";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = "Correo inválido";
      } else if (
        emailValidation === "taken" ||
        emailValidation === "freedomain"
      ) {
        newErrors.email = "Correo no válido";
      }
    }

    if (step === 3) {
      if (!form.password) {
        newErrors.password = "La contraseña es requerida";
      } else if (form.password.length < 8) {
        newErrors.password = "Mínimo 8 caracteres";
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
        newErrors.password = "Debe contener mayúscula, minúscula y número";
      }
      if (form.password !== form.confirmPassword)
        newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep))
      setCurrentStep((prev) => Math.min(3, prev + 1) as Step);
  };

  const handleBack = () =>
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    try {
      const parsed = RecruiterSimpleSignupSchema.parse(form);
      setLoading(true);
      const res = await createRecruiterAction(parsed);
      if (res.ok) {
        toastSuccess("Cuenta creada. Revisa tu correo para verificarla.");
        router.push("/auth/signin?role=RECRUITER&verified=pending");
      } else {
        toastError(res.message || "Error al crear la cuenta");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toastError(err.errors?.[0]?.message || "Datos inválidos");
      } else {
        toastError("Error al crear la cuenta");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Inputs base className ─────────────────────────────────────────
  const inputBase = (hasError: boolean, isValid = false) =>
    `w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:ring-2 focus:border-transparent dark:bg-zinc-900/50 ${
      hasError
        ? "border-red-300 focus:ring-red-400"
        : isValid
        ? "border-emerald-300 focus:ring-emerald-400"
        : "border-zinc-300 dark:border-zinc-700 focus:ring-violet-500"
    }`;

  const passwordStrong =
    form.password.length >= 8 &&
    /[A-Z]/.test(form.password) &&
    /[a-z]/.test(form.password) &&
    /\d/.test(form.password);

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-4 sm:items-center sm:py-8">
      <div className="w-full max-w-lg">

        {/* ── Cabecera ───────────────────────────────────── */}
        <div className="mb-3 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            Registro de Reclutador
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Paso {currentStep} de 3
          </p>
        </div>

        {/* ── Stepper ────────────────────────────────────── */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            {(["Empresa", "Datos personales", "Seguridad"] as const).map(
              (label, i) => {
                const step = (i + 1) as Step;
                const isActive = step === currentStep;
                const isCompleted = step < currentStep;
                return (
                  <div key={step} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                        isCompleted
                          ? "bg-emerald-600 text-white"
                          : isActive
                          ? "bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900/30"
                          : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              }
            )}
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Card del paso ─────────────────────────────── */}
        <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-4 md:p-6">

          {/* Paso 1 — Empresa */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <StepHeader
                icon={
                  <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                title="Cuéntanos sobre tu empresa"
                subtitle="Información básica de la organización"
              />

              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Nombre de la empresa <span className="text-red-500">*</span>
                </label>
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder="Ej. Tech Solutions SA"
                  autoComplete="organization"
                  className={inputBase(!!errors.companyName)}
                />
                {errors.companyName && (
                  <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Tamaño de la empresa <span className="text-red-500">*</span>
                </label>
                <select
                  name="size"
                  value={form.size}
                  onChange={onChange}
                  className={inputBase(!!errors.size)}
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} empleados
                    </option>
                  ))}
                </select>
                {errors.size && (
                  <p className="mt-1 text-xs text-red-500">{errors.size}</p>
                )}
              </div>
            </div>
          )}

          {/* Paso 2 — Datos personales */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <StepHeader
                icon={
                  <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
                title="Tus datos personales"
                subtitle="Usa un correo corporativo (no Gmail/Hotmail)"
              />

              {/* Nombre y apellido en grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Nombre(s) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={onChange}
                    placeholder="Gabriel"
                    autoComplete="given-name"
                    className={inputBase(!!errors.firstName)}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Apellido(s) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={onChange}
                    placeholder="Ramírez"
                    autoComplete="family-name"
                    className={inputBase(!!errors.lastName)}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email corporativo */}
              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Correo corporativo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="tu@empresa.com"
                    autoComplete="email"
                    className={inputBase(
                      !!errors.email || emailValidation === "taken" || emailValidation === "freedomain",
                      emailValidation === "available"
                    ) + " pr-10"}
                  />
                  {/* Icono de estado */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailValidation === "checking" && (
                      <svg className="w-5 h-5 text-zinc-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    {emailValidation === "available" && (
                      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {(emailValidation === "taken" || emailValidation === "freedomain") && (
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Mensajes de estado — solo uno a la vez */}
                {emailValidation === "checking" && (
                  <p className="mt-1 text-xs text-zinc-500">Verificando disponibilidad...</p>
                )}
                {emailValidation === "available" && (
                  <p className="mt-1 text-xs text-emerald-600">✓ Email disponible</p>
                )}
                {emailValidation === "freedomain" && (
                  <p className="mt-1 text-xs text-red-500">
                    No aceptamos dominios gratuitos (Gmail, Hotmail, Yahoo, etc.)
                  </p>
                )}
                {emailValidation === "taken" && (
                  <p className="mt-1 text-xs text-red-500">
                    Este correo ya está registrado.{" "}
                    <a href="/auth/signin?role=RECRUITER" className="underline font-medium">
                      Inicia sesión
                    </a>
                  </p>
                )}
                {emailValidation === "invalid" && (
                  <p className="mt-1 text-xs text-red-500">Formato de correo inválido</p>
                )}
                {errors.email &&
                  emailValidation !== "taken" &&
                  emailValidation !== "freedomain" &&
                  emailValidation !== "invalid" && (
                    <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                  )}

                {/* Aviso corporativo — solo si no hay error activo */}
                {emailValidation === "idle" && !errors.email && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    ⚠️ No aceptamos dominios gratuitos (Gmail, Hotmail, Yahoo, etc.)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Paso 3 — Seguridad */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <StepHeader
                icon={
                  <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
                title="Crea tu contraseña"
                subtitle="Asegura tu cuenta con una contraseña fuerte"
              />

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputBase(!!errors.password) + " pr-12"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password}</p>
                )}
                {/* Requisitos compactos */}
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {[
                    { ok: form.password.length >= 8, label: "8 caracteres" },
                    { ok: /[A-Z]/.test(form.password), label: "Una mayúscula" },
                    { ok: /[a-z]/.test(form.password), label: "Una minúscula" },
                    { ok: /\d/.test(form.password), label: "Un número" },
                  ].map(({ ok, label }) => (
                    <p
                      key={label}
                      className={`text-xs flex items-center gap-1 ${ok ? "text-emerald-600" : "text-zinc-400"}`}
                    >
                      {ok ? "✓" : "○"} {label}
                    </p>
                  ))}
                </div>
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Confirmar contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={onChange}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputBase(
                      !!errors.confirmPassword,
                      !!(form.confirmPassword && form.password === form.confirmPassword)
                    ) + " pr-12"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    aria-label={showConfirmPassword ? "Ocultar" : "Mostrar"}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
                )}
                {form.confirmPassword &&
                  form.password === form.confirmPassword &&
                  !errors.confirmPassword && (
                    <p className="mt-1 text-xs text-emerald-600">✓ Las contraseñas coinciden</p>
                  )}
              </div>

              {/* Resumen compacto */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 p-2.5">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Resumen de tu registro
                </p>
                <div className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <p>🏢 {form.companyName} · {form.size} empleados</p>
                  <p>👤 {form.firstName} {form.lastName}</p>
                  <p>📧 {form.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Navegación sticky ─────────────────────── */}
          <div className="sticky bottom-0 sm:static bg-white/95 sm:bg-transparent dark:bg-zinc-900/95 sm:dark:bg-transparent backdrop-blur-sm sm:backdrop-blur-none mt-4 pt-3 pb-1 sm:pb-0 border-t border-zinc-100 dark:border-zinc-800 sm:border-t-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:shadow-none">
            <div className="flex items-center justify-between gap-3">
              {currentStep > 1 ? (
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Atrás
                </button>
              ) : (
                <div />
              )}

              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={currentStep === 2 && emailValidation === "checking"}
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !passwordStrong || form.password !== form.confirmPassword}
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      Crear cuenta
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">
          ¿Ya tienes cuenta?{" "}
          <a
            href="/auth/signin?role=RECRUITER"
            className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}

// ── Componente reutilizable de cabecera de paso ─────────────────────
function StepHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3">
      {/* Icono visible solo en mobile — en desktop el stepper da el contexto */}
      <div className="flex flex-col items-center text-center mb-2 sm:hidden">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-1.5">
          {icon}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      {/* Titulo siempre visible */}
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 text-center sm:text-left">
        {title}
      </h2>
    </div>
  );
}