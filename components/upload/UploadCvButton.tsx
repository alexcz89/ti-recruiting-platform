// components/upload/UploadCvButton.tsx

"use client";

import { useRef, useState } from "react";
import { toastError, toastSuccess } from "@/lib/ui/toast";

type ParsedCvAnalysis = {
  summary?: string;
  seniority?: "junior" | "mid" | "senior";
  skills?: string[];
  yearsExperience?: number;
  recommendedRoles?: string[];
  redFlags?: string[];
  linkedin?: string;
  github?: string;
  languages?: Array<{ label: string; level?: string }>;
  experiences?: Array<{
    role: string;
    company: string;
    startDate?: string;
    endDate?: string | null;
    isCurrent?: boolean;
  }>;
  education?: Array<{
    institution: string;
    program?: string;
    startDate?: string;
    endDate?: string | null;
    level?: string | null;
  }>;
};

type UploadAndParseResponse = {
  success?: boolean;
  url?: string;
  fileName?: string;
  analysis?: ParsedCvAnalysis;
  textLength?: number;
  error?: string;
};

type Props = {
  onUploaded: (url: string) => void;
  onAiParsed?: (data: ParsedCvAnalysis) => void;
  className?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export default function UploadCvButton({
  onUploaded,
  onAiParsed,
  className,
  label,
  variant = "primary",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const buttonLabel =
    label ??
    (isUploading
      ? "Procesando..."
      : variant === "secondary"
        ? "Reemplazar CV"
        : "Subir CV");

  const variantStyles = {
    primary:
      "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed",
    secondary:
      "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
    ghost:
      "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
  };

  async function handleFileChange(file: File | null) {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (
      !lowerName.endsWith(".pdf") &&
      !lowerName.endsWith(".doc") &&
      !lowerName.endsWith(".docx")
    ) {
      toastError("Formato no soportado. Solo PDF, DOC o DOCX");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toastError("El archivo supera el tamaño máximo de 8 MB");
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/ai/cv/upload-and-parse", {
        method: "POST",
        body: formData,
      });

      const data: UploadAndParseResponse | null = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo subir y analizar el CV");
      }

      if (!data?.url) {
        throw new Error("No se recibió la URL del archivo");
      }

      onUploaded(data.url);

      if (data.analysis) {
        onAiParsed?.(data.analysis);
      }

      toastSuccess(
        variant === "secondary"
          ? "CV reemplazado y analizado correctamente"
          : "CV subido y analizado correctamente"
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Error al procesar el CV";
      toastError(message);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        disabled={isUploading}
        className={variantStyles[variant]}
        onClick={() => inputRef.current?.click()}
      >
        <span className="inline-flex items-center gap-1.5">
          {variant === "primary" ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L9 8m4-4v12"
                />
              </svg>
              {buttonLabel}
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {buttonLabel}
            </>
          )}
        </span>
      </button>
    </div>
  );
}