// components/jobs/ApplyButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { toastSuccess, toastError, toastInfo } from "@/lib/ui/toast";

type ApplyResult =
  | { ok: true; redirect: string }
  | { error: "AUTH"; signinUrl: string }
  | { error: "ROLE"; message: string }
  | { error: "UNKNOWN"; message?: string };

export default function ApplyButton({
  applyAction,
  label = "Postularme",
  className = "",
}: {
  applyAction: () => Promise<ApplyResult>;
  /** etiqueta del botón (opcional) */
  label?: string;
  /** clases extra opcionales */
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [justApplied, setJustApplied] = React.useState(false);

  const onClick = () => {
    if (pending) return;
    startTransition(async () => {
      const res = await applyAction();

      if ("ok" in res && res.ok) {
        setJustApplied(true);
        toastSuccess("Postulación enviada");
        router.push(res.redirect);
        return;
      }

      if (res.error === "AUTH") {
        toastInfo("Inicia sesión como candidato para postular");
        // redirigimos inmediatamente
        window.location.href = res.signinUrl;
        return;
      }

      if (res.error === "ROLE") {
        toastError(res.message || "No autorizado");
        return;
      }

      toastError(res.message || "No se pudo postular");
    });
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={onClick}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow transition
        focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2
        ${pending ? "bg-emerald-500/80 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}
        aria-busy={pending ? "true" : "false"}
        aria-live="polite"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Enviando…
          </>
        ) : justApplied ? (
          <>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ¡Listo!
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            {label}
          </>
        )}
      </button>

      {/* Texto auxiliar accesible */}
      <span className="text-xs text-zinc-500" aria-live="polite">
        {pending ? "Procesando tu postulación…" : "Se enviará sin carta ni adjuntos."}
      </span>
    </div>
  );
}
