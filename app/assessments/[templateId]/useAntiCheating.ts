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
  attemptId: string | null;
  onFlagsChange?: (flags: Flags) => void;
  maxTabSwitches?: number;
};

type AntiCheatEvent =
  | "TAB_SWITCH"
  | "VISIBILITY_HIDDEN"
  | "COPY"
  | "PASTE"
  | "RIGHT_CLICK"
  | "PAGEHIDE"
  | "BLUR";

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

  const queueRef = useRef<any[]>([]);
  const timerRef = useRef<any>(null);

  const emit = useCallback(() => {
    onFlagsChange?.({ ...flagsRef.current });
  }, [onFlagsChange]);

  const enqueue = useCallback(
    (event: AntiCheatEvent, meta?: any) => {
      if (!attemptId) return;

      const eventId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      queueRef.current.push({
        event,
        meta,
        eventId,
        ts: new Date().toISOString(),
      });
    },
    [attemptId]
  );

  const flush = useCallback(
    (useBeacon: boolean) => {
      if (!attemptId) return;

      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (!batch.length) return;

      const url = `/api/assessments/attempts/${attemptId}/flags`;
      const payload = JSON.stringify({ events: batch });

      if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        try {
          const ok = navigator.sendBeacon(url, payload);
          if (ok) return;
        } catch {
          // fallback a fetch
        }
      }

      fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    },
    [attemptId]
  );

  useEffect(() => {
    if (!enabled) return;

    // flush periódico (reduce requests)
    timerRef.current = setInterval(() => flush(false), 2000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        flagsRef.current.tabSwitches += 1;
        flagsRef.current.focusLoss += 1;
        emit();

        // ✅ envía solo un evento canonical o ambos; aquí dejo ambos porque ya es batch
        enqueue("TAB_SWITCH");
        enqueue("VISIBILITY_HIDDEN");

        if (flagsRef.current.tabSwitches >= maxTabSwitches) {
          toast.error("⚠️ Has cambiado de pestaña muchas veces. Esto será reportado.", { duration: 5000 });
        } else {
          toast.warning(`⚠️ Evita cambiar de pestaña (${flagsRef.current.tabSwitches}/${maxTabSwitches})`, {
            duration: 3000,
          });
        }
      }
    };

    const handleBlur = () => {
      flagsRef.current.focusLoss += 1;
      emit();
      enqueue("BLUR");
    };

    const handleCopy = (e: ClipboardEvent) => {
      flagsRef.current.copyAttempts += 1;
      emit();
      enqueue("COPY");
      toast.warning("⚠️ Copiar está deshabilitado durante la evaluación");
      e.preventDefault();
    };

    const handlePaste = (e: ClipboardEvent) => {
      flagsRef.current.pasteAttempts += 1;
      emit();
      enqueue("PASTE");
      toast.warning("⚠️ Pegar está deshabilitado durante la evaluación");
      e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      enqueue("RIGHT_CLICK");
      toast.warning("⚠️ Click derecho deshabilitado");
    };

    const handlePageHide = () => {
      enqueue("PAGEHIDE");
      flush(true); // ✅ intenta beacon al salir
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("pagehide", handlePageHide);

      // flush final
      flush(true);
    };
  }, [enabled, enqueue, flush, emit, maxTabSwitches]);

  return flagsRef.current;
}
