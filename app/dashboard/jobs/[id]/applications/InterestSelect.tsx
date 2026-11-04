"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, CirclePause, Loader2, MoreHorizontal, UserCheck, UserX } from "lucide-react";
import { getRecruiterPipelinePresentation, getRecruiterPipelineOptions, type PresentationSource, type RecruiterPipelineOption } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RecruiterStateDialog } from "./ProcessReasonDialog";
import { useApplicationIntent } from "./useApplicationIntent";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";

export default function InterestSelect({ applicationId, initial, initialStateVersion, legacyStatus = "", canonicalStage = null, canonicalDisposition = null, canonicalRecruiterReadsEnabled = false, integrityIssue = false, disabled = false, onConfirmed, onBusyChange, accessibleLabel, variant = "default" }: {
  applicationId: string;
  initial: InterestKey;
  initialStateVersion: number;
  legacyStatus?: string;
  canonicalStage?: ApplicationStageValue | null;
  canonicalDisposition?: ApplicationDispositionValue | null;
  canonicalRecruiterReadsEnabled?: boolean;
  disabled?: boolean;
  integrityIssue?: boolean;
  onConfirmed?: (source: PresentationSource) => void;
  onBusyChange?: (busy: boolean) => void;
  accessibleLabel?: string;
  variant?: "default" | "icon";
}) {
  const initialSource: PresentationSource = { stage: canonicalStage, disposition: canonicalDisposition, status: legacyStatus, recruiterInterest: initial, stateVersion: initialStateVersion };
  const { source, pending, submit } = useApplicationIntent(applicationId, initialSource, onConfirmed);
  const [dialogAction, setDialogAction] = useState<RecruiterPipelineOption | null>(null);
  useEffect(() => {
    onBusyChange?.(pending || dialogAction !== null);
    return () => onBusyChange?.(false);
  }, [pending, dialogAction, onBusyChange]);
  const presentation = getRecruiterPipelinePresentation(source, canonicalRecruiterReadsEnabled);
  const options = integrityIssue ? [] : getRecruiterPipelineOptions(source, canonicalRecruiterReadsEnabled);
  const stageDot: Record<string, string> = { APPLIED: "bg-zinc-400", REVIEW: "bg-blue-500", INTERVIEW: "bg-violet-500", HIRED: "bg-emerald-500", REJECTED: "bg-rose-500" };
  const controlClass = "inline-flex min-h-11 w-[160px] max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-left text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const hasIntegrityIssue = integrityIssue || presentation.integrityIssue;
  const label = <><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${stageDot[hasIntegrityIssue ? "" : presentation.pipelineState ?? ""] ?? "bg-zinc-400"}`} /><span className="min-w-0 flex-1 truncate">{pending ? "Guardando…" : hasIntegrityIssue ? "—" : presentation.label}</span>{presentation.paused && !hasIntegrityIssue && <CirclePause aria-label="En pausa" className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}</>;
  if (!options.length) return variant === "icon" ? null : <span className={controlClass}>{label}{hasIntegrityIssue && <span role="status" title="Advertencia de integridad: etapa no verificable. Cambios bloqueados." className="inline-flex items-center text-amber-700 dark:text-amber-300"><AlertTriangle aria-hidden="true" className="h-4 w-4" /><span className="sr-only">Advertencia de integridad: etapa no verificable. Cambios bloqueados.</span></span>}</span>;

  function choose(option: RecruiterPipelineOption) {
    if (option.disabled || disabled || pending) return;
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
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto motion-reduce:transition-none">
        {options.map(option => {
          const Icon = option.pipelineState === "HIRED" ? UserCheck : option.pipelineState === "REJECTED" ? UserX : null;
          return <DropdownMenuItem key={option.pipelineState} disabled={option.disabled} aria-current={option.current ? "step" : undefined}
            compact className={`min-h-11 text-sm ${option.current ? "bg-zinc-100 data-[disabled]:opacity-100 dark:bg-zinc-800" : ""}`} onSelect={() => choose(option)}>
            {Icon && <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${option.pipelineState === "HIRED" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`} />}
            <span className="flex-1">{option.label}</span>
            {option.resumesPaused && <span className="text-xs text-zinc-600 dark:text-zinc-400">Reanudar</span>}
            {option.current && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>;
        })}
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
