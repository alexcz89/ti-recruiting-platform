// components/dashboard/CopyInviteLinkButton.tsx
"use client";

import * as React from "react";
import { toastSuccess, toastError } from "@/lib/ui/toast";

export default function CopyInviteLinkButton({
  invitePath,
  children,
  className,
  ariaLabel = "Copiar link de invitación",
}: {
  invitePath: string; // ej: /assessments/[templateId]?token=...
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [justCopied, setJustCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      const origin =
        typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
      const full = invitePath.startsWith("http") ? invitePath : `${origin}${invitePath}`;

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(full);
        setJustCopied(true);
        toastSuccess("Link copiado");
        setTimeout(() => setJustCopied(false), 2000);
        return;
      }

      // Fallback viejo: prompt para copiar manualmente
      window.prompt("Copia el link:", full);
    } catch {
      toastError("No se pudo copiar el link");
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={className}
      aria-label={justCopied ? "Link copiado" : ariaLabel}
      aria-live="polite"
    >
      {children ?? "Copiar link"}
    </button>
  );
}
