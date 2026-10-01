export const APPLICATION_STAGES = [
  "APPLIED",
  "REVIEW",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "CLOSED",
] as const;

export type ApplicationStageValue = (typeof APPLICATION_STAGES)[number];

export const APPLICATION_DISPOSITIONS = [
  "ACTIVE",
  "HOLD",
  "REJECTED",
  "WITHDRAWN",
  "HIRED",
  "CANCELLED",
] as const;

export type ApplicationDispositionValue =
  (typeof APPLICATION_DISPOSITIONS)[number];

export const TERMINAL_DISPOSITIONS = [
  "REJECTED",
  "WITHDRAWN",
  "HIRED",
  "CANCELLED",
] as const satisfies readonly ApplicationDispositionValue[];

export type TerminalApplicationDisposition =
  (typeof TERMINAL_DISPOSITIONS)[number];

export type CanonicalApplicationState = {
  stage: ApplicationStageValue;
  disposition: ApplicationDispositionValue;
};

export type ApplicationTransitionClass =
  | "NORMAL"
  | "FORWARD_SKIP"
  | "BACKWARD"
  | "DISPOSITION_ONLY";

export type PlannedApplicationTransition = CanonicalApplicationState & {
  transitionClass: ApplicationTransitionClass;
};

export const APPLICATION_EVENT_TYPES = [
  "APPLICATION_STAGE_CHANGED",
  "APPLICATION_DISPOSITION_CHANGED",
  "CANDIDATE_REJECTED",
  "CANDIDATE_WITHDREW",
  "CANDIDATE_HIRED",
  "PROCESS_CANCELLED",
  "LEGACY_STATE_IMPORTED",
] as const;

export type ApplicationEventTypeValue =
  (typeof APPLICATION_EVENT_TYPES)[number];

export type ApplicationEventVisibilityValue = "INTERNAL" | "CANDIDATE" | "BOTH";

export type ApplicationActorTypeValue =
  | "CANDIDATE"
  | "RECRUITER"
  | "ADMIN"
  | "SYSTEM"
  | "IMPORT";
