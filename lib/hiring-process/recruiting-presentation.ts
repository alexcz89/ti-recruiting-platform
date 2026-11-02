import { getRecruiterApplicationReadModel, type RecruiterApplicationReadInput } from "./recruiter-read-model";
import { LEGACY_APPLICATION_STATE_MATRIX } from "./legacy-mapping";
import { canStartReview } from "./start-review-eligibility";
import { RECRUITING_STATES, RECRUITING_STATE_LABELS, recruitingStateRequirements, type RecruitingState } from "./recruiter-state";
export const ACTIVE_PIPELINE = ["APPLIED", "REVIEW", "INTERVIEW", "OFFER"] as const;
export const PIPELINE_LABELS: Record<string, string> = { APPLIED: "Por revisar", REVIEW: "En revisión", INTERVIEW: "Entrevista", OFFER: "Oferta", REJECTED: "Descartado", HIRED: "Contratado", WITHDRAWN: "Retirado", CANCELLED: "Cancelado", OTHER: "Otros cierres" };
export type PresentationSource = RecruiterApplicationReadInput & {
    stateVersion: number;
};
export type RecruitingPresentation = {
    section: "ACTIVE" | "CLOSED" | "HOLD" | "RECONCILIATION";
    column: string | null;
    outcome: string | null;
    label: string;
    preselected: boolean;
    assessmentStage: boolean;
};
export function getRecruitingPresentation(input: PresentationSource, canonicalReadsEnabled: boolean): RecruitingPresentation {
    const result: RecruitingPresentation = { section: "RECONCILIATION", column: null, outcome: null, label: "Requiere conciliación", preselected: false, assessmentStage: false };
    const complete = input.stage !== null && input.disposition !== null;
    if ((!complete && (input.stage !== null || input.disposition !== null || input.stateVersion !== 0)))
        return result;
    if (complete) {
        if (input.stage === "CLOSED") {
            if (!["REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"].includes(input.disposition!))
                return result;
            return { ...result, section: "CLOSED", outcome: input.disposition, label: PIPELINE_LABELS[input.disposition!] };
        }
        if (["REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"].includes(input.disposition!))
            return result;
        if (input.disposition === "HOLD")
            return { ...result, section: "HOLD", label: "En pausa" };
        if (input.status === "HIRED" || input.status === "REJECTED" || input.recruiterInterest === "REJECTED")
            return result;
        const compatible = input.stage === "APPLIED" ? input.status === "SUBMITTED" && input.recruiterInterest === "REVIEW"
            : input.stage === "REVIEW" ? input.status === "REVIEWING" && ["REVIEW", "MAYBE"].includes(input.recruiterInterest)
                : input.stage === "INTERVIEW" ? input.status === "INTERVIEW" && input.recruiterInterest === "ACCEPTED"
                    : input.stage === "OFFER" ? input.status === "OFFER" && input.recruiterInterest === "ACCEPTED"
                        : input.stage === "ASSESSMENT";
        if (!compatible)
            return result;
    }
    let bucket = getRecruiterApplicationReadModel(input, { canonicalReadsEnabled }).bucket;
    if (!complete || !canonicalReadsEnabled) {
        const mapping = LEGACY_APPLICATION_STATE_MATRIX.find((m) => m.status === input.status && m.recruiterInterest === input.recruiterInterest);
        if (!mapping?.autoApplicable)
            return result;
        if (mapping.suggestedStage === "CLOSED")
            return { ...result, section: "CLOSED", outcome: mapping.suggestedDisposition, label: PIPELINE_LABELS[mapping.suggestedDisposition!] };
        bucket = mapping.suggestedStage as typeof bucket;
    }
    const column = bucket === "PRESELECTED" || bucket === "ASSESSMENT" ? "REVIEW" : bucket;
    if (!(ACTIVE_PIPELINE as readonly string[]).includes(column))
        return result;
    return { ...result, section: "ACTIVE", column, label: PIPELINE_LABELS[column], preselected: input.recruiterInterest === "MAYBE", assessmentStage: input.stage === "ASSESSMENT" };
}
/** Presentation only; the existing intent writer remains the authorization boundary. */
export function getRecruitingActions(input: PresentationSource, reads: boolean) {
    const p = getRecruitingPresentation(input, reads);
    if (p.section !== "ACTIVE")
        return [];
    const actions: string[] = [];
    if (canStartReview(input))
        actions.push("START_REVIEW");
    if ((p.column === "APPLIED" || p.column === "REVIEW") && (input.stage === "APPLIED" || input.stage === "REVIEW" || input.stage === null))
        actions.push(p.preselected ? "CLEAR_PRESELECTED" : "MARK_PRESELECTED");
    if (p.column === "REVIEW")
        actions.push("MOVE_TO_INTERVIEW");
    if (p.column === "INTERVIEW")
        actions.push("MOVE_TO_OFFER");
    actions.push("REJECT_CANDIDATE");
    return actions;
}

export type RecruiterStageOption = {
    label: string;
    intent: "SET_RECRUITING_STATE";
    destination: RecruitingState;
    current: boolean;
    requiresReason: boolean;
    requiresConfirmation?: boolean;
};

/** Display choices only. The intent writer validates ownership, state and version again. */
export function getRecruiterStageOptions(input: PresentationSource, reads: boolean): RecruiterStageOption[] {
    const presentation = getRecruitingPresentation(input, reads);
    if (presentation.section === "RECONCILIATION") return [];
    const legacy = input.stage === null ? LEGACY_APPLICATION_STATE_MATRIX.find(m => m.status === input.status && m.recruiterInterest === input.recruiterInterest) : null;
    const stage = input.stage ?? legacy?.suggestedStage;
    const disposition = input.disposition ?? legacy?.suggestedDisposition;
    if (!stage || !disposition) return [];
    const current = presentation.section === "ACTIVE" ? presentation.column : presentation.section === "CLOSED" ? presentation.outcome : "HOLD";
    return RECRUITING_STATES.map(destination => ({ label: RECRUITING_STATE_LABELS[destination], intent: "SET_RECRUITING_STATE",
        destination, current: destination === current, ...recruitingStateRequirements({ stage, disposition }, destination) }));
}
