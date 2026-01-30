// components/LogoUploader.tsx
"use client";

import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

type Props = {
  label?: string;
  className?: string;
  onUploaded: (url: string) => void;
};

export default function LogoUploader({ label, className = "", onUploaded }: Props) {
  return (
    <div className={className}>
      {label && <p className="text-sm text-zinc-600 mb-1">{label}</p>}

      <UploadButton<OurFileRouter, "logoUploader">
        endpoint="logoUploader"
        appearance={{
          button:
            "rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 glass-card p-4 md:p-6",
          allowedContent: "text-[11px] text-zinc-500",
        }}
        onClientUploadComplete={(files) => {
          const f = (files?.[0] ?? {}) as any;
          // UploadThing v9: usar ufsUrl si existe, con fallback a url
          const url = f?.ufsUrl || f?.url;
          if (!url) {
            toastError("No se recibió URL del logo");
            return;
          }
          onUploaded(url);
          toastSuccess("Logo subido correctamente");
        }}
        onUploadError={(error) => {
          console.error(error);
          toastError(error?.message || "Error al subir el logo");
        }}
      />
    </div>
  );
}
