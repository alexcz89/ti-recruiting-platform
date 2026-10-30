"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRecruitingPresentation, getRecruitingActions, type PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { toastError } from "@/lib/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";
const labels: Record<string, string> = { START_REVIEW: "Iniciar revisión", MARK_PRESELECTED: "Preseleccionar", CLEAR_PRESELECTED: "Quitar preselección", MOVE_TO_INTERVIEW: "Pasar a entrevista", MOVE_TO_OFFER: "Mover a oferta", REJECT_CANDIDATE: "Descartar" };
export default function InterestSelect({ applicationId, initial, initialStateVersion, legacyStatus = "", canonicalStage = null, canonicalDisposition = null, canonicalRecruiterReadsEnabled = false, candidateHref }: {
    applicationId: string;
    initial: InterestKey;
    initialStateVersion: number;
    legacyStatus?: string;
    canonicalStage?: ApplicationStageValue | null;
    canonicalDisposition?: ApplicationDispositionValue | null;
    canonicalRecruiterReadsEnabled?: boolean;
    candidateHref?: string;
}) {
    const router = useRouter();
    const [source, setSource] = useState<PresentationSource>({ stage: canonicalStage, disposition: canonicalDisposition, status: legacyStatus, recruiterInterest: initial, stateVersion: initialStateVersion });
    useEffect(() => { setSource({ stage: canonicalStage, disposition: canonicalDisposition, status: legacyStatus, recruiterInterest: initial, stateVersion: initialStateVersion }); }, [applicationId, initial, initialStateVersion, legacyStatus, canonicalStage, canonicalDisposition]);
    const [pending, setPending] = useState(false);
    const inFlight = useRef(false);
    const command = useRef<{
        intent: string;
        version: number;
        id: string;
    } | null>(null);
    const p = getRecruitingPresentation(source, canonicalRecruiterReadsEnabled);
    async function execute(intent: string) {
        if (!intent || inFlight.current || !getRecruitingActions(source, canonicalRecruiterReadsEnabled).includes(intent))
            return;
        inFlight.current = true;
        setPending(true);
        if (!command.current || command.current.intent !== intent || command.current.version !== source.stateVersion)
            command.current = { intent, version: source.stateVersion, id: crypto.randomUUID() };
        try {
            const response = await fetch(`/api/applications/${applicationId}/intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent, expectedVersion: source.stateVersion, commandId: command.current.id }) });
            if (!response.ok)
                throw new Error("Transition failed");
            const data = await response.json();
            setSource(data.application);
            router.refresh();
        }
        catch {
            toastError("No se pudo actualizar. Actualiza la página e intenta de nuevo.");
            router.refresh();
        }
        finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    const actions = getRecruitingActions(source, canonicalRecruiterReadsEnabled);
    const profileAction = candidateHref && (
      p.column === "INTERVIEW" ? "Retroceder en perfil" :
      p.column === "OFFER" ? "Contratar o retroceder en perfil" :
      p.section === "CLOSED" && p.outcome === "REJECTED" ? "Reabrir en perfil" : null
    );
    if (!actions.length && !profileAction) return null;
    return <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} aria-label="Acciones del proceso" className="min-h-9 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
        {pending ? "Actualizando…" : "Proceso ▾"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
        {actions.map((intent) => <DropdownMenuItem key={intent} onSelect={() => { void execute(intent); }} className="px-2.5 py-2 text-xs dark:text-zinc-100">
          {labels[intent]}
        </DropdownMenuItem>)}
        {profileAction && <DropdownMenuItem asChild className="px-2.5 py-2 text-xs dark:text-zinc-100"><a href={candidateHref}>{profileAction}</a></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>;
}
