"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
import { toastError } from "@/lib/ui/toast";

type IntentExtra = {
  targetStage?: "REVIEW" | "INTERVIEW";
  reasonCode?: string;
  reasonText?: string;
};

export function useApplicationIntent(applicationId: string, initialSource: PresentationSource) {
  const router = useRouter();
  const [source, setSource] = useState(initialSource);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const command = useRef<{ signature: string; id: string } | null>(null);
  const { stage, disposition, status, recruiterInterest, stateVersion } = initialSource;

  useEffect(() => {
    setSource({ stage, disposition, status, recruiterInterest, stateVersion });
    command.current = null;
  }, [applicationId, stage, disposition, status, recruiterInterest, stateVersion]);

  async function submit(intent: string, extra: IntentExtra = {}): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    const signature = JSON.stringify({ intent, version: source.stateVersion, ...extra });
    if (command.current?.signature !== signature) {
      command.current = { signature, id: crypto.randomUUID() };
    }
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, expectedVersion: source.stateVersion, commandId: command.current.id, ...extra }),
      });
      if (!response.ok) {
        toastError(response.status === 409 ? "La postulación cambió. Actualiza la página antes de intentarlo de nuevo."
          : response.status === 422 ? "La etapa actual no permite ese cambio. Actualiza la página."
          : "No se pudo actualizar la postulación. Intenta de nuevo.");
        router.refresh();
        return false;
      }
      const data = await response.json();
      if (!data?.application || typeof data.application.stateVersion !== "number") {
        throw new Error("Invalid transition response");
      }
      setSource(data.application);
      router.refresh();
      return true;
    } catch {
      toastError("No se pudo actualizar la postulación. Comprueba tu conexión e inténtalo de nuevo.");
      router.refresh();
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { source, pending, submit };
}
