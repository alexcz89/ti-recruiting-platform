// app/auth/signup/candidate/CandidateSignupClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SignupMultiStep from "./components/SignupMultiStep";

// ⚠️ Debe coincidir con el de CvBuilder.tsx
const LS_KEY = "cv_builder_draft_v1";

// ✅ Para regresar al flujo correcto después de registrarse (vacante, etc.)
const AUTH_CALLBACK_KEY = "auth_callback_url_v1";
const AUTH_APPLY_JOB_KEY = "auth_apply_job_id_v1";

type DraftData = {
  identity?: {
    firstName?: string;
    lastName1?: string;
    lastName2?: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  experiences?: any[];
  education?: any[];
  skills?: any[];
  languages?: any[];
};

export default function CandidateSignupClient() {
  const searchParams = useSearchParams();

  const fromCvBuilder = searchParams?.get("from") === "cv-builder";

  // ✅ Soportar flujos desde vacante/login
  const callbackUrl = searchParams?.get("callbackUrl") || "";
  const applyJobId =
    searchParams?.get("applyJobId") ||
    searchParams?.get("jobId") ||
    "";

  const [prefillData, setPrefillData] = useState<any>(null);
  const [cvDraft, setCvDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(fromCvBuilder);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ✅ Persistir callbackUrl/jobId para que el signup pueda redirigir al finalizar
    try {
      if (callbackUrl) window.localStorage.setItem(AUTH_CALLBACK_KEY, callbackUrl);
      if (applyJobId) window.localStorage.setItem(AUTH_APPLY_JOB_KEY, applyJobId);
    } catch {
      // ignore
    }
  }, [callbackUrl, applyJobId]);

  useEffect(() => {
    if (!fromCvBuilder) {
      setIsLoading(false);
      return;
    }

    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) {
        setIsLoading(false);
        return;
      }

      const draft: DraftData = JSON.parse(raw);

      // Guardar draft completo para importar después
      setCvDraft(draft);

      // Extraer datos para pre-llenar el formulario
      const identity = draft?.identity;
      if (identity) {
        const prefill = {
          firstName: identity.firstName || "",
          lastName: identity.lastName1 || "",
          maternalSurname: identity.lastName2 || "",
          email: identity.email || "",
          phone: identity.phone || "",
          location: identity.location || "",
        };
        setPrefillData(prefill);
      }
    } catch (err) {
      console.error("Error leyendo draft de CV:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fromCvBuilder]);

  if (isLoading) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border glass-card p-4 md:p-6">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Cargando datos de tu CV...</p>
        </div>
      </div>
    );
  }

  return (
    <SignupMultiStep
      fromCvBuilder={fromCvBuilder}
      prefillData={prefillData}
      cvDraft={cvDraft}
    />
  );
}