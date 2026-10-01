import { describe, expect, it } from "vitest";

import {
  InvalidApplicationTransitionError,
  planApplicationTransition,
} from "@/lib/hiring-process/rules";

describe("canonical hiring process transition rules", () => {
  it.each([
    ["APPLIED", "REVIEW"],
    ["REVIEW", "ASSESSMENT"],
    ["REVIEW", "INTERVIEW"],
    ["ASSESSMENT", "INTERVIEW"],
    ["INTERVIEW", "OFFER"],
  ] as const)("allows %s → %s", (fromStage, targetStage) => {
    expect(
      planApplicationTransition(
        { stage: fromStage, disposition: "ACTIVE" },
        { targetStage },
      ),
    ).toMatchObject({
      stage: targetStage,
      disposition: "ACTIVE",
    });
  });

  it("allows a forward skip and records it as such", () => {
    expect(
      planApplicationTransition(
        { stage: "APPLIED", disposition: "ACTIVE" },
        { targetStage: "INTERVIEW" },
      ),
    ).toEqual({
      stage: "INTERVIEW",
      disposition: "ACTIVE",
      transitionClass: "FORWARD_SKIP",
    });
  });

  it("rejects a backward transition without an explicit reason", () => {
    expect(() =>
      planApplicationTransition(
        { stage: "INTERVIEW", disposition: "ACTIVE" },
        { targetStage: "REVIEW" },
      ),
    ).toThrow(InvalidApplicationTransitionError);
  });

  it("allows a backward transition with a reason", () => {
    expect(
      planApplicationTransition(
        { stage: "OFFER", disposition: "ACTIVE" },
        { targetStage: "INTERVIEW", reasonCode: "OFFER_REWORK" },
      ),
    ).toEqual({
      stage: "INTERVIEW",
      disposition: "ACTIVE",
      transitionClass: "BACKWARD",
    });
  });

  it("puts an application on hold without changing its stage", () => {
    expect(
      planApplicationTransition(
        { stage: "INTERVIEW", disposition: "ACTIVE" },
        { targetDisposition: "HOLD" },
      ),
    ).toEqual({
      stage: "INTERVIEW",
      disposition: "HOLD",
      transitionClass: "DISPOSITION_ONLY",
    });
  });

  it("reactivates a held application at the same stage", () => {
    expect(
      planApplicationTransition(
        { stage: "INTERVIEW", disposition: "HOLD" },
        { targetDisposition: "ACTIVE" },
      ),
    ).toMatchObject({ stage: "INTERVIEW", disposition: "ACTIVE" });
  });

  it("rejects changing stage in the same command that resumes HOLD", () => {
    expect(() =>
      planApplicationTransition(
        { stage: "INTERVIEW", disposition: "HOLD" },
        { targetStage: "OFFER", targetDisposition: "ACTIVE" },
      ),
    ).toThrow("Reanudar desde HOLD conserva la etapa actual");
  });

  it("does not treat discarded free text as an auditable backward reason", () => {
    expect(() =>
      planApplicationTransition(
        { stage: "INTERVIEW", disposition: "ACTIVE" },
        { targetStage: "REVIEW", reasonText: "private note" },
      ),
    ).toThrow("requieren una razón explícita");
  });

  it("rejects moving stage while applying HOLD", () => {
    expect(() =>
      planApplicationTransition(
        { stage: "REVIEW", disposition: "ACTIVE" },
        { targetStage: "INTERVIEW", targetDisposition: "HOLD" },
      ),
    ).toThrow("HOLD conserva la etapa actual");
  });

  it.each(["ACTIVE", "HOLD"] as const)(
    "rejects CLOSED + %s",
    (targetDisposition) => {
      expect(() =>
        planApplicationTransition(
          { stage: "OFFER", disposition: "ACTIVE" },
          { targetStage: "CLOSED", targetDisposition },
        ),
      ).toThrow(InvalidApplicationTransitionError);
    },
  );

  it.each(["REJECTED", "WITHDRAWN", "HIRED", "CANCELLED"] as const)(
    "%s forces CLOSED",
    (targetDisposition) => {
      expect(
        planApplicationTransition(
          { stage: "INTERVIEW", disposition: "ACTIVE" },
          { targetDisposition },
        ),
      ).toMatchObject({ stage: "CLOSED", disposition: targetDisposition });
    },
  );

  it("keeps CANCELLED semantically distinct from REJECTED", () => {
    const cancelled = planApplicationTransition(
      { stage: "REVIEW", disposition: "ACTIVE" },
      { targetDisposition: "CANCELLED" },
    );
    const rejected = planApplicationTransition(
      { stage: "REVIEW", disposition: "ACTIVE" },
      { targetDisposition: "REJECTED" },
    );

    expect(cancelled.disposition).toBe("CANCELLED");
    expect(rejected.disposition).toBe("REJECTED");
    expect(cancelled).not.toEqual(rejected);
  });

  it("represents an offer declined as CLOSED + WITHDRAWN with its reason", () => {
    expect(
      planApplicationTransition(
        { stage: "OFFER", disposition: "ACTIVE" },
        { targetDisposition: "WITHDRAWN", reasonCode: "OFFER_DECLINED" },
      ),
    ).toMatchObject({ stage: "CLOSED", disposition: "WITHDRAWN" });
  });

  it("rejects ordinary transitions out of a terminal state", () => {
    expect(() =>
      planApplicationTransition(
        { stage: "CLOSED", disposition: "REJECTED" },
        { targetStage: "REVIEW", targetDisposition: "ACTIVE", reasonCode: "REOPEN" },
      ),
    ).toThrow("REOPEN está fuera de este slice");
  });

  it("rejects a transition that changes nothing", () => {
    expect(() =>
      planApplicationTransition(
        { stage: "REVIEW", disposition: "ACTIVE" },
        { targetStage: "REVIEW" },
      ),
    ).toThrow("La transición no cambia el estado");
  });
});
