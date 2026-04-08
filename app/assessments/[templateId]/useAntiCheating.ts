// app/assessments/[templateId]/useAntiCheating.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { toastError, toastWarning } from "@/lib/ui/toast";

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
  maxTabSwitches = 15, // ✅ Subido de 5 a 15 — más realista para coding
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

      if (
        useBeacon &&
        typeof navigator !== "undefined" &&
        "sendBeacon" in navigator
      ) {
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

    // Flush periódico cada 3s (reduce requests)
    timerRef.current = setInterval(() => flush(false), 3000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        flagsRef.current.tabSwitches += 1;
        flagsRef.current.focusLoss += 1;
        emit();

        enqueue("TAB_SWITCH");
        enqueue("VISIBILITY_HIDDEN");

        if (flagsRef.current.tabSwitches >= maxTabSwitches) {
          // ✅ Solo mostrar warning severo después del threshold real
          toastError(
            "⚠️ Has cambiado de pestaña muchas veces. Esto será reportado.",
            { duration: 5000 }
          );
        } else if (flagsRef.current.tabSwitches >= Math.floor(maxTabSwitches / 2)) {
          // ✅ Warning suave a mitad del camino
          toastWarning(
            `⚠️ Evita cambiar de pestaña (${flagsRef.current.tabSwitches}/${maxTabSwitches})`,
            { duration: 3000 }
          );
        }
        // ✅ Sin toast en las primeras pocas veces — no molestar innecesariamente
      }
    };

    const handleBlur = () => {
      flagsRef.current.focusLoss += 1;
      emit();
      enqueue("BLUR");
      // ✅ Sin toast — el blur ocurre constantemente en el editor de código
    };

    // ✅ Copy/paste: solo registrar, NO bloquear
    // En assessments de coding el candidato necesita copiar/pegar código
    // El registro sirve para detectar patrones sospechosos (copiar mucho = posible plagiarismo)
    const handleCopy = (_e: ClipboardEvent) => {
      flagsRef.current.copyAttempts += 1;
      emit();
      enqueue("COPY");
      // Sin preventDefault() — permitir copiar
      // Sin toast — no interrumpir el flujo de trabajo
    };

    const handlePaste = (_e: ClipboardEvent) => {
      flagsRef.current.pasteAttempts += 1;
      emit();
      enqueue("PASTE");
      // Sin preventDefault() — permitir pegar
      // Sin toast — no interrumpir el flujo de trabajo
    };

    // ✅ Click derecho: solo registrar, NO bloquear
    // El editor Monaco usa click derecho para su menú contextual
    const handleContextMenu = (_e: MouseEvent) => {
      enqueue("RIGHT_CLICK");
      // Sin preventDefault() — permitir menú contextual del editor
    };

    const handlePageHide = () => {
      enqueue("PAGEHIDE");
      flush(true); // beacon al salir
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

      flush(true);
    };
  }, [enabled, enqueue, flush, emit, maxTabSwitches]);

  return flagsRef.current;
}