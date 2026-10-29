"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { canStartReview } from "@/lib/hiring-process/start-review-eligibility";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { toastError } from "@/lib/ui/toast";

type ReviewApplication = {
  stage: ApplicationStageValue | null;
  disposition: ApplicationDispositionValue | null;
  stateVersion: number;
  status: string;
  recruiterInterest: string;
};

export default function StartReviewButton({ applicationId, application, disabled = false, onSuccess, onPendingChange }: {
  applicationId: string;
  application: ReviewApplication;
  disabled?: boolean;
  onSuccess: (application: ReviewApplication) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const command = useRef<{ id: string; version: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  if (!canStartReview(application) || completed) return null;

  async function startReview() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setPending(true);
    onPendingChange(true);
    try {
      if (!command.current || command.current.version !== application.stateVersion) {
        command.current = { id: crypto.randomUUID(), version: application.stateVersion };
      }
      const response = await fetch(`/api/applications/${applicationId}/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "START_REVIEW", expectedVersion: command.current.version, commandId: command.current.id }),
      });
      if (!response.ok) {
        if (response.status === 409) router.refresh();
        throw new Error("No se pudo iniciar la revisión");
      }
      const data = await response.json();
      onSuccess(data.application);
      setCompleted(true);
      router.refresh();
    } catch {
      toastError("No se pudo iniciar la revisión. Actualiza la página o intenta de nuevo.");
    } finally {
      inFlight.current = false;
      setPending(false);
      onPendingChange(false);
    }
  }

  return <button type="button" disabled={pending || disabled} onClick={startReview}
    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-indigo-300 px-3 text-xs font-medium text-indigo-700 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300">
    {pending ? "Iniciando revisión…" : "Iniciar revisión"}
  </button>;
}
