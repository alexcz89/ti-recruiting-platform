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
  const presentation = getRecruitingPresentation(source, canonicalRecruiterReadsEnabled);
  const options = getRecruiterStageOptions(source, canonicalRecruiterReadsEnabled);
  const stageTone: Record<string, string> = {
    APPLIED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    REVIEW: "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    INTERVIEW: "bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    OFFER: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  };

  function choose(option: RecruiterStageOption) {
    if (option.requiresReason) setReasonAction(option);
    else void submit(option.intent);
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={options.length === 0 || pending} aria-label={`Cambiar etapa: ${presentation.label}`}
        className={`inline-flex h-9 max-w-[180px] items-center justify-between gap-2 rounded-lg px-2.5 text-left text-xs font-medium transition-colors hover:ring-1 hover:ring-current/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default disabled:opacity-70 ${stageTone[presentation.column ?? ""] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
        <span className="truncate">{pending ? "Guardando…" : presentation.label}</span><ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent compact align="start" collisionPadding={8} onCloseAutoFocus={event => { if (reasonAction) event.preventDefault(); }}
        className="w-[190px]">
        {options.map(option => <DropdownMenuItem key={`${option.intent}:${option.targetStage ?? ""}`}
          compact onSelect={() => choose(option)}>
          {option.label}{option.requiresReason ? " · requiere motivo" : ""}
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {reasonAction && <ProcessReasonDialog title={`Regresar a ${reasonAction.label}`} pending={pending}
      onCancel={() => setReasonAction(null)}
      onConfirm={async reason => {
        const success = await submit(reasonAction.intent, { targetStage: reasonAction.targetStage, ...reason });
        if (success) setReasonAction(null);
      }} />}
  </>;
}
