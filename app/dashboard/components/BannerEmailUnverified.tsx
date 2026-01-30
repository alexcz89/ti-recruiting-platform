// app/dashboard/components/BannerEmailUnverified.tsx
"use client";

import { useTransition } from "react";
import { resendVerificationActionClient } from "./actions";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

export default function BannerEmailUnverified() {
  const [pending, start] = useTransition();

  const onResend = () => {
    start(async () => {
      const res = await resendVerificationActionClient();
      if (res?.ok) toastSuccess(res.message || "Verificación reenviada.");
      else toastError(res?.message || "No se pudo reenviar.");
    });
  };

  return (
    <div
      className="
        glass-card rounded-2xl border px-4 py-3 md:px-5 md:py-4
        border-amber-200/70 bg-amber-50/70
        dark:border-amber-900/40 dark:bg-amber-950/30
      "
      role="region"
      aria-label="Correo no verificado"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Tu correo aún no está verificado
          </p>
          <p className="text-sm text-amber-800/90 dark:text-amber-200/80">
            Verifica tu email para habilitar todas las funciones y proteger tu cuenta.
          </p>
        </div>

        <button
          onClick={onResend}
          disabled={pending}
          aria-busy={pending}
          className="
            btn-ghost h-8 px-3 text-xs md:h-9 md:px-3.5 md:text-sm
            border-amber-300/70 dark:border-amber-800/70
            hover:bg-amber-100/50 dark:hover:bg-amber-900/30
            text-amber-900 dark:text-amber-100
          "
        >
          {pending ? "Enviando..." : "Reenviar verificación"}
        </button>
      </div>
    </div>
  );
}
