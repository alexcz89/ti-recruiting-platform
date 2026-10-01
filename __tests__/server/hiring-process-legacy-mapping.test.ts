import { describe, expect, it } from "vitest";

import {
  classifyLegacyApplicationState,
  LEGACY_APPLICATION_STATE_MATRIX,
  projectCanonicalStateToLegacy,
} from "@/lib/hiring-process/legacy-mapping";
import {
  buildApplicationDivergenceReport,
  collectApplicationDivergenceReport,
} from "@/lib/hiring-process/divergence-report";

describe("legacy application state mapping", () => {
  it("defines all 24 status/interest combinations", () => {
    expect(LEGACY_APPLICATION_STATE_MATRIX).toHaveLength(24);
    expect(new Set(LEGACY_APPLICATION_STATE_MATRIX.map((entry) => entry.key)).size).toBe(
      24,
    );
  });

  it("keeps the approved classification distribution", () => {
    const counts = LEGACY_APPLICATION_STATE_MATRIX.reduce<Record<string, number>>(
      (result, entry) => {
        result[entry.classification] = (result[entry.classification] ?? 0) + 1;
        return result;
      },
      {},
    );

    expect(counts).toEqual({
      SAFE_AUTO_MAP: 7,
      LIKELY_REVIEW: 5,
      AMBIGUOUS: 4,
      CONTRADICTORY: 8,
    });
  });

  it("auto-maps only a safe legacy pair", () => {
    expect(classifyLegacyApplicationState("SUBMITTED", "REVIEW")).toMatchObject({
      classification: "SAFE_AUTO_MAP",
      suggestedStage: "APPLIED",
      suggestedDisposition: "ACTIVE",
      autoApplicable: true,
    });
  });

  it("does not auto-apply an ambiguous pair", () => {
    expect(classifyLegacyApplicationState("REVIEWING", "ACCEPTED")).toMatchObject({
      classification: "AMBIGUOUS",
      suggestedStage: null,
      suggestedDisposition: null,
      autoApplicable: false,
    });
  });

  it("projects canonical state to legacy only where the mapping is safe", () => {
    expect(projectCanonicalStateToLegacy({ stage: "INTERVIEW", disposition: "ACTIVE" })).toEqual(
      { status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
    );
    expect(projectCanonicalStateToLegacy({ stage: "ASSESSMENT", disposition: "ACTIVE" })).toBeNull();
    expect(projectCanonicalStateToLegacy({ stage: "CLOSED", disposition: "CANCELLED" })).toBeNull();
  });
});

describe("read-only divergence report", () => {
  it("reports counts and review requirements without mutating its input", () => {
    const rows = Object.freeze([
      Object.freeze({ status: "SUBMITTED" as const, recruiterInterest: "REVIEW" as const, count: 4 }),
      Object.freeze({ status: "REVIEWING" as const, recruiterInterest: "ACCEPTED" as const, count: 2 }),
      Object.freeze({ status: "REJECTED" as const, recruiterInterest: "REVIEW" as const, count: 1 }),
    ]);

    const report = buildApplicationDivergenceReport(rows);

    expect(report.totalApplications).toBe(7);
    expect(report.totalRequiresReview).toBe(3);
    expect(report.rows).toHaveLength(24);
    expect(report.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "SUBMITTED",
          recruiterInterest: "REVIEW",
          count: 4,
          classification: "SAFE_AUTO_MAP",
          requiresReview: false,
        }),
        expect.objectContaining({
          status: "REVIEWING",
          recruiterInterest: "ACCEPTED",
          count: 2,
          classification: "AMBIGUOUS",
          requiresReview: true,
        }),
        expect.objectContaining({
          status: "REJECTED",
          recruiterInterest: "REVIEW",
          count: 1,
          classification: "CONTRADICTORY",
          requiresReview: true,
        }),
      ]),
    );
    expect(rows[0]).toEqual({ status: "SUBMITTED", recruiterInterest: "REVIEW", count: 4 });
  });

  it("collects the report through a read-only aggregate interface", async () => {
    const calls: unknown[] = [];
    const report = await collectApplicationDivergenceReport({
      groupBy: async (query) => {
        calls.push(query);
        return [
          {
            status: "OFFER",
            recruiterInterest: "MAYBE",
            _count: { _all: 3 },
          },
        ];
      },
    });

    expect(calls).toEqual([
      {
        by: ["status", "recruiterInterest"],
        _count: { _all: true },
        orderBy: [{ status: "asc" }, { recruiterInterest: "asc" }],
      },
    ]);
    expect(report).toMatchObject({
      totalApplications: 3,
      totalRequiresReview: 3,
    });
    expect(report.rows).toHaveLength(24);
    expect(report.rows).toContainEqual(
      expect.objectContaining({
        status: "OFFER",
        recruiterInterest: "MAYBE",
        count: 3,
        classification: "AMBIGUOUS",
      }),
    );
  });
});
