import { describe, expect, it } from "vitest";

import {
  applicationEventVisibility,
  eventTypeForTransition,
  serializeCandidateApplicationEvent,
} from "@/lib/hiring-process/event-policy";

describe("application event policy", () => {
  it("defaults an unknown event type to INTERNAL", () => {
    expect(applicationEventVisibility("future_event_type")).toBe("INTERNAL");
  });

  it("uses distinct terminal event types", () => {
    expect(eventTypeForTransition("REVIEW", "CLOSED", "REJECTED")).toBe(
      "CANDIDATE_REJECTED",
    );
    expect(eventTypeForTransition("OFFER", "CLOSED", "WITHDRAWN")).toBe(
      "CANDIDATE_WITHDREW",
    );
    expect(eventTypeForTransition("OFFER", "CLOSED", "HIRED")).toBe(
      "CANDIDATE_HIRED",
    );
    expect(eventTypeForTransition("INTERVIEW", "CLOSED", "CANCELLED")).toBe(
      "PROCESS_CANCELLED",
    );
  });

  it("does not serialize INTERNAL events for a candidate", () => {
    expect(
      serializeCandidateApplicationEvent({
        id: "event-1",
        type: "APPLICATION_STAGE_CHANGED",
        visibility: "INTERNAL",
        happenedAt: new Date("2026-09-30T10:00:00.000Z"),
        fromStage: "REVIEW",
        toStage: "INTERVIEW",
        fromDisposition: "ACTIVE",
        toDisposition: "ACTIVE",
        reasonCode: "INTERNAL_REVIEW",
        metadata: { recruiterNotes: "private", score: 42 },
      }),
    ).toBeNull();
  });

  it("requires a candidate-visible event type even if visibility is misclassified", () => {
    expect(
      serializeCandidateApplicationEvent({
        id: "event-misclassified",
        type: "APPLICATION_STAGE_CHANGED",
        visibility: "BOTH",
        happenedAt: new Date("2026-09-30T10:00:00.000Z"),
        fromStage: "REVIEW",
        toStage: "INTERVIEW",
        fromDisposition: "ACTIVE",
        toDisposition: "ACTIVE",
        reasonCode: null,
        metadata: null,
      }),
    ).toBeNull();
  });

  it("allowlists candidate-visible fields and drops free metadata and internal rationale", () => {
    expect(
      serializeCandidateApplicationEvent({
        id: "event-2",
        type: "CANDIDATE_REJECTED",
        visibility: "BOTH",
        happenedAt: new Date("2026-09-30T10:00:00.000Z"),
        fromStage: "INTERVIEW",
        toStage: "CLOSED",
        fromDisposition: "ACTIVE",
        toDisposition: "REJECTED",
        reasonCode: "FAILED_INTERNAL_SCORE",
        metadata: {
          recruiterNotes: "sensitive",
          integritySignals: { tabSwitches: 4 },
          score: 42,
          cv: "raw cv",
        },
      }),
    ).toEqual({
      id: "event-2",
      type: "CANDIDATE_REJECTED",
      happenedAt: "2026-09-30T10:00:00.000Z",
      stage: "CLOSED",
      disposition: "REJECTED",
    });
  });
});
