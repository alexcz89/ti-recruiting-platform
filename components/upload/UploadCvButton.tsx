// components/upload/UploadCvButton.tsx
"use client";

import { UploadButton } from "@/lib/uploadthing";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { toastError, toastSuccess } from "@/lib/ui/toast";

type Props = {
  onUploaded: (url: string) => void;
  className?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export default function UploadCvButton({
  onUploaded,
  className,
  label,
  variant = "primary",
}: Props) {
  // Determinar label según variante si no se proporciona
  const buttonLabel = label ?? (variant === "secondary" ? "Reemplazar CV" : "Subir CV");

  // Estilos según variante
  const variantStyles = {
    primary: "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all",
    secondary: "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors",
    ghost: "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors",
  };

  return (
    <div className={className}>
      <UploadButton<OurFileRouter, "resumeUploader">
        endpoint="resumeUploader"
        appearance={{
          button: variantStyles[variant],
          container: "inline-flex items-center gap-2",
          allowedContent: "hidden", // Ocultamos el texto de tipos permitidos del botón principal
        }}
        content={{
          button: (
            <span className="inline-flex items-center gap-1.5">
              {variant === "primary" ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L9 8m4-4v12" />
                  </svg>
                  {buttonLabel}
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {buttonLabel}
                </>
              )}
            </span>
          ),
        }}
        onClientUploadComplete={(files) => {
          const f = (files?.[0] ?? {}) as any;
          const url = f.ufsUrl || f.url;
          if (!url) {
            toastError("No se recibió la URL del archivo");
            return;
          }
          toastSuccess(variant === "secondary" ? "CV reemplazado correctamente" : "CV subido correctamente");
          onUploaded(url);
        }}
        onUploadError={(e: any) => {
          toastError(e?.message || "Error al subir CV");
        }}
      />
    </div>
  );
}