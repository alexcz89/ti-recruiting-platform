import { describe, expect, it } from "vitest";

import {
  buildCandidateApplicationReadRows,
  countCandidateProcessBuckets,
  filterCandidateProcessRows,
  resolveCandidateProcessFilter,
} from "@/lib/hiring-process/candidate-read-model";

const mixedCohort = [
  {
    id: "canonical-v0",
    stage: "APPLIED",
    disposition: "ACTIVE",
    stateVersion: 0,
    status: "INTERVIEW",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "review",
    stage: "REVIEW",
    disposition: "ACTIVE",
    stateVersion: 2,
    status: "OFFER",
    recruiterInterest: "MAYBE",
  },
  {
    id: "assessment",
    stage: "ASSESSMENT",
    disposition: "ACTIVE",
    stateVersion: 3,
    status: "HIRED",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "interview",
    stage: "INTERVIEW",
    disposition: "ACTIVE",
    stateVersion: 4,
    status: "REJECTED",
    recruiterInterest: "REJECTED",
  },
  {
    id: "offer",
    stage: "OFFER",
    disposition: "ACTIVE",
    stateVersion: 5,
    status: "SUBMITTED",
    recruiterInterest: "REVIEW",
  },
  {
    id: "rejected",
    stage: "CLOSED",
    disposition: "REJECTED",
    stateVersion: 6,
    status: "OFFER",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "hired",
    stage: "CLOSED",
    disposition: "HIRED",
    stateVersion: 7,
    status: "REVIEWING",
    recruiterInterest: "REVIEW",
  },
  {
    id: "withdrawn",
    stage: "CLOSED",
    disposition: "WITHDRAWN",
    stateVersion: 8,
    status: "INTERVIEW",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "cancelled",
    stage: "CLOSED",
    disposition: "CANCELLED",
    stateVersion: 9,
    status: "HIRED",
    recruiterInterest: "MAYBE",
  },
  {
    id: "hold",
    stage: "INTERVIEW",
    disposition: "HOLD",
    stateVersion: 10,
    status: "SUBMITTED",
    recruiterInterest: "MAYBE",
  },
  {
    id: "legacy",
    stage: null,
    disposition: null,
    stateVersion: 0,
    status: "OFFER",
    recruiterInterest: "REVIEW",
  },
  {
    id: "partial",
    stage: "OFFER",
    disposition: null,
    stateVersion: 0,
    status: "REJECTED",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "invalid-complete",
    stage: "APPLIED",
    disposition: "HIRED",
    stateVersion: 1,
    status: "SUBMITTED",
    recruiterInterest: "REVIEW",
  },
] as const;

describe("candidate reader OFF -> ON -> OFF cutover", () => {
  it("changes presentation only and restores the exact legacy result", () => {
    const original = structuredClone(mixedCohort);
    const offBefore = buildCandidateApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: false,
    });
    const on = buildCandidateApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: true,
    });
    const offAfter = buildCandidateApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: false,
    });

    expect(offAfter.map((row) => row._candidateRead)).toEqual(
      offBefore.map((row) => row._candidateRead),
    );
    expect(mixedCohort).toEqual(original);
    expect(
      on.map((row) => [
        row.id,
        row._candidateRead.bucket,
        row._candidateRead.source,
      ]),
    ).toEqual([
      ["canonical-v0", "RECEIVED", "CANONICAL"],
      ["review", "REVIEWING", "CANONICAL"],
      ["assessment", "ASSESSMENT", "CANONICAL"],
      ["interview", "INTERVIEW", "CANONICAL"],
      ["offer", "DECISION", "CANONICAL"],
      ["rejected", "CLOSED", "CANONICAL"],
      ["hired", "CLOSED", "CANONICAL"],
      ["withdrawn", "CLOSED", "CANONICAL"],
      ["cancelled", "CLOSED", "CANONICAL"],
      ["hold", "INTERVIEW", "CANONICAL"],
      ["legacy", "DECISION", "LEGACY_FALLBACK"],
      ["partial", "CLOSED", "LEGACY_FALLBACK"],
      ["invalid-complete", "CLOSED", "CANONICAL"],
    ]);
  });

  it("keeps counts complete and active/closed classification stable", () => {
    const rows = buildCandidateApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: true,
    });
    const counts = countCandidateProcessBuckets(rows);

    expect(counts).toEqual({
      RECEIVED: 1,
      REVIEWING: 1,
      ASSESSMENT: 1,
      INTERVIEW: 2,
      DECISION: 2,
      CLOSED: 6,
    });
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(
      mixedCohort.length,
    );
    expect(
      rows.filter((row) => row._candidateRead.bucket !== "CLOSED"),
    ).toHaveLength(7);
    expect(
      rows.filter((row) => row._candidateRead.bucket === "CLOSED"),
    ).toHaveLength(6);
  });

  it("keeps canonical labels candidate-safe despite internal or stale fields", () => {
    const rows = buildCandidateApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: true,
    });
    const canonicalLabels = rows
      .filter((row) => row._candidateRead.source === "CANONICAL")
      .map((row) => row._candidateRead.label);

    expect(canonicalLabels).toContain("Decisión");
    expect(
      canonicalLabels.filter((label) => label === "Proceso cerrado"),
    ).toHaveLength(5);
    expect(canonicalLabels).not.toContain("En pausa");
    expect(canonicalLabels).not.toContain("Preselecto");
    expect(canonicalLabels).not.toContain("Rechazada");
    expect(canonicalLabels).not.toContain("Contratado");
  });

  it("keeps legacy URL compatibility conservative without overriding canonical authority", () => {
    const rows = buildCandidateApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: true,
    });
    const offerFilter = resolveCandidateProcessFilter({ status: "OFFER" });
    const hiredFilter = resolveCandidateProcessFilter({ status: "HIRED" });

    expect(offerFilter).toEqual({ bucket: "DECISION" });
    expect(
      filterCandidateProcessRows(rows, offerFilter).map((row) => row.id),
    ).toEqual(["offer", "legacy"]);
    expect(
      filterCandidateProcessRows(rows, hiredFilter).map((row) => row.id),
    ).toEqual(["hired", "invalid-complete"]);
  });
});
