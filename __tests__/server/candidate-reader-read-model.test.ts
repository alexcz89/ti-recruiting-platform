import { describe, expect, it } from "vitest";

import {
  buildCandidateApplicationReadRows,
  countCandidateProcessBuckets,
  filterCandidateProcessRows,
  getCandidateApplicationReadModel,
  resolveCandidateProcessFilter,
} from "@/lib/hiring-process/candidate-read-model";
import { isCanonicalHiringProcessCandidateReadsEnabled } from "@/lib/hiring-process/feature-flags";

describe("candidate canonical reads", () => {
  it("keeps the candidate reader flag independently controlled", () => {
    expect(
      isCanonicalHiringProcessCandidateReadsEnabled({
        NODE_ENV: "test",
        CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED: "true",
      }),
    ).toBe(true);

    expect(
      isCanonicalHiringProcessCandidateReadsEnabled({
        NODE_ENV: "test",
        CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED: "false",
      }),
    ).toBe(false);

    expect(isCanonicalHiringProcessCandidateReadsEnabled({ NODE_ENV: "test" })).toBe(false);
  });

  it.each([
    ["APPLIED", "ACTIVE", "RECEIVED", "Postulación recibida"],
    ["APPLIED", "HOLD", "RECEIVED", "Postulación recibida"],
    ["REVIEW", "ACTIVE", "REVIEWING", "Revisando perfil"],
    ["REVIEW", "HOLD", "REVIEWING", "Revisando perfil"],
    ["ASSESSMENT", "ACTIVE", "ASSESSMENT", "Evaluación"],
    ["INTERVIEW", "ACTIVE", "INTERVIEW", "Entrevista"],
    ["OFFER", "ACTIVE", "DECISION", "Decisión"],
    ["CLOSED", "REJECTED", "CLOSED", "Proceso cerrado"],
    ["CLOSED", "WITHDRAWN", "CLOSED", "Proceso cerrado"],
    ["CLOSED", "HIRED", "CLOSED", "Proceso cerrado"],
    ["CLOSED", "CANCELLED", "CLOSED", "Proceso cerrado"],
  ] as const)(
    "maps canonical %s/%s to %s",
    (stage, disposition, bucket, label) => {
      expect(
        getCandidateApplicationReadModel(
          {
            stage,
            disposition,
            status: "SUBMITTED",
          },
          { canonicalReadsEnabled: true },
        ),
      ).toEqual({
        bucket,
        label,
        source: "CANONICAL",
      });
    },
  );

  it.each([
    ["SUBMITTED", "RECEIVED", "Enviada"],
    ["REVIEWING", "REVIEWING", "En revisión"],
    ["INTERVIEW", "INTERVIEW", "Entrevista"],
    ["OFFER", "DECISION", "Oferta"],
    ["HIRED", "CLOSED", "Contratado"],
    ["REJECTED", "CLOSED", "Rechazada"],
  ] as const)(
    "preserves legacy candidate presentation while the flag is off: %s",
    (status, bucket, label) => {
      expect(
        getCandidateApplicationReadModel(
          {
            stage: "OFFER",
            disposition: "ACTIVE",
            status,
          },
          { canonicalReadsEnabled: false },
        ),
      ).toEqual({
        bucket,
        label,
        source: "LEGACY_FALLBACK",
      });
    },
  );

  it("falls back to legacy status when canonical state is incomplete", () => {
    expect(
      getCandidateApplicationReadModel(
        {
          stage: "REVIEW",
          disposition: null,
          status: "INTERVIEW",
        },
        { canonicalReadsEnabled: true },
      ),
    ).toEqual({
      bucket: "INTERVIEW",
      label: "Entrevista",
      source: "LEGACY_FALLBACK",
    });
  });

  it("builds candidate rows without changing the original application fields", () => {
    const rows = buildCandidateApplicationReadRows(
      [
        {
          id: "app-1",
          stage: "REVIEW" as const,
          disposition: "ACTIVE" as const,
          status: "SUBMITTED",
        },
      ],
      { canonicalReadsEnabled: true },
    );

    expect(rows).toEqual([
      {
        id: "app-1",
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "SUBMITTED",
        _candidateRead: {
          bucket: "REVIEWING",
          label: "Revisando perfil",
          source: "CANONICAL",
        },
      },
    ]);
  });
  it("counts and filters candidate process buckets from the centralized read model", () => {
    const rows = buildCandidateApplicationReadRows(
      [
        {
          id: "app-1",
          stage: "APPLIED" as const,
          disposition: "ACTIVE" as const,
          status: "SUBMITTED",
        },
        {
          id: "app-2",
          stage: "OFFER" as const,
          disposition: "ACTIVE" as const,
          status: "REVIEWING",
        },
        {
          id: "app-3",
          stage: "CLOSED" as const,
          disposition: "REJECTED" as const,
          status: "REJECTED",
        },
      ],
      { canonicalReadsEnabled: true },
    );

    expect(countCandidateProcessBuckets(rows)).toEqual({
      RECEIVED: 1,
      REVIEWING: 0,
      ASSESSMENT: 0,
      INTERVIEW: 0,
      DECISION: 1,
      CLOSED: 1,
    });

    expect(
      filterCandidateProcessRows(rows, { bucket: "DECISION" }).map(
        (row) => row.id,
      ),
    ).toEqual(["app-2"]);
  });

  it("accepts canonical process filters and legacy status URLs", () => {
    expect(
      resolveCandidateProcessFilter({ process: "ASSESSMENT" }),
    ).toEqual({
      bucket: "ASSESSMENT",
    });

    expect(
      resolveCandidateProcessFilter({ status: "OFFER" }),
    ).toEqual({
      bucket: "DECISION",
    });

    expect(
      resolveCandidateProcessFilter({ status: "HIRED" }),
    ).toEqual({
      bucket: "CLOSED",
      legacyTerminalStatus: "HIRED",
    });

    expect(
      resolveCandidateProcessFilter({ status: "REJECTED" }),
    ).toEqual({
      bucket: "CLOSED",
      legacyTerminalStatus: "REJECTED",
    });

    expect(
      resolveCandidateProcessFilter({ status: "SUBMITTED" }),
    ).toEqual({
      bucket: "RECEIVED",
    });

    expect(
      resolveCandidateProcessFilter({
        process: "UNKNOWN",
        status: "UNKNOWN",
      }),
    ).toBeUndefined();
  });

  it("preserves terminal legacy URL semantics without overriding canonical authority", () => {
    const rows = buildCandidateApplicationReadRows(
      [
        {
          id: "canonical-hired",
          stage: "CLOSED" as const,
          disposition: "HIRED" as const,
          status: "REJECTED",
        },
        {
          id: "canonical-rejected",
          stage: "CLOSED" as const,
          disposition: "REJECTED" as const,
          status: "HIRED",
        },
        {
          id: "fallback-hired",
          stage: null,
          disposition: null,
          status: "HIRED",
        },
        {
          id: "fallback-rejected",
          stage: null,
          disposition: null,
          status: "REJECTED",
        },
      ],
      { canonicalReadsEnabled: true },
    );

    const hiredFilter = resolveCandidateProcessFilter({
      status: "HIRED",
    });

    const rejectedFilter = resolveCandidateProcessFilter({
      status: "REJECTED",
    });

    expect(
      filterCandidateProcessRows(rows, hiredFilter).map((row) => row.id),
    ).toEqual(["canonical-hired", "fallback-hired"]);

    expect(
      filterCandidateProcessRows(rows, rejectedFilter).map((row) => row.id),
    ).toEqual(["canonical-rejected", "fallback-rejected"]);
  });
});
