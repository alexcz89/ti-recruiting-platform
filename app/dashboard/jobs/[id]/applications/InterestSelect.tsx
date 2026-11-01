"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getRecruitingPresentation, getRecruiterStageOptions, type PresentationSource, type RecruiterStageOption } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ProcessReasonDialog from "./ProcessReasonDialog";
import { useApplicationIntent } from "./useApplicationIntent";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";

export default function InterestSelect({ applicationId, initial, initialStateVersion, legacyStatus = "", canonicalStage = null, canonicalDisposition = null, canonicalRecruiterReadsEnabled = false }: {
  applicationId: string;
  initial: InterestKey;
  initialStateVersion: number;
  legacyStatus?: string;
  canonicalStage?: ApplicationStageValue | null;
  canonicalDisposition?: ApplicationDispositionValue | null;
  canonicalRecruiterReadsEnabled?: boolean;
}) {
  const initialSource: PresentationSource = { stage: canonicalStage, disposition: canonicalDisposition, status: legacyStatus, recruiterInterest: initial, stateVersion: initialStateVersion };
  const { source, pending, submit } = useApplicationIntent(applicationId, initialSource);
  const [reasonAction, setReasonAction] = useState<RecruiterStageOption | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<RecruiterStageOption | null>(null);
  const presentation = getRecruitingPresentation(source, canonicalRecruiterReadsEnabled);
  const options = getRecruiterStageOptions(source, canonicalRecruiterReadsEnabled);
  const stageDot: Record<string, string> = { APPLIED: "bg-zinc-400", REVIEW: "bg-blue-500", INTERVIEW: "bg-violet-500", OFFER: "bg-emerald-500" };
  const controlClass = "inline-flex h-9 w-[160px] max-w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 text-left text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const label = <><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${stageDot[presentation.column ?? ""] ?? "bg-zinc-400"}`} /><span className="min-w-0 flex-1 truncate">{pending ? "Guardando…" : presentation.label}</span></>;
  if (!options.length) return <span className={controlClass}>{label}</span>;

  function choose(option: RecruiterStageOption) {
    if (option.requiresReason) setReasonAction(option);
    else if (option.requiresConfirmation) setConfirmationAction(option);
    else void submit(option.intent);
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={options.length === 0 || pending} aria-label={`Cambiar etapa: ${presentation.label}`}
        className={`${controlClass} transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait`}>
        {label}<ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent compact align="start" collisionPadding={8} onCloseAutoFocus={event => { if (reasonAction || confirmationAction) event.preventDefault(); }}
        className="w-[190px]">
        {options.map(option => <DropdownMenuItem key={`${option.intent}:${option.targetStage ?? ""}`}
          compact onSelect={() => choose(option)}>
          {option.requiresConfirmation ? "" : option.requiresReason ? "Regresar a " : "Avanzar a "}{option.label}
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {confirmationAction && <ProcessReasonDialog title={confirmationAction.label} pending={pending} confirmationOnly
      description={confirmationAction.intent === "HIRE_CANDIDATE" ? "La candidatura se marcará como contratada y el proceso quedará cerrado." : "La candidatura pasará a Descartados. Podrás reabrirla si el proceso lo permite."}
      onCancel={() => setConfirmationAction(null)}
      onConfirm={async () => {
        const success = await submit(confirmationAction.intent);
        if (success) setConfirmationAction(null);
      }} />}
    {reasonAction && <ProcessReasonDialog title={`Regresar a ${reasonAction.label}`} pending={pending}
      onCancel={() => setReasonAction(null)}
      onConfirm={async reason => {
        const success = await submit(reasonAction.intent, { targetStage: reasonAction.targetStage, ...reason });
        if (success) setReasonAction(null);
      }} />}
  </>;
}
