import type { CanonicalApplicationState } from "./types";

export const LEGACY_APPLICATION_STATUSES = [
  "SUBMITTED",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "HIRED",
] as const;

export const LEGACY_APPLICATION_INTERESTS = [
  "REVIEW",
  "MAYBE",
  "ACCEPTED",
  "REJECTED",
] as const;

export type LegacyApplicationStatus =
  (typeof LEGACY_APPLICATION_STATUSES)[number];
export type LegacyApplicationInterest =
  (typeof LEGACY_APPLICATION_INTERESTS)[number];
export type LegacyMappingClassification =
  | "SAFE_AUTO_MAP"
  | "LIKELY_REVIEW"
  | "AMBIGUOUS"
  | "CONTRADICTORY";

export type LegacyApplicationStateMapping = {
  key: `${LegacyApplicationStatus}:${LegacyApplicationInterest}`;
  status: LegacyApplicationStatus;
  recruiterInterest: LegacyApplicationInterest;
  classification: LegacyMappingClassification;
  suggestedStage: CanonicalApplicationState["stage"] | null;
  suggestedDisposition: CanonicalApplicationState["disposition"] | null;
  autoApplicable: boolean;
  reason: string;
};

function entry(
  status: LegacyApplicationStatus,
  recruiterInterest: LegacyApplicationInterest,
  classification: LegacyMappingClassification,
  suggestedState: CanonicalApplicationState | null,
  reason: string,
): LegacyApplicationStateMapping {
  return {
    key: `${status}:${recruiterInterest}`,
    status,
    recruiterInterest,
    classification,
    suggestedStage: suggestedState?.stage ?? null,
    suggestedDisposition: suggestedState?.disposition ?? null,
    autoApplicable: classification === "SAFE_AUTO_MAP",
    reason,
  };
}
const safe = (
  status: LegacyApplicationStatus,
  interest: LegacyApplicationInterest,
  stage: CanonicalApplicationState["stage"],
  disposition: CanonicalApplicationState["disposition"],
) => entry(status, interest, "SAFE_AUTO_MAP", { stage, disposition }, "Correspondencia legacy determinista");

const likely = (
  status: LegacyApplicationStatus,
  interest: LegacyApplicationInterest,
  stage: CanonicalApplicationState["stage"],
  disposition: CanonicalApplicationState["disposition"],
) => entry(status, interest, "LIKELY_REVIEW", { stage, disposition }, "Mapping probable que requiere revisión");

const unresolved = (
  status: LegacyApplicationStatus,
  interest: LegacyApplicationInterest,
  classification: "AMBIGUOUS" | "CONTRADICTORY",
  reason: string,
) => entry(status, interest, classification, null, reason);

export const LEGACY_APPLICATION_STATE_MATRIX: readonly LegacyApplicationStateMapping[] = [
  safe("SUBMITTED", "REVIEW", "APPLIED", "ACTIVE"),
  likely("SUBMITTED", "MAYBE", "REVIEW", "ACTIVE"),
  unresolved("SUBMITTED", "ACCEPTED", "AMBIGUOUS", "ACCEPTED puede significar review, interview u offer"),
  unresolved("SUBMITTED", "REJECTED", "CONTRADICTORY", "Recruiter cerró mientras candidate sigue en submitted"),
  safe("REVIEWING", "REVIEW", "REVIEW", "ACTIVE"),
  safe("REVIEWING", "MAYBE", "REVIEW", "ACTIVE"),
  unresolved("REVIEWING", "ACCEPTED", "AMBIGUOUS", "Kanban usa este par para entrevista sin cambiar status"),
  unresolved("REVIEWING", "REJECTED", "CONTRADICTORY", "Interest terminal contradice status activo"),
  likely("INTERVIEW", "REVIEW", "INTERVIEW", "ACTIVE"),
  unresolved("INTERVIEW", "MAYBE", "AMBIGUOUS", "No distingue proceso activo de hold o dato stale"),
  safe("INTERVIEW", "ACCEPTED", "INTERVIEW", "ACTIVE"),
  unresolved("INTERVIEW", "REJECTED", "CONTRADICTORY", "Interest terminal contradice entrevista activa"),
  likely("OFFER", "REVIEW", "OFFER", "ACTIVE"),
  unresolved("OFFER", "MAYBE", "AMBIGUOUS", "No distingue oferta activa de hold o dato stale"),
  safe("OFFER", "ACCEPTED", "OFFER", "ACTIVE"),
  unresolved("OFFER", "REJECTED", "CONTRADICTORY", "Interest terminal contradice oferta activa"),
  unresolved("REJECTED", "REVIEW", "CONTRADICTORY", "Status terminal contradice interest de revisión"),
  unresolved("REJECTED", "MAYBE", "CONTRADICTORY", "Status terminal contradice interest maybe"),
  unresolved("REJECTED", "ACCEPTED", "CONTRADICTORY", "Status terminal contradice interest accepted"),
  safe("REJECTED", "REJECTED", "CLOSED", "REJECTED"),
  likely("HIRED", "REVIEW", "CLOSED", "HIRED"),
  likely("HIRED", "MAYBE", "CLOSED", "HIRED"),
  safe("HIRED", "ACCEPTED", "CLOSED", "HIRED"),
  unresolved("HIRED", "REJECTED", "CONTRADICTORY", "Contradice contratación y rechazo"),
];

const mappingByKey = new Map(
  LEGACY_APPLICATION_STATE_MATRIX.map((mapping) => [mapping.key, mapping]),
);

export function classifyLegacyApplicationState(
  status: LegacyApplicationStatus,
  recruiterInterest: LegacyApplicationInterest,
) {
  const mapping = mappingByKey.get(`${status}:${recruiterInterest}`);
  if (!mapping) {
    throw new Error(`Combinación legacy desconocida: ${status}/${recruiterInterest}`);
  }
  return mapping;
}

export function projectCanonicalStateToLegacy(
  state: CanonicalApplicationState,
): { status: LegacyApplicationStatus; recruiterInterest: LegacyApplicationInterest } | null {
  const key = `${state.stage}:${state.disposition}`;
  const safeProjections: Record<
    string,
    { status: LegacyApplicationStatus; recruiterInterest: LegacyApplicationInterest }
  > = {
    "APPLIED:ACTIVE": { status: "SUBMITTED", recruiterInterest: "REVIEW" },
    "REVIEW:ACTIVE": { status: "REVIEWING", recruiterInterest: "REVIEW" },
    "INTERVIEW:ACTIVE": { status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
    "OFFER:ACTIVE": { status: "OFFER", recruiterInterest: "ACCEPTED" },
    "CLOSED:REJECTED": { status: "REJECTED", recruiterInterest: "REJECTED" },
    "CLOSED:HIRED": { status: "HIRED", recruiterInterest: "ACCEPTED" },
  };

  return safeProjections[key] ?? null;
}
