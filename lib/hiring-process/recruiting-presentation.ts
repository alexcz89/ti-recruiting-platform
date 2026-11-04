import { getRecruiterApplicationReadModel, type RecruiterApplicationReadInput } from "./recruiter-read-model";
import { LEGACY_APPLICATION_STATE_MATRIX, projectCanonicalStateToLegacy } from "./legacy-mapping";
import { canStartReview } from "./start-review-eligibility";
import { RECRUITING_STATES, RECRUITING_STATE_LABELS, recruitingStateRequirements, type RecruitingState } from "./recruiter-state";
export const ACTIVE_PIPELINE = ["APPLIED", "REVIEW", "INTERVIEW", "OFFER"] as const;
/** Recruiter UI destinations; persisted stages and domain validation remain unchanged. */
export const RECRUITER_PIPELINE = ["APPLIED", "REVIEW", "INTERVIEW", "HIRED", "REJECTED"] as const;
export type RecruiterPipelineState = typeof RECRUITER_PIPELINE[number];
export const RECRUITER_PIPELINE_STATE_LABELS: Record<RecruiterPipelineState, string> = {
    APPLIED: "Por revisar", REVIEW: "En revisión", INTERVIEW: "Entrevista", HIRED: "Contratado", REJECTED: "Descartado",
};
export const FINALIZED_OUTCOMES = [
    { key: "HIRED", label: "Contratados" }, { key: "REJECTED", label: "Descartados" },
    { key: "WITHDRAWN", label: "Retirados" }, { key: "CANCELLED", label: "Cancelados" },
] as const;
export const PIPELINE_LABELS: Record<string, string> = { APPLIED: "Por revisar", REVIEW: "En revisión", INTERVIEW: "Entrevista", OFFER: "Oferta", REJECTED: "Descartado", HIRED: "Contratado", WITHDRAWN: "Retirado", CANCELLED: "Cancelado", OTHER: "Otros cierres" };
export type PresentationSource = RecruiterApplicationReadInput & {
    stateVersion: number;
    hiredAt?: Date | string | null;
    rejectedAt?: Date | string | null;
    rejectionEmailSent?: boolean;
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
    if (presentation.section === "RECONCILIATION" || presentation.outcome === "HIRED") return [];
    const legacy = input.stage === null ? LEGACY_APPLICATION_STATE_MATRIX.find(m => m.status === input.status && m.recruiterInterest === input.recruiterInterest) : null;
    const stage = input.stage ?? legacy?.suggestedStage;
    const disposition = input.disposition ?? legacy?.suggestedDisposition;
    if (!stage || !disposition) return [];
    const current = presentation.section === "ACTIVE" ? presentation.column : presentation.section === "CLOSED" ? presentation.outcome : "HOLD";
    return RECRUITING_STATES.map(destination => ({ label: RECRUITING_STATE_LABELS[destination], intent: "SET_RECRUITING_STATE",
        destination, current: destination === current, ...recruitingStateRequirements({ stage, disposition }, destination) }));
}

export type RecruiterPipelinePresentation = RecruitingPresentation & {
    pipelineState: RecruiterPipelineState | null;
    paused: boolean;
    integrityIssue: boolean;
};

/** UI-only projection. Never use this simplified view for writes, audit or notifications. */
export function getRecruiterPipelinePresentation(input: PresentationSource, reads: boolean): RecruiterPipelinePresentation {
    const original = getRecruitingPresentation(input, reads);
    let integrityIssue = original.section === "RECONCILIATION" || !Number.isInteger(input.stateVersion) || input.stateVersion < 0;
    if (input.stage && input.disposition) {
        const expected = projectCanonicalStateToLegacy({ stage: input.stage, disposition: input.disposition === "HOLD" ? "ACTIVE" : input.disposition });
        if (expected && (expected.status !== input.status || (expected.recruiterInterest !== input.recruiterInterest && !(input.stage === "REVIEW" && input.recruiterInterest === "MAYBE")))) integrityIssue = true;
    }
    if ((original.section === "ACTIVE" || original.section === "HOLD") && (input.hiredAt || input.rejectedAt || input.rejectionEmailSent || input.status === "HIRED" || input.status === "REJECTED" || input.recruiterInterest === "REJECTED")) integrityIssue = true;
    // Other closures retain their prior legacy projection, but cannot retain a hiring footprint.
    if (original.section === "CLOSED" && original.outcome !== "HIRED" && (input.status === "HIRED" || input.hiredAt)) integrityIssue = true;
    const underlying = original.section === "HOLD" ? input.stage : original.column;
    const pipelineState: RecruiterPipelineState | null = integrityIssue ? null
        : original.section === "CLOSED" ? original.outcome === "HIRED" ? "HIRED" : "REJECTED"
        : underlying === "OFFER" || underlying === "INTERVIEW" ? "INTERVIEW"
        : underlying === "REVIEW" || underlying === "ASSESSMENT" ? "REVIEW"
        : underlying === "APPLIED" ? "APPLIED" : null;
    return { ...original, pipelineState, label: pipelineState ? RECRUITER_PIPELINE_STATE_LABELS[pipelineState] : "—",
        paused: original.section === "HOLD", integrityIssue: integrityIssue || pipelineState === null };
}

export type RecruiterPipelineOption = RecruiterStageOption & {
    pipelineState: RecruiterPipelineState;
    disabled: boolean;
    resumesPaused: boolean;
};

/** A UI subset of existing commands, retaining requirements from the persisted source. */
export function getRecruiterPipelineOptions(input: PresentationSource, reads: boolean): RecruiterPipelineOption[] {
    const presentation = getRecruiterPipelinePresentation(input, reads);
    if (presentation.integrityIssue) return [];
    const options = getRecruiterStageOptions(input, reads);
    return RECRUITER_PIPELINE.flatMap(pipelineState => {
        // Resuming an existing OFFER retains OFFER internally; it is still Entrevista visually.
        const resume = presentation.paused && presentation.pipelineState === pipelineState
            ? options.find(option => option.destination === input.stage) : undefined;
        const option = resume ?? options.find(option => option.destination === pipelineState);
        if (!option) return [];
        const current = pipelineState === presentation.pipelineState;
        return [{ ...option, pipelineState, label: RECRUITER_PIPELINE_STATE_LABELS[pipelineState], current,
            disabled: current && !presentation.paused, resumesPaused: Boolean(resume) }];
    });
}

/** Keep legacy links usable without exposing their internal buckets as UI stages. */
export function resolveRecruiterPipelineFilterKey(value?: string | null, outcome?: string): RecruiterPipelineState | undefined {
    if (value && (RECRUITER_PIPELINE as readonly string[]).includes(value)) return value as RecruiterPipelineState;
    if (value === "OFFER") return "INTERVIEW";
    if (value === "ASSESSMENT" || value === "PRESELECTED") return "REVIEW";
    if (value === "WITHDRAWN" || value === "CANCELLED") return "REJECTED";
    if (value === "CLOSED") return outcome === "HIRED" ? "HIRED" : outcome && ["REJECTED", "WITHDRAWN", "CANCELLED"].includes(outcome) ? "REJECTED" : undefined;
    return undefined;
}
