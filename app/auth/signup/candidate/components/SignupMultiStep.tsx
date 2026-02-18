// app/auth/signup/candidate/components/SignupMultiStep.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
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
  // Paso 1
  firstName: string;
  lastName: string;
  maternalSurname: string;
  email: string;
  
  // Paso 2
  password: string;
  confirmPassword: string;
  
  // Paso 3
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
  /** Si viene del CV Builder, trae datos pre-llenados */
  fromCvBuilder?: boolean;
  prefillData?: Partial<FormData>;
  cvDraft?: any;
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

  // Estado del formulario
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
    // ✅ Campos de ubicación desglosada
    city: prefillData?.city,
    admin1: prefillData?.admin1,
    country: prefillData?.country,
    cityNorm: prefillData?.cityNorm,
    admin1Norm: prefillData?.admin1Norm,
    linkedin: prefillData?.linkedin || "",
    github: prefillData?.github || "",
  });

  // ============================================
  // ACTUALIZAR FORMULARIO
  // ============================================

  const updateForm = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // ============================================
  // NAVEGACIÓN ENTRE PASOS
  // ============================================

  const goToNextStep = async () => {
    try {
      // Validar paso actual antes de avanzar
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

      // Avanzar al siguiente paso
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

  // ============================================
  // SUBMIT FINAL
  // ============================================

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validar paso 3
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

      // Preparar datos para el backend
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

      // Llamar a la acción del servidor
      const result = await createCandidateImproved(payload, cvDraft);

      if (!result?.ok) {
        toastError(result?.error || "Error al crear la cuenta");
        return;
      }

      // Éxito
      toastSuccess(
        fromCvBuilder
          ? "Cuenta creada. Revisa tu correo para confirmar y guardar tu CV."
          : "Cuenta creada. Revisa tu correo para confirmar tu cuenta."
      );

      // Limpiar draft del CV si existe
      if (fromCvBuilder && typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("cv_builder_draft_v1");
        } catch {}
      }

      // ✅ Guardar email en sessionStorage como fallback
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("verification_email", formData.email);
        } catch {}
      }

      // ✅ Redirigir con email en query params
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

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border glass-card p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">Registro de Candidato</h1>
        {fromCvBuilder ? (
          <p className="mt-2 text-xs text-zinc-500">
            Usaremos estos datos para crear tu cuenta y guardar tu CV
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Crea tu cuenta en 3 pasos rápidos
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <ProgressBar currentStep={currentStep} totalSteps={3} />

      {/* Steps */}
      <div className="mt-6">
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
      <p className="mt-4 text-center text-[11px] text-zinc-400">
        Al crear tu cuenta aceptas recibir notificaciones sobre tus
        postulaciones. Nada de spam.
      </p>
    </div>
  );
}