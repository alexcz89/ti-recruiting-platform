"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, Loader2, MoreHorizontal } from "lucide-react";
import { getRecruitingPresentation, getRecruiterStageOptions, type PresentationSource, type RecruiterStageOption } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RecruiterStateDialog } from "./ProcessReasonDialog";
import { useApplicationIntent } from "./useApplicationIntent";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";

export default function InterestSelect({ applicationId, initial, initialStateVersion, legacyStatus = "", canonicalStage = null, canonicalDisposition = null, canonicalRecruiterReadsEnabled = false, disabled = false, onConfirmed, onBusyChange, accessibleLabel, variant = "default" }: {
  applicationId: string;
  initial: InterestKey;
  initialStateVersion: number;
  legacyStatus?: string;
  canonicalStage?: ApplicationStageValue | null;
  canonicalDisposition?: ApplicationDispositionValue | null;
  canonicalRecruiterReadsEnabled?: boolean;
  disabled?: boolean;
  onConfirmed?: (source: PresentationSource) => void;
  onBusyChange?: (busy: boolean) => void;
  accessibleLabel?: string;
  variant?: "default" | "icon";
}) {
  const initialSource: PresentationSource = { stage: canonicalStage, disposition: canonicalDisposition, status: legacyStatus, recruiterInterest: initial, stateVersion: initialStateVersion };
  const { source, pending, submit } = useApplicationIntent(applicationId, initialSource, onConfirmed);
  const [dialogAction, setDialogAction] = useState<RecruiterStageOption | null>(null);
  useEffect(() => {
    onBusyChange?.(pending || dialogAction !== null);
    return () => onBusyChange?.(false);
  }, [pending, dialogAction, onBusyChange]);
  const presentation = getRecruitingPresentation(source, canonicalRecruiterReadsEnabled);
  const options = getRecruiterStageOptions(source, canonicalRecruiterReadsEnabled);
  const stageDot: Record<string, string> = { APPLIED: "bg-zinc-400", REVIEW: "bg-blue-500", INTERVIEW: "bg-violet-500", OFFER: "bg-emerald-500" };
  const controlClass = "inline-flex h-9 w-[160px] max-w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 text-left text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const label = <><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${stageDot[presentation.column ?? ""] ?? "bg-zinc-400"}`} /><span className="min-w-0 flex-1 truncate">{pending ? "Guardando…" : presentation.label}</span></>;
  if (!options.length) return variant === "icon" ? null : <span className={controlClass}>{label}</span>;

  function choose(option: RecruiterStageOption) {
    if (option.current || disabled || pending) return;
    if (option.requiresReason || option.requiresConfirmation) setDialogAction(option);
    else void submit(option.intent, { destination: option.destination });
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled || pending} aria-label={accessibleLabel ?? `Cambiar etapa: ${presentation.label}`}
        className={`${variant === "icon" ? "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400" : controlClass} transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait`}>
        {variant === "icon" ? (pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <MoreHorizontal aria-hidden="true" className="h-5 w-5" />)
          : <>{label}<ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" /></>}
      </DropdownMenuTrigger>
      <DropdownMenuContent compact align={variant === "icon" ? "end" : "start"} collisionPadding={8} onCloseAutoFocus={event => { if (dialogAction) event.preventDefault(); }}
        className={variant === "icon" ? "max-h-[var(--radix-dropdown-menu-content-available-height)] w-52 max-w-[calc(100vw-1rem)] overflow-y-auto" : "w-[190px]"}>
        {options.map(option => <DropdownMenuItem key={option.destination} disabled={option.current} aria-current={option.current ? "step" : undefined}
          compact className={variant === "icon" ? "min-h-11 text-sm" : undefined} onSelect={() => choose(option)}>
          {option.label}{option.current && <span aria-hidden="true">✓</span>}
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {dialogAction && <RecruiterStateDialog option={dialogAction} pending={pending}
      onCancel={() => setDialogAction(null)}
      onConfirm={async reason => {
        const success = await submit(dialogAction.intent, { destination: dialogAction.destination, ...reason });
        if (success) setDialogAction(null);
      }} />}
  </>;
}
