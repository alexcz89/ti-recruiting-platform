// components/dashboard/CopyInviteLinkButton.tsx
"use client";

import * as React from "react";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

export default function CopyInviteLinkButton({
  invitePath,
  children,
  className,
}: {
  invitePath: string; // ej: /assessments/[templateId]?token=...
  children?: React.ReactNode;
  className?: string;
}) {
  const onCopy = async () => {
    try {
      const origin =
        typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
      const full = invitePath.startsWith("http") ? invitePath : `${origin}${invitePath}`;

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(full);
        toastSuccess("Link copiado");
        return;
      }

      // Fallback viejo: prompt para copiar manualmente
      window.prompt("Copia el link:", full);
    } catch {
      toastError("No se pudo copiar el link");
    }
  };

  return (
    <button type="button" onClick={onCopy} className={className}>
      {children ?? "Copiar link"}
    </button>
  );
}
