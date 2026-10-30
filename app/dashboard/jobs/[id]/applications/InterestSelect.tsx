"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StartReviewButton from "@/components/dashboard/StartReviewButton";
import { getRecruitingPresentation, getRecruitingActions, type PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
import type { ApplicationStageValue, ApplicationDispositionValue } from "@/lib/hiring-process/types";
import { toastError } from "@/lib/ui/toast";
type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";
const labels: Record<string, string> = { MARK_PRESELECTED: "Preseleccionar", CLEAR_PRESELECTED: "Quitar preselección", MOVE_TO_INTERVIEW: "Pasar a entrevista", MOVE_TO_OFFER: "Mover a oferta", REJECT_CANDIDATE: "Descartar" };
export default function InterestSelect({ applicationId, initial, initialStateVersion, legacyStatus = "", canonicalStage = null, canonicalDisposition = null, canonicalRecruiterReadsEnabled = false }: {
    applicationId: string;
    initial: InterestKey;
    initialStateVersion: number;
    legacyStatus?: string;
    canonicalStage?: ApplicationStageValue | null;
    canonicalDisposition?: ApplicationDispositionValue | null;
    canonicalRecruiterReadsEnabled?: boolean;
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
        if (!intent || inFlight.current)
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
    const actions = getRecruitingActions(source, canonicalRecruiterReadsEnabled).filter(a => a !== "START_REVIEW");
    return <div className="flex flex-col gap-1 text-xs">
    <span className="font-medium">{p.label}</span>
    {p.preselected && <span className="text-amber-700 dark:text-amber-300">Preselecto</span>}
    {p.assessmentStage && <span>Evaluación técnica</span>}
    {<StartReviewButton applicationId={applicationId} application={source} disabled={pending} onPendingChange={setPending} onSuccess={setSource}/>}
    {actions.length > 0 && <select aria-label="Acciones de candidatura" disabled={pending} value="" onChange={e => { void execute(e.target.value); }} className="min-h-11 max-w-full rounded-lg border bg-[rgb(var(--card))] px-2"><option value="">Acciones…</option>{actions.map(intent => <option key={intent} value={intent}>{labels[intent]}</option>)}</select>}
  </div>;
}
