import { getRecruiterPipelinePresentation, type PresentationSource } from "./recruiting-presentation";

/** Pending work follows the current ATS presentation, including integrity and pause checks. */
export function isPendingRecruiterApplication(application: PresentationSource, canonicalReadsEnabled: boolean) {
  const presentation = getRecruiterPipelinePresentation(application, canonicalReadsEnabled);
  return !presentation.integrityIssue && !presentation.paused && presentation.pipelineState === "APPLIED";
}

export function filterPendingRecruiterApplications<T extends PresentationSource>(applications: readonly T[], canonicalReadsEnabled: boolean): T[] {
  return applications.filter(application => isPendingRecruiterApplication(application, canonicalReadsEnabled));
}

export function countPendingRecruiterGroupedRows(rows: readonly (PresentationSource & { _count: { _all: number } })[], canonicalReadsEnabled: boolean): number {
  return rows.reduce((count, row) => count + (isPendingRecruiterApplication(row, canonicalReadsEnabled) ? row._count._all : 0), 0);
}
