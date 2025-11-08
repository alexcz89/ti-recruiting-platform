// app/dashboard/components/BannerEmailUnverified.tsx
"use client";

import { useTransition } from "react";
import { resendVerificationEmailAction } from "./actions/profile";
import { toast } from "sonner";

export default function BannerEmailUnverified() {
  const [pending, start] = useTransition();

  const onResend = () => {
    start(async () => {
      const res = await resendVerificationEmailAction();
      if (res?.ok) toast.success(res.message || "Verificación reenviada.");
      else toast.error(res?.message || "No se pudo reenviar.");
    });
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-amber-900">Tu correo aún no está verificado</p>
          <p className="text-sm text-amber-800/90">
            Verifica tu email para habilitar todas las funciones y proteger tu cuenta.
          </p>
        </div>
        <button
          onClick={onResend}
          disabled={pending}
          className="shrink-0 rounded-md border border-amber-300 glass-card p-4 md:p-6"
        >
          {pending ? "Enviando..." : "Reenviar verificación"}
        </button>
      </div>
    </div>
  );
}
