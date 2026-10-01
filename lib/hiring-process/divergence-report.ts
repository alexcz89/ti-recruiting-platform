import {
  classifyLegacyApplicationState,
  LEGACY_APPLICATION_STATE_MATRIX,
  type LegacyApplicationInterest,
  type LegacyApplicationStatus,
} from "./legacy-mapping";

export type LegacyCombinationCount = Readonly<{
  status: LegacyApplicationStatus;
  recruiterInterest: LegacyApplicationInterest;
  count: number;
}>;

export function buildApplicationDivergenceReport(
  combinations: readonly LegacyCombinationCount[],
) {
  const counts = new Map(
    combinations.map((combination) => [
      `${combination.status}:${combination.recruiterInterest}`,
      combination.count,
    ]),
  );
  const rows = LEGACY_APPLICATION_STATE_MATRIX.map((matrixRow) => {
    const combination = {
      status: matrixRow.status,
      recruiterInterest: matrixRow.recruiterInterest,
      count: counts.get(matrixRow.key) ?? 0,
    };
    const mapping = classifyLegacyApplicationState(
      combination.status,
      combination.recruiterInterest,
    );
    return {
      ...combination,
      classification: mapping.classification,
      suggestedStage: mapping.suggestedStage,
      suggestedDisposition: mapping.suggestedDisposition,
      requiresReview: !mapping.autoApplicable,
      reason: mapping.reason,
    };
  });

  return {
    generatedAt: new Date(),
    totalApplications: rows.reduce((total, row) => total + row.count, 0),
    totalRequiresReview: rows.reduce(
      (total, row) => total + (row.requiresReview ? row.count : 0),
      0,
    ),
    rows,
  };
}
type DivergenceAggregateSource = {
  groupBy(query: {
    by: ["status", "recruiterInterest"];
    _count: { _all: true };
    orderBy: [{ status: "asc" }, { recruiterInterest: "asc" }];
  }): Promise<
    Array<{
      status: LegacyApplicationStatus;
      recruiterInterest: LegacyApplicationInterest;
      _count: { _all: number };
    }>
  >;
};

export async function collectApplicationDivergenceReport(
  source: DivergenceAggregateSource,
) {
  const groups = await source.groupBy({
    by: ["status", "recruiterInterest"],
    _count: { _all: true },
    orderBy: [{ status: "asc" }, { recruiterInterest: "asc" }],
  });
  return buildApplicationDivergenceReport(
    groups.map((group) => ({
      status: group.status,
      recruiterInterest: group.recruiterInterest,
      count: group._count._all,
    })),
  );
}
