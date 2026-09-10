import Link from "next/link";
import React from "react";
import type { AssessmentState } from "@/lib/assessments/expiration";

type Props = {
  state: AssessmentState;
  startUrl: string;
  resumeUrl: string;
};

export function CandidateAssessmentAction({ state, startUrl, resumeUrl }: Props) {
  if (state === "PENDING") {
    return (
      <Link
        href={startUrl}
        className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
      >
        Iniciar
      </Link>
    );
  }

  if (state === "IN_PROGRESS") {
    return (
      <Link
        href={resumeUrl}
        className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700"
      >
        Continuar
      </Link>
    );
  }

  if (state === "EXPIRED" || state === "CANCELLED") {
    return (
      <span
        aria-disabled="true"
        className="inline-flex cursor-not-allowed items-center rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      >
        {state === "EXPIRED" ? "Invitación expirada" : "Invitación cancelada"}
      </span>
    );
  }

  return null;
}
