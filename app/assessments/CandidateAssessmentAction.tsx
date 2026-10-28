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
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-700 dark:text-white dark:hover:bg-teal-800"
      >
        Iniciar
      </Link>
    );
  }

  if (state === "IN_PROGRESS") {
    return (
      <Link
        href={resumeUrl}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-700 dark:text-white dark:hover:bg-teal-800"
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
