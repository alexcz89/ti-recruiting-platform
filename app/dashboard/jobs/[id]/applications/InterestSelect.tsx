"use client";

import React, { useEffect, useState } from "react";
import { Check, ChevronDown, CirclePause, CirclePlay, Loader2, MoreHorizontal, UserCheck, UserMinus, UserX, XCircle } from "lucide-react";
import { FINALIZED_OUTCOMES, getRecruitingPresentation, getRecruiterStageOptions, type PresentationSource, type RecruiterStageOption } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const resume = presentation.section === "HOLD"
    ? options.find(option => option.destination === source.stage) : undefined;
  const groups = [
    { title: "Cambiar etapa", options: options.filter(option => ["APPLIED", "REVIEW", "INTERVIEW", "OFFER"].includes(option.destination) && option !== resume) },
    { title: "Finalizar candidatura", options: FINALIZED_OUTCOMES.flatMap(({ key }) => options.filter(option => option.destination === key)) },
    { title: "Otras acciones", options: [...options.filter(option => option.destination === "HOLD"), ...(resume ? [resume] : [])] },
  ].filter(group => group.options.length);
  const actionLabels: Record<string, string> = { HIRED: "Contratar candidato", REJECTED: "Descartar candidato", WITHDRAWN: "Registrar retiro", CANCELLED: "Cancelar proceso", HOLD: "Poner en pausa" };
  const actionIcons = { HIRED: UserCheck, REJECTED: UserX, WITHDRAWN: UserMinus, CANCELLED: XCircle, HOLD: CirclePause };
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
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto motion-reduce:transition-none">
        {groups.map((group, index) => <React.Fragment key={group.title}>
          {index > 0 && <DropdownMenuSeparator compact />}
          <DropdownMenuGroup aria-label={group.title}>
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{group.title}</DropdownMenuLabel>
            {group.options.map(option => {
              const Icon = option === resume ? CirclePlay : actionIcons[option.destination as keyof typeof actionIcons];
              return <DropdownMenuItem key={option.destination} disabled={option.current} aria-current={option.current ? "step" : undefined}
                compact className={`min-h-11 text-sm ${option.current ? "bg-zinc-100 data-[disabled]:opacity-100 dark:bg-zinc-800" : ""}`} onSelect={() => choose(option)}>
                {Icon && <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${option.destination === "HIRED" ? "text-emerald-700 dark:text-emerald-400" : option.destination === "REJECTED" ? "text-rose-700 dark:text-rose-400" : "text-zinc-500 dark:text-zinc-400"}`} />}
                <span className="flex-1">{option.current ? option.label : option === resume ? "Reanudar proceso" : actionLabels[option.destination] ?? option.label}</span>
                {option.current && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
              </DropdownMenuItem>;
            })}
          </DropdownMenuGroup>
        </React.Fragment>)}
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
