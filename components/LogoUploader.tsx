"use client";

import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

type Props = {
  onUploaded: (url: string) => void;
  className?: string;
  label?: string;
};

export default function LogoUploader({ onUploaded, className, label }: Props) {
  return (
    <div className={className}>
      {label && <p className="text-sm text-zinc-600 mb-1">{label}</p>}
      <UploadButton<OurFileRouter>
        endpoint="logo"
        onClientUploadComplete={(res) => {
          const url = res?.[0]?.url;
          if (url) onUploaded(url);
        }}
        onUploadError={(e: Error) => {
          alert(e.message || "Error al subir imagen");
        }}
        content={{
          button({ ready }) {
            return ready ? "Subir logo" : "Cargando…";
          },
        }}
        className="ut-button:bg-emerald-600 ut-button:hover:bg-emerald-700 ut-button:text-white ut-button:rounded-lg ut-button:px-3 ut-button:py-1.5"
      />
      <p className="mt-1 text-xs text-zinc-500">
        PNG/JPG/SVG. Máx 2 MB.
      </p>
    </div>
  );
}
