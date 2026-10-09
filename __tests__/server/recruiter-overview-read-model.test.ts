import { describe, expect, it } from "vitest";

import {
  countActiveRecruiterPipelineApplications,
  countRecruiterPipelineGroupedRows,
  filterPendingRecruiterApplications,
  sumRecruiterPipelineCounts,
} from "@/lib/hiring-process/recruiter-read-model";

describe("recruiter overview canonical reads", () => {
  const groupedRows = [
    { stage: "APPLIED", disposition: "ACTIVE", recruiterInterest: "REVIEW", _count: { _all: 2 } },
    { stage: "REVIEW", disposition: "ACTIVE", recruiterInterest: "REVIEW", _count: { _all: 3 } },
    { stage: "REVIEW", disposition: "ACTIVE", recruiterInterest: "MAYBE", _count: { _all: 4 } },
    { stage: "ASSESSMENT", disposition: "ACTIVE", recruiterInterest: "REVIEW", _count: { _all: 5 } },
    { stage: "INTERVIEW", disposition: "ACTIVE", recruiterInterest: "REVIEW", _count: { _all: 6 } },
    { stage: "OFFER", disposition: "ACTIVE", recruiterInterest: "ACCEPTED", _count: { _all: 7 } },
    { stage: "CLOSED", disposition: "REJECTED", recruiterInterest: "REJECTED", _count: { _all: 8 } },
    { stage: "CLOSED", disposition: "HIRED", recruiterInterest: "ACCEPTED", _count: { _all: 9 } },
    { stage: "INTERVIEW", disposition: "HOLD", recruiterInterest: "ACCEPTED", _count: { _all: 10 } },
    { stage: "CLOSED", disposition: "WITHDRAWN", recruiterInterest: "REVIEW", _count: { _all: 11 } },
    { stage: null, disposition: null, recruiterInterest: "REVIEW", _count: { _all: 12 } },
    { stage: "INTERVIEW", disposition: null, recruiterInterest: "MAYBE", _count: { _all: 13 } },
  ] as const;

  it("aggregates canonical and fallback tuples without losing or double-counting rows", () => {
    const counts = countRecruiterPipelineGroupedRows(groupedRows, {
      canonicalReadsEnabled: true,
    });

    expect(counts).toMatchObject({
      APPLIED: 14,
      REVIEW: 3,
      PRESELECTED: 17,
      ASSESSMENT: 5,
      INTERVIEW: 6,
      OFFER: 7,
      REJECTED: 8,
      HIRED: 9,
      HOLD: 10,
      CLOSED_OTHER: 11,
    });
    expect(sumRecruiterPipelineCounts(counts)).toBe(90);
    expect(countActiveRecruiterPipelineApplications(counts)).toBe(62);
  });

  it("preserves legacy interest aggregation while the reader flag is off", () => {
    const counts = countRecruiterPipelineGroupedRows(groupedRows, {
      canonicalReadsEnabled: false,
    });

    expect(counts).toMatchObject({
      APPLIED: 39,
      PRESELECTED: 17,
      INTERVIEW: 26,
      REJECTED: 8,
      REVIEW: 0,
      OFFER: 0,
      HIRED: 0,
    });
    expect(sumRecruiterPipelineCounts(counts)).toBe(90);
    expect(countActiveRecruiterPipelineApplications(counts)).toBe(82);
  });

  it("selects only canonical APPLIED plus legacy-fallback REVIEW for pending", () => {
    const rows = [
      { id: "applied", stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "MAYBE" },
      { id: "canonical-review", stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW" },
      { id: "stale-interview", stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "REVIEW" },
      { id: "legacy-review", stage: null, disposition: null, status: "SUBMITTED", recruiterInterest: "REVIEW" },
      { id: "partial-review", stage: "REVIEW", disposition: null, status: "REVIEWING", recruiterInterest: "REVIEW" },
      { id: "legacy-maybe", stage: null, disposition: null, status: "REVIEWING", recruiterInterest: "MAYBE" },
    ] as const;

    expect(
      filterPendingRecruiterApplications(rows, { canonicalReadsEnabled: true }).map(
        (row) => row.id,
      ),
    ).toEqual(["applied", "legacy-review", "partial-review"]);
    expect(
      filterPendingRecruiterApplications(rows, { canonicalReadsEnabled: false }).map(
        (row) => row.id,
      ),
    ).toEqual([
      "canonical-review",
      "stale-interview",
      "legacy-review",
      "partial-review",
    ]);
  });
});
