import { describe, expect, it } from "vitest";

import {
  buildRecruiterApplicationReadRows,
  countRecruiterPipelineBuckets,
  filterPendingRecruiterApplications,
  getRecruiterApplicationReadModel,
  resolveRecruiterPipelineFilter,
} from "@/lib/hiring-process/recruiter-read-model";

const mixedCohort = [
  {
    id: "canonical-v0",
    jobId: "job-a",
    stage: "APPLIED",
    disposition: "ACTIVE",
    stateVersion: 0,
    status: "INTERVIEW",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "preselected",
    jobId: "job-a",
    stage: "REVIEW",
    disposition: "ACTIVE",
    stateVersion: 2,
    status: "REVIEWING",
    recruiterInterest: "MAYBE",
  },
  {
    id: "interview",
    jobId: "job-a",
    stage: "INTERVIEW",
    disposition: "ACTIVE",
    stateVersion: 3,
    status: "INTERVIEW",
    recruiterInterest: "REVIEW",
  },
  {
    id: "offer",
    jobId: "job-b",
    stage: "OFFER",
    disposition: "ACTIVE",
    stateVersion: 4,
    status: "OFFER",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "rejected",
    jobId: "job-b",
    stage: "CLOSED",
    disposition: "REJECTED",
    stateVersion: 5,
    status: "REJECTED",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "hired",
    jobId: "job-b",
    stage: "CLOSED",
    disposition: "HIRED",
    stateVersion: 6,
    status: "HIRED",
    recruiterInterest: "REVIEW",
  },
  {
    id: "hold",
    jobId: "job-c",
    stage: "INTERVIEW",
    disposition: "HOLD",
    stateVersion: 7,
    status: "INTERVIEW",
    recruiterInterest: "MAYBE",
  },
  {
    id: "closed-other",
    jobId: "job-c",
    stage: "CLOSED",
    disposition: "CANCELLED",
    stateVersion: 8,
    status: "REVIEWING",
    recruiterInterest: "REVIEW",
  },
  {
    id: "legacy",
    jobId: "job-c",
    stage: null,
    disposition: null,
    stateVersion: 0,
    status: "SUBMITTED",
    recruiterInterest: "REVIEW",
  },
  {
    id: "partial",
    jobId: "job-c",
    stage: "OFFER",
    disposition: null,
    stateVersion: 0,
    status: "INTERVIEW",
    recruiterInterest: "ACCEPTED",
  },
  {
    id: "invalid-complete",
    jobId: "job-c",
    stage: "CLOSED",
    disposition: "ACTIVE",
    stateVersion: 1,
    status: "SUBMITTED",
    recruiterInterest: "REVIEW",
  },
] as const;

describe("recruiter reader OFF -> ON -> OFF cutover", () => {
  it("changes only presentation for a mixed persisted cohort and restores legacy output", () => {
    const before = structuredClone(mixedCohort);
    const offBefore = buildRecruiterApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: false,
    });
    const on = buildRecruiterApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: true,
    });
    const offAfter = buildRecruiterApplicationReadRows(mixedCohort, {
      canonicalReadsEnabled: false,
    });

    expect(offAfter.map((row) => row._recruiterRead)).toEqual(
      offBefore.map((row) => row._recruiterRead),
    );
    expect(mixedCohort).toEqual(before);
    expect(
      on.map((row) => [
        row.id,
        row._recruiterRead.bucket,
        row._recruiterRead.source,
      ]),
    ).toEqual([
      ["canonical-v0", "APPLIED", "CANONICAL"],
      ["preselected", "PRESELECTED", "CANONICAL"],
      ["interview", "INTERVIEW", "CANONICAL"],
      ["offer", "OFFER", "CANONICAL"],
      ["rejected", "REJECTED", "CANONICAL"],
      ["hired", "HIRED", "CANONICAL"],
      ["hold", "HOLD", "CANONICAL"],
      ["closed-other", "CLOSED_OTHER", "CANONICAL"],
      ["legacy", "APPLIED", "LEGACY_FALLBACK"],
      ["partial", "INTERVIEW", "LEGACY_FALLBACK"],
      ["invalid-complete", "CLOSED_OTHER", "CANONICAL"],
    ]);
    expect(countRecruiterPipelineBuckets(on)).toMatchObject({
      APPLIED: 2,
      PRESELECTED: 1,
      INTERVIEW: 2,
      OFFER: 1,
      REJECTED: 1,
      HIRED: 1,
      HOLD: 1,
      CLOSED_OTHER: 2,
    });
  });

  it("uses canonical APPLIED plus fallback REVIEW for pending counts per job", () => {
    const pendingByJob = (canonicalReadsEnabled: boolean) => {
      const pending = filterPendingRecruiterApplications(mixedCohort, {
        canonicalReadsEnabled,
      });
      return pending.reduce<Record<string, number>>((counts, row) => {
        counts[row.jobId] = (counts[row.jobId] ?? 0) + 1;
        return counts;
      }, {});
    };

    expect(pendingByJob(false)).toEqual({ "job-a": 1, "job-b": 1, "job-c": 3 });
    expect(pendingByJob(true)).toEqual({ "job-a": 1, "job-c": 1 });
    expect(pendingByJob(false)).toEqual({ "job-a": 1, "job-b": 1, "job-c": 3 });
  });

  it("keeps legacy URL aliases conservative throughout cutover", () => {
    expect(resolveRecruiterPipelineFilter({ interest: "ACCEPTED" })).toBe("INTERVIEW");
    expect(
      resolveRecruiterPipelineFilter({ interest: "ACCEPTED", pipeline: "OFFER" }),
    ).toBe("OFFER");
    expect(
      resolveRecruiterPipelineFilter({ interest: "ACCEPTED", pipeline: "HIRED" }),
    ).toBe("HIRED");
    expect(
      resolveRecruiterPipelineFilter({ interest: "ACCEPTED", pipeline: "UNKNOWN" }),
    ).toBe("INTERVIEW");
  });

  it("does not reinterpret complete invalid pairs as partial fallback", () => {
    expect(
      getRecruiterApplicationReadModel(mixedCohort[mixedCohort.length - 1], {
        canonicalReadsEnabled: true,
      }),
    ).toEqual({ bucket: "CLOSED_OTHER", label: "Cerrado", source: "CANONICAL" });
  });
});
