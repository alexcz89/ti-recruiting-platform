"use client";

import { useRef, useState } from "react";

export default function AssessmentExportButton({ href, className }: { href: string; className?: string }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) {
        // Never display arbitrary upstream responses (HTML, stack traces or PII).
        setError(response.status === 422
          ? "La búsqueda supera el límite de 2000 evaluaciones. Refina los filtros y vuelve a exportar."
          : response.status === 401 || response.status === 403
            ? "No tienes acceso a esta exportación. Comprueba tu sesión."
            : "No pudimos exportar las evaluaciones. Intenta nuevamente.");
        return;
      }
      if (!response.headers.get("content-type")?.startsWith("text/csv")) throw new Error("Unexpected export response");
      const url = URL.createObjectURL(await response.blob());
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "evaluaciones.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally { URL.revokeObjectURL(url); }
    } catch {
      setError("No pudimos exportar las evaluaciones. Intenta nuevamente.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="max-w-full">
    <button type="button" onClick={download} disabled={busy} aria-busy={busy} className={className}
      title="Exporta todas las evaluaciones coincidentes. Límite: 2000; refina los filtros si se supera.">
      {busy ? "Exportando…" : "Exportar CSV"}
    </button>
    {error && <p role="alert" className="mt-2 max-w-sm text-sm text-red-700 dark:text-red-400">{error}</p>}
  </div>;
}
