// components/jobs/ApplyButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { toastSuccess, toastError, toastInfo } from "@/lib/ui/toast";

export type ApplyResult =
  | { ok: true; redirect: string }
  | { error: "AUTH"; signinUrl: string }
  | { error: "ROLE"; message: string }
  | { error: "ALREADY_APPLIED"; message?: string } // 👈 caso especial
  | { error: "UNKNOWN"; message?: string };

type Props = {
  applyAction: () => Promise<ApplyResult>;
  label?: string;
  className?: string;
  /**
   * Identificador estable de la vacante. Sirve para resetear el
   * estado visual del botón cuando cambias de job.
   */
  jobKey?: string;
};

export default function ApplyButton({
  applyAction,
  label = "Postularme",
  className = "",
  jobKey,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [justApplied, setJustApplied] = React.useState(false);

  // 👉 Cada vez que cambie la vacante, reseteamos el estado del botón
  React.useEffect(() => {
    setJustApplied(false);
  }, [jobKey]);

  const onClick = () => {
    if (pending) return;

    startTransition(async () => {
      const res = await applyAction();

      // ✅ Éxito
      if ("ok" in res && res.ok) {
        setJustApplied(true);
        toastSuccess("Postulación enviada");
        if (res.redirect) {
          router.push(res.redirect);
        }
        return;
      }

      // ✅ Errores tipados
      if ("error" in res) {
        if (res.error === "AUTH") {
          toastInfo("Inicia sesión como candidato para postular");
          window.location.href = res.signinUrl;
          return;
        }

        if (res.error === "ROLE") {
          toastError(res.message || "No autorizado");
          return;
        }

        if (res.error === "ALREADY_APPLIED") {
          toastInfo(res.message || "Ya postulaste a esta vacante");
          // dejamos el botón en “¡Listo!” solo para ESTA vacante
          setJustApplied(true);
          return;
        }

        toastError(res.message || "No se pudo postular");
        return;
      }

      // Fallback defensivo
      toastError("No se pudo postular");
    });
  };

  const btnBase =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900";

  const btnState = pending
    ? "cursor-not-allowed bg-emerald-600/85 text-white"
    : justApplied
    ? "bg-emerald-700 text-white hover:bg-emerald-700"
    : "bg-emerald-600 text-white hover:bg-emerald-700";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-disabled={pending ? "true" : "false"}
        aria-busy={pending ? "true" : "false"}
        aria-live="polite"
        className={`${btnBase} ${btnState}`}
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

      <span className="text-[12px] text-muted" aria-live="polite">
        {pending
          ? "Procesando tu postulación…"
          : "Se enviará sin carta ni adjuntos."}
      </span>
    </div>
  );
}
