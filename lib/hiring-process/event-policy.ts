import type {
  ApplicationDispositionValue,
  ApplicationEventTypeValue,
  ApplicationEventVisibilityValue,
  ApplicationStageValue,
} from "./types";

const EVENT_VISIBILITY_POLICY: Readonly<
  Partial<Record<ApplicationEventTypeValue, ApplicationEventVisibilityValue>>
> = {
  APPLICATION_STAGE_CHANGED: "INTERNAL",
  APPLICATION_DISPOSITION_CHANGED: "INTERNAL",
  CANDIDATE_REJECTED: "BOTH",
  CANDIDATE_WITHDREW: "BOTH",
  CANDIDATE_HIRED: "BOTH",
  PROCESS_CANCELLED: "BOTH",
  LEGACY_STATE_IMPORTED: "INTERNAL",
};

const CANDIDATE_VISIBLE_EVENT_TYPES = new Set<ApplicationEventTypeValue>([
  "CANDIDATE_REJECTED",
  "CANDIDATE_WITHDREW",
  "CANDIDATE_HIRED",
  "PROCESS_CANCELLED",
]);

export function applicationEventVisibility(
  type: string,
): ApplicationEventVisibilityValue {
  return EVENT_VISIBILITY_POLICY[type as ApplicationEventTypeValue] ?? "INTERNAL";
}
export function eventTypeForTransition(
  fromStage: ApplicationStageValue,
  toStage: ApplicationStageValue,
  toDisposition: ApplicationDispositionValue,
): ApplicationEventTypeValue {
  if (toStage === "CLOSED") {
    switch (toDisposition) {
      case "REJECTED":
        return "CANDIDATE_REJECTED";
      case "WITHDRAWN":
        return "CANDIDATE_WITHDREW";
      case "HIRED":
        return "CANDIDATE_HIRED";
      case "CANCELLED":
        return "PROCESS_CANCELLED";
      default:
        break;
    }
  }

  return fromStage === toStage
    ? "APPLICATION_DISPOSITION_CHANGED"
    : "APPLICATION_STAGE_CHANGED";
}

type CandidateEventInput = {
  id: string;
  type: ApplicationEventTypeValue;
  visibility: ApplicationEventVisibilityValue;
  happenedAt: Date;
  fromStage: ApplicationStageValue | null;
  toStage: ApplicationStageValue | null;
  fromDisposition: ApplicationDispositionValue | null;
  toDisposition: ApplicationDispositionValue | null;
  reasonCode: string | null;
  metadata: unknown;
};

export function serializeCandidateApplicationEvent(event: CandidateEventInput) {
  if (
    (event.visibility !== "CANDIDATE" && event.visibility !== "BOTH") ||
    !CANDIDATE_VISIBLE_EVENT_TYPES.has(event.type)
  ) {
    return null;
  }

  return {
    id: event.id,
    type: event.type,
    happenedAt: event.happenedAt.toISOString(),
    stage: event.toStage,
    disposition: event.toDisposition,
  };
}
