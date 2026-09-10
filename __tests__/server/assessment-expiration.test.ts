import { describe, expect, it } from "vitest";

import {
  assessmentState,
  attemptIsActive,
  isAssessmentExpired,
  inviteResendAction,
} from "@/lib/assessments/expiration";

const NOW = new Date("2026-09-09T12:00:00.000Z");

describe("assessment expiration policy", () => {
  it("treats the exact deadline as expired and null as no deadline", () => {
    expect(isAssessmentExpired(NOW, NOW)).toBe(true);
    expect(isAssessmentExpired(null, NOW)).toBe(false);
  });

  it("keeps an attempt started before invite expiry authoritative until its own deadline", () => {
    expect(
      assessmentState(
        { status: "STARTED", expiresAt: new Date("2026-09-09T11:00:00.000Z") },
        {
          status: "IN_PROGRESS",
          expiresAt: new Date("2026-09-09T12:30:00.000Z"),
        },
        NOW
      )
    ).toBe("IN_PROGRESS");
  });

  it("reports explicit expired and cancelled states", () => {
    expect(
      assessmentState(
        { status: "SENT", expiresAt: new Date("2026-09-09T12:00:00.000Z") },
        null,
        NOW
      )
    ).toBe("EXPIRED");
    expect(
      assessmentState({ status: "CANCELLED", expiresAt: null }, null, NOW)
    ).toBe("CANCELLED");
  });

  it("keeps legacy attempts with null expiresAt active", () => {
    expect(
      attemptIsActive({ status: "IN_PROGRESS", expiresAt: null }, NOW)
    ).toBe(true);
    expect(
      assessmentState(
        { status: "STARTED", expiresAt: new Date("2026-09-01T00:00:00.000Z") },
        { status: "IN_PROGRESS", expiresAt: null },
        NOW
      )
    ).toBe("IN_PROGRESS");
  });

  it("lets final attempt status win regardless of its deadline", () => {
    expect(
      assessmentState(
        { status: "SUBMITTED", expiresAt: new Date("2026-09-01T00:00:00.000Z") },
        {
          status: "SUBMITTED",
          expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        NOW
      )
    ).toBe("COMPLETED");
  });

  it("preserves an active attempt when its expired invite is resent", () => {
    expect(
      inviteResendAction(
        { status: "STARTED", expiresAt: new Date("2026-09-01T00:00:00.000Z") },
        { hasActiveAttempt: true, hasLinkedAttempt: true },
        NOW
      )
    ).toBe("PRESERVE");
  });
});
