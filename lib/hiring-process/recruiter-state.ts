import { APPLICATION_STAGES, type CanonicalApplicationState } from "./types";

/** Recruiter destinations, distinct from preselection and assessment progress. */
export const RECRUITING_STATES = ["APPLIED", "REVIEW", "INTERVIEW", "OFFER", "REJECTED", "HIRED", "HOLD", "WITHDRAWN", "CANCELLED"] as const;
export type RecruitingState = typeof RECRUITING_STATES[number];
export const RECRUITING_STATE_LABELS: Record<RecruitingState, string> = {
  APPLIED: "Por revisar", REVIEW: "En revisión", INTERVIEW: "Entrevista", OFFER: "Oferta",
  REJECTED: "Descartado", HIRED: "Contratado", HOLD: "En pausa", WITHDRAWN: "Retirado", CANCELLED: "Cancelado",
};
export const CLOSURE_CONFIRMATIONS: Partial<Record<RecruitingState, string>> = {
  REJECTED: "Descartar candidato", HIRED: "Contratar candidato", WITHDRAWN: "Retirar candidato", CANCELLED: "Cancelar proceso",
};
export function recruitingStateTarget(current: CanonicalApplicationState, destination: RecruitingState): CanonicalApplicationState {
  if (["REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"].includes(destination)) {
    return { stage: "CLOSED", disposition: destination as "REJECTED" | "HIRED" | "WITHDRAWN" | "CANCELLED" };
  }
  if (destination === "HOLD") return { stage: current.stage === "CLOSED" ? "REVIEW" : current.stage, disposition: "HOLD" };
  return { stage: destination as "APPLIED" | "REVIEW" | "INTERVIEW" | "OFFER", disposition: "ACTIVE" };
}
export function recruitingStateRequirements(current: CanonicalApplicationState, destination: RecruitingState) {
  const target = recruitingStateTarget(current, destination);
  const reopening = current.stage === "CLOSED";
  const backward = target.disposition === "ACTIVE" &&
    APPLICATION_STAGES.indexOf(target.stage) < APPLICATION_STAGES.indexOf(current.stage);
  return { requiresReason: reopening || backward, requiresConfirmation: reopening || Boolean(CLOSURE_CONFIRMATIONS[destination]) };
}
