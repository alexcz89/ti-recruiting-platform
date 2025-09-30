// components/upload/UploadCvButton.tsx
"use client";
import { UploadButton } from "@/lib/uploadthing";
import { toastError, toastSuccess } from "@/lib/ui/toast";

type Props = {
  onUploaded: (url: string) => void;
  className?: string;
  label?: string;
};

export default function UploadCvButton({ onUploaded, className, label = "Subir CV" }: Props) {
  return (
    <div className={className}>
      <UploadButton
        endpoint="resumeUploader" // 👈 Debe coincidir con el core
        appearance={{
          button: "rounded-xl border px-3 py-2 text-sm hover:bg-gray-50",
          container: "inline-flex items-center gap-2",
        }}
        content={{
          button: label,
          allowedContent: "PDF, DOC, DOCX • máx. 8 MB",
        }}
        onClientUploadComplete={(res) => {
          const url = res?.[0]?.url;
          if (!url) {
            toastError("No se recibió la URL del archivo");
            return;
          }
          toastSuccess("CV subido");
          onUploaded(url);
        }}
        onUploadError={(e) => {
          // Este error viene del server, ahora también quedará logueado en consola por onUploadError
          toastError(e?.message || "Error al subir CV");
        }}
      />
    </div>
  );
}
