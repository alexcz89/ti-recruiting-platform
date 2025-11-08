// components/resume/DownloadPdfButton.tsx
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  className?: string;
  label?: string;
};

function extractFilenameFromContentDisposition(value?: string | null): string | null {
  if (!value) return null;
  // Prioriza filename* (UTF-8) y luego filename
  // Ejemplos:
  //   attachment; filename="CV-Alejandro-Cerda.pdf"; filename*=UTF-8''CV-Alejandro-Cerda.pdf
  //   attachment; filename="CV.pdf"
  const utf8Match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(value);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ""));
    } catch {
      return utf8Match[1].replace(/["']/g, "");
    }
  }
  const asciiMatch = /filename\s*=\s*("?)([^";]+)\1/i.exec(value);
  if (asciiMatch?.[2]) return asciiMatch[2];
  return null;
}

async function fallbackFilename(): Promise<string> {
  try {
    const r = await fetch("/api/profile", { cache: "no-store" });
    if (!r.ok) throw new Error();
    const j = await r.json();
    const raw =
      (j?.name && String(j.name)) ||
      (j?.email && String(j.email).split("@")[0]) ||
      "CV";
    const safe = raw
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\-_.\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
    return `CV-${safe || "Perfil"}.pdf`;
  } catch {
    return "CV.pdf";
  }
}

export default function DownloadPdfButton({ className = "", label = "Descargar PDF" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    try {
      setLoading(true);
      toast.loading("Generando PDF...");

      const res = await fetch("/api/profile/export", { method: "POST" });
      if (!res.ok) throw new Error("No se pudo generar el PDF");

      // 1) Lee filename del header si existe
      let filename =
        extractFilenameFromContentDisposition(res.headers.get("Content-Disposition")) ||
        (await fallbackFilename());

      // 2) Descarga
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "CV.pdf";
      a.click();
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("PDF descargado correctamente 🎉");
    } catch (e: any) {
      console.error(e);
      toast.dismiss();
      toast.error(e?.message || "Error al generar el PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-md border border-gray-300 glass-card p-4 md:p-6
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generando…
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
