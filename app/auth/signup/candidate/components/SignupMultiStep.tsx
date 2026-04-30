// app/auth/signup/candidate/components/SignupMultiStep.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Loader2, Sparkles } from "lucide-react";
import {
  SignupStep1Schema,
  SignupStep2Schema,
  SignupStep3Schema,
  type SignupStep1Data,
  type SignupStep2Data,
  type SignupStep3Data,
} from "@/lib/validation";
import { createCandidateImproved } from "../actions";
import { toastSuccess, toastError } from "@/lib/ui/toast";

import ProgressBar from "./ProgressBar";
import Step1Basic from "./Step1Basic";
import Step2Security from "./Step2Security";
import Step3Professional from "./Step3Professional";

// ============================================
// TIPOS
// ============================================

type Step = 1 | 2 | 3;

interface FormData {
  firstName: string;
  lastName: string;
  maternalSurname: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  location: string;
  locationLat?: number;
  locationLng?: number;
  placeId?: string;
  city?: string;
  admin1?: string;
  country?: string;
  cityNorm?: string;
  admin1Norm?: string;
  linkedin: string;
  github: string;
}

interface Props {
  fromCvBuilder?: boolean;
  prefillData?: Partial<FormData>;
  cvDraft?: any;
}

// ============================================
// GOOGLE ICON SVG
// ============================================

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function SignupMultiStep({
  fromCvBuilder = false,
  prefillData = {},
  cvDraft,
}: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    firstName: prefillData?.firstName || "",
    lastName: prefillData?.lastName || "",
    maternalSurname: prefillData?.maternalSurname || "",
    email: prefillData?.email || "",
    password: "",
    confirmPassword: "",
    phone: prefillData?.phone || "",
    location: prefillData?.location || "",
    locationLat: prefillData?.locationLat,
    locationLng: prefillData?.locationLng,
    placeId: prefillData?.placeId,
    city: prefillData?.city,
    admin1: prefillData?.admin1,
    country: prefillData?.country,
    cityNorm: prefillData?.cityNorm,
    admin1Norm: prefillData?.admin1Norm,
    linkedin: prefillData?.linkedin || "",
    github: prefillData?.github || "",
  });

  const updateForm = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Google OAuth ──────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/profile/summary" });
  };

  // ── Navegación entre pasos ────────────────────────────────
  const goToNextStep = async () => {
    try {
      if (currentStep === 1) {
        const data: SignupStep1Data = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          maternalSurname: formData.maternalSurname,
          email: formData.email,
        };
        SignupStep1Schema.parse(data);
      } else if (currentStep === 2) {
        const data: SignupStep2Data = {
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        };
        SignupStep2Schema.parse(data);
      }
      setCurrentStep((prev) => Math.min(prev + 1, 3) as Step);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toastError(err.errors[0]?.message || "Verifica los datos");
      }
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as Step);
  };

  // ── Submit final ──────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const step3Data: SignupStep3Data = {
        phone: formData.phone,
        location: formData.location,
        locationLat: formData.locationLat,
        locationLng: formData.locationLng,
        placeId: formData.placeId,
        linkedin: formData.linkedin,
        github: formData.github,
      };
      SignupStep3Schema.parse(step3Data);

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        maternalSurname: formData.maternalSurname || undefined,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        location: formData.location || undefined,
        locationLat: formData.locationLat,
        locationLng: formData.locationLng,
        placeId: formData.placeId,
        city: formData.city,
        admin1: formData.admin1,
        country: formData.country,
        cityNorm: formData.cityNorm,
        admin1Norm: formData.admin1Norm,
        linkedin: formData.linkedin || undefined,
        github: formData.github || undefined,
        role: "CANDIDATE" as const,
      };

      const result = await createCandidateImproved(payload, cvDraft);

      if (!result?.ok) {
        toastError(result?.error || "Error al crear la cuenta");
        return;
      }

      toastSuccess(
        fromCvBuilder
          ? "Cuenta creada. Revisa tu correo para confirmar y guardar tu CV."
          : "Cuenta creada. Revisa tu correo para confirmar tu cuenta."
      );

      if (fromCvBuilder && typeof window !== "undefined") {
        try { window.localStorage.removeItem("cv_builder_draft_v1"); } catch {}
      }

      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem("verification_email", formData.email); } catch {}
      }

      router.push(
        `/auth/verify/check-email?email=${encodeURIComponent(formData.email)}&role=CANDIDATE`
      );
    } catch (err) {
      if (err instanceof z.ZodError) {
        toastError(err.errors[0]?.message || "Datos inválidos");
      } else {
        toastError("Error al crear la cuenta");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-0">
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm shadow-xl shadow-zinc-900/5 dark:shadow-zinc-900/30 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center border-b border-zinc-100 dark:border-zinc-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {fromCvBuilder ? "Guarda tu CV gratis" : "Crea tu cuenta"}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {fromCvBuilder
              ? "Registra tu cuenta para guardar y compartir tu CV"
              : "Encuentra tu próximo reto profesional en TI"}
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* ── Botón Google — solo en paso 1 ── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-800 dark:text-zinc-100 transition-all hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    <span>Conectando con Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continuar con Google</span>
                  </>
                )}
              </button>

              {/* Divisor */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 dark:text-zinc-500 font-medium">
                    o regístrate con tu correo
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <ProgressBar currentStep={currentStep} totalSteps={3} />

          {/* Steps */}
          <div>
            {currentStep === 1 && (
              <Step1Basic
                data={{
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  maternalSurname: formData.maternalSurname,
                  email: formData.email,
                }}
                onChange={updateForm}
                onNext={goToNextStep}
              />
            )}

            {currentStep === 2 && (
              <Step2Security
                data={{
                  password: formData.password,
                  confirmPassword: formData.confirmPassword,
                }}
                onChange={updateForm}
                onNext={goToNextStep}
                onBack={goToPreviousStep}
              />
            )}

            {currentStep === 3 && (
              <Step3Professional
                data={{
                  phone: formData.phone,
                  location: formData.location,
                  linkedin: formData.linkedin,
                  github: formData.github,
                }}
                onChange={updateForm}
                onSubmit={handleSubmit}
                onBack={goToPreviousStep}
                isSubmitting={isSubmitting}
                fromCvBuilder={fromCvBuilder}
              />
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            Al crear tu cuenta aceptas nuestros{" "}
            <a href="/terms" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              Términos
            </a>{" "}
            y{" "}
            <a href="/privacy" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              Privacidad
            </a>
            . Sin spam.
          </p>

          {/* Link a login */}
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            ¿Ya tienes cuenta?{" "}
            <a
              href="/auth/signin?role=CANDIDATE"
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Inicia sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}