// app/auth/signup/recruiter/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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
type EmailValidationState = "idle" | "checking" | "available" | "taken" | "invalid";

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
  
  // ✅ NUEVO: Estado para mostrar/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // ✅ NUEVO: Estado para validación de email en tiempo real
  const [emailValidation, setEmailValidation] = useState<EmailValidationState>("idle");
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    
    // Limpiar error del campo al escribir
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    // ✅ NUEVO: Trigger validación de email al escribir
    if (name === "email") {
      setEmailValidation("idle");
      
      // Limpiar timeout anterior
      if (emailCheckTimeout) {
        clearTimeout(emailCheckTimeout);
      }

      // Validación básica de formato antes de hacer request
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        if (value.length > 0) {
          setEmailValidation("invalid");
        }
        return;
      }

      // Debounce: esperar 800ms después de que el usuario deje de escribir
      const timeout = setTimeout(() => {
        checkEmailAvailability(value);
      }, 800);
      
      setEmailCheckTimeout(timeout);
    }
  };

  // ✅ NUEVO: Función para verificar disponibilidad del email
  const checkEmailAvailability = async (email: string) => {
    if (!email) return;

    setEmailValidation("checking");

    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.exists) {
        setEmailValidation("taken");
        setErrors(prev => ({ ...prev, email: "Este correo ya está registrado" }));
      } else {
        setEmailValidation("available");
      }
    } catch (error) {
      console.error("Error checking email:", error);
      setEmailValidation("idle");
    }
  };

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (emailCheckTimeout) {
        clearTimeout(emailCheckTimeout);
      }
    };
  }, [emailCheckTimeout]);

  // Validar paso actual antes de avanzar
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.companyName.trim()) {
        newErrors.companyName = "El nombre de la empresa es requerido";
      }
      if (!form.size) {
        newErrors.size = "Selecciona el tamaño de la empresa";
      }
    }

    if (step === 2) {
      if (!form.firstName.trim()) {
        newErrors.firstName = "El nombre es requerido";
      }
      if (!form.lastName.trim()) {
        newErrors.lastName = "El apellido es requerido";
      }
      if (!form.email.trim()) {
        newErrors.email = "El correo es requerido";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = "Correo inválido";
      } else if (emailValidation === "taken") {
        newErrors.email = "Este correo ya está registrado";
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
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "Las contraseñas no coinciden";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(3, prev + 1) as Step);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
  };

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

  const progress = (currentStep / 3) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header con logo y título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Registro de Reclutador
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Paso {currentStep} de 3
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <StepIndicator step={1} currentStep={currentStep} label="Empresa" />
            <StepIndicator step={2} currentStep={currentStep} label="Datos personales" />
            <StepIndicator step={3} currentStep={currentStep} label="Seguridad" />
          </div>
          <div className="h-2 bg-zinc-200 rounded-full overflow-hidden dark:bg-zinc-800">
            <div
              className="h-full bg-violet-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card del formulario */}
        <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-6 md:p-8">
          {/* Paso 1: Datos de la empresa */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
                  <svg className="w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Cuéntanos sobre tu empresa
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Información básica de la organización
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                  Nombre de la empresa *
                </label>
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder="Ej. Tech Solutions SA"
                  className={`w-full rounded-xl border px-4 py-3 text-sm transition-colors ${
                    errors.companyName
                      ? "border-red-300 focus:ring-red-500"
                      : "border-zinc-300 focus:ring-violet-500"
                  } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                />
                {errors.companyName && (
                  <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                  Tamaño de la empresa *
                </label>
                <select
                  name="size"
                  value={form.size}
                  onChange={onChange}
                  className={`w-full rounded-xl border px-4 py-3 text-sm transition-colors ${
                    errors.size
                      ? "border-red-300 focus:ring-red-500"
                      : "border-zinc-300 focus:ring-violet-500"
                  } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                >
                  <option value="">Selecciona...</option>
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

          {/* Paso 2: Datos personales */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
                  <svg className="w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Tus datos personales
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Usa un correo corporativo (no Gmail/Hotmail)
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                    Nombre(s) *
                  </label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={onChange}
                    placeholder="Gabriel"
                    className={`w-full rounded-xl border px-4 py-3 text-sm transition-colors ${
                      errors.firstName
                        ? "border-red-300 focus:ring-red-500"
                        : "border-zinc-300 focus:ring-violet-500"
                    } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                    Apellido(s) *
                  </label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={onChange}
                    placeholder="Ramirez"
                    className={`w-full rounded-xl border px-4 py-3 text-sm transition-colors ${
                      errors.lastName
                        ? "border-red-300 focus:ring-red-500"
                        : "border-zinc-300 focus:ring-violet-500"
                    } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* ✅ NUEVO: Campo de email con validación en tiempo real */}
              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                  Correo corporativo *
                </label>
                <div className="relative">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="tu@empresa.com"
                    className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm transition-colors ${
                      errors.email || emailValidation === "taken"
                        ? "border-red-300 focus:ring-red-500"
                        : emailValidation === "available"
                        ? "border-emerald-300 focus:ring-emerald-500"
                        : "border-zinc-300 focus:ring-violet-500"
                    } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                  />
                  
                  {/* Indicador de estado en el input */}
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
                    {emailValidation === "taken" && (
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Mensajes de estado */}
                {emailValidation === "checking" && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Verificando disponibilidad...
                  </p>
                )}
                {emailValidation === "available" && !errors.email && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Email disponible
                  </p>
                )}
                {emailValidation === "taken" && (
                  <p className="mt-1 text-xs text-red-500">
                    Este correo ya está registrado. <a href="/auth/signin?role=RECRUITER" className="underline">Inicia sesión</a>
                  </p>
                )}
                {emailValidation === "invalid" && (
                  <p className="mt-1 text-xs text-red-500">
                    Formato de correo inválido
                  </p>
                )}
                {errors.email && emailValidation !== "taken" && (
                  <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                )}
                
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  ⚠️ No aceptamos dominios gratuitos (Gmail, Hotmail, Yahoo, etc.)
                </p>
              </div>
            </div>
          )}

          {/* Paso 3: Seguridad */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
                  <svg className="w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Crea tu contraseña
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Asegura tu cuenta con una contraseña fuerte
                </p>
              </div>

              {/* ✅ NUEVO: Campo de contraseña con toggle */}
              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    placeholder="••••••••"
                    className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm transition-colors ${
                      errors.password
                        ? "border-red-300 focus:ring-red-500"
                        : "border-zinc-300 focus:ring-violet-500"
                    } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                  />
                  
                  {/* Botón toggle mostrar/ocultar */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
                <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                  <li className={form.password.length >= 8 ? "text-emerald-600" : ""}>
                    {form.password.length >= 8 ? "✓" : "○"} Mínimo 8 caracteres
                  </li>
                  <li className={/[A-Z]/.test(form.password) ? "text-emerald-600" : ""}>
                    {/[A-Z]/.test(form.password) ? "✓" : "○"} Una mayúscula
                  </li>
                  <li className={/[a-z]/.test(form.password) ? "text-emerald-600" : ""}>
                    {/[a-z]/.test(form.password) ? "✓" : "○"} Una minúscula
                  </li>
                  <li className={/\d/.test(form.password) ? "text-emerald-600" : ""}>
                    {/\d/.test(form.password) ? "✓" : "○"} Un número
                  </li>
                </ul>
              </div>

              {/* ✅ NUEVO: Campo de confirmar contraseña con toggle */}
              <div>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
                  Confirmar contraseña *
                </label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={onChange}
                    placeholder="••••••••"
                    className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm transition-colors ${
                      errors.confirmPassword
                        ? "border-red-300 focus:ring-red-500"
                        : form.confirmPassword && form.password === form.confirmPassword
                        ? "border-emerald-300 focus:ring-emerald-500"
                        : "border-zinc-300 focus:ring-violet-500"
                    } focus:ring-2 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900/50`}
                  />
                  
                  {/* Botón toggle mostrar/ocultar */}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
                {form.confirmPassword && form.password === form.confirmPassword && !errors.confirmPassword && (
                  <p className="mt-1 text-xs text-emerald-600">
                    ✓ Las contraseñas coinciden
                  </p>
                )}
              </div>

              {/* Resumen de datos */}
              <div className="mt-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Resumen de tu registro:
                </p>
                <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <li>🏢 {form.companyName} ({form.size} empleados)</li>
                  <li>👤 {form.firstName} {form.lastName}</li>
                  <li>📧 {form.email}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Botones de navegación */}
          <div className="mt-8 flex items-center justify-between gap-4">
            {currentStep > 1 ? (
              <button
                onClick={handleBack}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
            ) : (
              <div />
            )}

            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={currentStep === 2 && emailValidation === "checking"}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors shadow-sm ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
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

        {/* Link para login */}
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
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

// Componente de indicador de paso
function StepIndicator({
  step,
  currentStep,
  label,
}: {
  step: Step;
  currentStep: Step;
  label: string;
}) {
  const isActive = step === currentStep;
  const isCompleted = step < currentStep;

  return (
    <div className="flex flex-col items-center flex-1">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
          ${
            isCompleted
              ? "bg-emerald-600 text-white"
              : isActive
              ? "bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900/30"
              : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
          }
        `}
      >
        {isCompleted ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          step
        )}
      </div>
      <span
        className={`
          mt-2 text-xs font-medium transition-colors
          ${
            isActive
              ? "text-violet-600 dark:text-violet-400"
              : "text-zinc-500 dark:text-zinc-500"
          }
        `}
      >
        {label}
      </span>
    </div>
  );
}