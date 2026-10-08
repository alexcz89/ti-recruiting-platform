import { describe, expect, it } from "vitest";

import {
  buildRecruiterApplicationReadRows,
  countRecruiterPipelineBuckets,
  filterRecruiterPipelineRows,
  getRecruiterApplicationReadModel,
  resolveRecruiterPipelineFilter,
} from "@/lib/hiring-process/recruiter-read-model";
import { isCanonicalHiringProcessRecruiterReadsEnabled } from "@/lib/hiring-process/feature-flags";

describe("recruiter application read model", () => {
  it.each([
    ["APPLIED", "ACTIVE", "REVIEW", "APPLIED", "Por revisar"],
    ["REVIEW", "ACTIVE", "REVIEW", "REVIEW", "En revisión"],
    ["REVIEW", "ACTIVE", "MAYBE", "PRESELECTED", "Preselecto"],
    ["ASSESSMENT", "ACTIVE", "MAYBE", "ASSESSMENT", "Evaluación"],
    ["INTERVIEW", "ACTIVE", "REVIEW", "INTERVIEW", "Entrevista"],
    ["INTERVIEW", "ACTIVE", "MAYBE", "INTERVIEW", "Entrevista"],
    ["OFFER", "ACTIVE", "REVIEW", "OFFER", "Oferta"],
    ["OFFER", "ACTIVE", "MAYBE", "OFFER", "Oferta"],
    ["CLOSED", "REJECTED", "ACCEPTED", "REJECTED", "Descartado"],
    ["CLOSED", "HIRED", "REVIEW", "HIRED", "Contratado"],
    ["INTERVIEW", "HOLD", "ACCEPTED", "HOLD", "En pausa"],
    ["CLOSED", "WITHDRAWN", "REVIEW", "CLOSED_OTHER", "Cerrado"],
  ] as const)(
    "%s/%s with interest %s reads as %s",
    (stage, disposition, recruiterInterest, bucket, label) => {
      expect(
        getRecruiterApplicationReadModel(
          { stage, disposition, status: "SUBMITTED", recruiterInterest },
          { canonicalReadsEnabled: true },
        ),
      ).toEqual({ bucket, label, source: "CANONICAL" });
    },
  );

  it("drives recruiter list counts and filtering from canonical buckets", () => {
    const rows = buildRecruiterApplicationReadRows(
      [
        { id: "interview", stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "REVIEW" },
        { id: "offer", stage: "OFFER", disposition: "ACTIVE", status: "OFFER", recruiterInterest: "ACCEPTED" },
        { id: "hired", stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED" },
        { id: "preselected", stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "MAYBE" },
        { id: "legacy", stage: null, disposition: null, status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
      ] as const,
      { canonicalReadsEnabled: true },
    );

    expect(rows.map((row) => [row.id, row._recruiterRead.label])).toEqual([
      ["interview", "Entrevista"],
      ["offer", "Oferta"],
      ["hired", "Contratado"],
      ["preselected", "Preselecto"],
      ["legacy", "Entrevista"],
    ]);
    const counts = countRecruiterPipelineBuckets(rows);
    expect(counts).toMatchObject({
      INTERVIEW: 2,
      OFFER: 1,
      HIRED: 1,
      PRESELECTED: 1,
      APPLIED: 0,
    });
    expect(
      filterRecruiterPipelineRows(rows, "OFFER").map((row) => row.id),
    ).toEqual(["offer"]);
  });

  it.each([
    [null, null],
    ["INTERVIEW", null],
    [null, "ACTIVE"],
  ] as const)(
    "uses legacy fallback when canonical state is incomplete (%s/%s)",
    (stage, disposition) => {
      expect(
        getRecruiterApplicationReadModel(
          {
            stage,
            disposition,
            status: "INTERVIEW",
            recruiterInterest: "REVIEW",
          },
          { canonicalReadsEnabled: true },
        ),
      ).toEqual({
        bucket: "APPLIED",
        label: "Por revisar",
        source: "LEGACY_FALLBACK",
      });
    },
  );

  it("preserves legacy presentation while recruiter reads are disabled", () => {
    expect(
      getRecruiterApplicationReadModel(
        {
          stage: "INTERVIEW",
          disposition: "ACTIVE",
          status: "INTERVIEW",
          recruiterInterest: "REVIEW",
        },
        { canonicalReadsEnabled: false },
      ),
    ).toEqual({
      bucket: "APPLIED",
      label: "Por revisar",
      source: "LEGACY_FALLBACK",
    });
  });

  it("keeps the recruiter reader flag independent and disabled by default", () => {
    expect(isCanonicalHiringProcessRecruiterReadsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isCanonicalHiringProcessRecruiterReadsEnabled({
        NODE_ENV: "test",
        CANONICAL_HIRING_PROCESS_ENABLED: "true",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isCanonicalHiringProcessRecruiterReadsEnabled({
        NODE_ENV: "test",
        CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED: "true",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it.each([
    [undefined, undefined, undefined],
    [undefined, "REVIEW", "APPLIED"],
    [undefined, "MAYBE", "PRESELECTED"],
    [undefined, "ACCEPTED", "INTERVIEW"],
    [undefined, "REJECTED", "REJECTED"],
    ["OFFER", "ACCEPTED", "OFFER"],
  ] as const)(
    "resolves pipeline=%s interest=%s to %s",
    (pipeline, interest, expected) => {
      expect(resolveRecruiterPipelineFilter({ pipeline, interest })).toBe(expected);
    },
  );
});
