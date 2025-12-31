// app/assessments/[templateId]/useAntiCheating.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

type Flags = {
  tabSwitches: number;
  copyAttempts: number;
  pasteAttempts: number;
  focusLoss: number;
};

type Props = {
  enabled: boolean;
  attemptId: string | null; // 👈 NUEVO
  onFlagsChange?: (flags: Flags) => void; // ahora opcional (solo UI)
  maxTabSwitches?: number;
};

type AntiCheatEvent =
  | "TAB_SWITCH"
  | "VISIBILITY_HIDDEN"
  | "COPY"
  | "PASTE"
  | "RIGHT_CLICK";

export function useAntiCheating({
  enabled,
  attemptId,
  onFlagsChange,
  maxTabSwitches = 5,
}: Props) {
  const flagsRef = useRef<Flags>({
    tabSwitches: 0,
    copyAttempts: 0,
    pasteAttempts: 0,
    focusLoss: 0,
  });

  const sendEvent = useCallback(
    async (event: AntiCheatEvent, meta?: any) => {
      if (!attemptId) return;

      // fire-and-forget (pero sin tirar warnings en consola si falla)
      try {
        await fetch(`/api/assessments/attempts/${attemptId}/flags`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meta ? { event, meta } : { event }),
        });
      } catch {
        // no-op: no interrumpir al candidato
      }
    },
    [attemptId]
  );

  useEffect(() => {
    if (!enabled) return;

    const emit = () => onFlagsChange?.({ ...flagsRef.current });

    // Detectar cambio de tab/ventana
    const handleVisibilityChange = () => {
      if (document.hidden) {
        flagsRef.current.tabSwitches += 1;
        flagsRef.current.focusLoss += 1;
        emit();

        // Server-side event
        sendEvent("TAB_SWITCH");
        sendEvent("VISIBILITY_HIDDEN");

        if (flagsRef.current.tabSwitches >= maxTabSwitches) {
          toast.error("⚠️ Has cambiado de pestaña muchas veces. Esto será reportado.", {
            duration: 5000,
          });
        } else {
          toast.warning(
            `⚠️ Evita cambiar de pestaña (${flagsRef.current.tabSwitches}/${maxTabSwitches})`,
            { duration: 3000 }
          );
        }
      }
    };

    // Detectar pérdida de foco (solo señal local; opcional reportar)
    const handleBlur = () => {
      flagsRef.current.focusLoss += 1;
      emit();
      // si quieres reportar blur como evento, úsalo como VISIBILITY_HIDDEN también:
      // sendEvent("VISIBILITY_HIDDEN", { source: "blur" });
    };

    const handleCopy = (e: ClipboardEvent) => {
      flagsRef.current.copyAttempts += 1;
      emit();

      sendEvent("COPY");

      toast.warning("⚠️ Copiar está deshabilitado durante la evaluación");
      e.preventDefault();
    };

    const handlePaste = (e: ClipboardEvent) => {
      flagsRef.current.pasteAttempts += 1;
      emit();

      sendEvent("PASTE");

      toast.warning("⚠️ Pegar está deshabilitado durante la evaluación");
      e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      sendEvent("RIGHT_CLICK");

      toast.warning("⚠️ Click derecho deshabilitado");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [enabled, sendEvent, maxTabSwitches, onFlagsChange]);

  return flagsRef.current;
}
