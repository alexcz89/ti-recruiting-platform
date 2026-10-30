"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getRecruitingPresentation, getRecruiterStageOptions, type PresentationSource, type RecruiterStageOption } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  function choose(option: RecruiterStageOption) {
    if (option.requiresReason) setReasonAction(option);
    else void submit(option.intent);
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={options.length === 0 || pending} aria-label={`Cambiar etapa: ${presentation.label}`}
        className="inline-flex min-h-10 w-full min-w-[135px] items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-zinc-800 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        <span className="truncate">{presentation.label}</span><ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={event => { if (reasonAction) event.preventDefault(); }}
        className="min-w-[190px] border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
        <DropdownMenuLabel className="px-2.5 py-1 text-[11px] text-zinc-500">Cambiar etapa</DropdownMenuLabel>
        {options.map(option => <DropdownMenuItem key={`${option.intent}:${option.targetStage ?? ""}`}
          onSelect={() => choose(option)} className="px-2.5 py-2 text-xs dark:text-zinc-100">
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
