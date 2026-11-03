import {
  ACTIVE_PIPELINE,
  getRecruitingPresentation,
  type PresentationSource,
  type RecruitingPresentation,
} from "./recruiting-presentation";

export type RecruiterListSort = "candidate" | "match" | "status" | "activity" | "location";
export type SortDirection = "asc" | "desc";
export type RecruiterListAssessment = "ALL" | "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";

export type CandidateLocation = {
  city?: string | null;
  admin1?: string | null;
  country?: string | null;
  location?: string | null;
};

export function resolveCandidateLocation(candidate: CandidateLocation): { full: string | null; compact: string | null } {
  const parts = [candidate.city, candidate.admin1, candidate.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (parts.length) {
    const unique = parts.filter((part, index) => parts.findIndex((value) => value.toLocaleLowerCase("es-MX") === part.toLocaleLowerCase("es-MX")) === index);
    return { full: unique.join(", "), compact: candidate.city?.trim() || unique.join(", ") };
  }
  const fallback = candidate.location?.trim() || null;
  return { full: fallback, compact: fallback };
}

/** A process event is activity; otherwise the application date is the first activity. */
export function resolveProcessActivity(submittedAt: Date, lastEventAt: Date | null | undefined) {
  return lastEventAt && lastEventAt.getTime() >= submittedAt.getTime()
    ? { at: lastEventAt, kind: "PROCESS" as const }
    : { at: submittedAt, kind: "APPLICATION" as const };
}

export type RecruiterListRow = {
  id: string;
  name: string;
  score: number | null;
  presentation: RecruitingPresentation;
  activityAt: Date;
  location: string | null;
  hasCV: boolean;
  assessment: RecruiterListAssessment;
};

const statusOrder = [...ACTIVE_PIPELINE, "CLOSED", "HOLD", "RECONCILIATION"] as const;
const outcomeOrder = ["REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"];

function statusRank(row: RecruiterListRow) {
  const key = row.presentation.section === "ACTIVE" ? row.presentation.column : row.presentation.section;
  const rank = statusOrder.indexOf(key as typeof statusOrder[number]);
  const secondary = row.presentation.section === "CLOSED"
    ? outcomeOrder.indexOf(row.presentation.outcome ?? "")
    : row.presentation.preselected ? 1 : row.presentation.assessmentStage ? 2 : 0;
  return rank * 10 + Math.max(secondary, 0);
}

export function compareRecruiterListRows(a: RecruiterListRow, b: RecruiterListRow, sort: RecruiterListSort, direction: SortDirection) {
  const factor = direction === "asc" ? 1 : -1;
  let result = 0;
  switch (sort) {
    case "candidate": result = a.name.localeCompare(b.name, "es", { sensitivity: "base" }); break;
    case "match":
      // A locked or absent score is unknown, never 0%, and stays last in both directions.
      if (a.score === null || b.score === null) result = a.score === null ? (b.score === null ? 0 : 1) : -1;
      else result = factor * (a.score - b.score);
      return result || a.id.localeCompare(b.id);
    case "status": result = statusRank(a) - statusRank(b); break;
    case "activity": result = a.activityAt.getTime() - b.activityAt.getTime(); break;
    case "location": result = (a.location ?? "").localeCompare(b.location ?? "", "es", { sensitivity: "base" }); break;
  }
  return factor * result || a.id.localeCompare(b.id);
}

export type RecruiterListFilters = {
  pipeline?: string;
  preselected?: boolean;
  assessment?: RecruiterListAssessment;
  outcome?: string;
  match?: "ALL" | "HIGH" | "MED" | "LOW";
  cv?: "ALL" | "YES" | "NO";
};

export type RecruiterListQuery = {
  pipeline?: string;
  q?: string;
  sort?: string;
  dir?: string;
  match?: string;
  cv?: string;
  preselected?: string;
  assessment?: string;
  outcome?: string;
};

export function buildRecruiterListHref(jobId: string, current: RecruiterListQuery, overrides: RecruiterListQuery) {
  const next = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["pipeline", "q", "sort", "dir", "match", "cv", "preselected", "assessment"] as const) {
    if (next[key]) params.set(key, next[key]);
  }
  if (next.pipeline === "CLOSED" && next.outcome) params.set("outcome", next.outcome);
  const query = params.toString();
  return `/dashboard/jobs/${encodeURIComponent(jobId)}/applications${query ? `?${query}` : ""}`;
}

export function matchScoreLevel(score: number): "HIGH" | "MED" | "LOW" {
  return score >= 70 ? "HIGH" : score >= 40 ? "MED" : "LOW";
}

export function matchesRecruiterListFilters(row: RecruiterListRow, filters: RecruiterListFilters) {
  const p = row.presentation;
  if (filters.pipeline && (p.section === "ACTIVE" ? p.column : p.section) !== filters.pipeline) return false;
  if (filters.preselected && !p.preselected) return false;
  if (filters.assessment && filters.assessment !== "ALL" && row.assessment !== filters.assessment) return false;
  if (filters.outcome && p.outcome !== filters.outcome) return false;
  if (filters.match && filters.match !== "ALL" && (row.score === null || matchScoreLevel(row.score) !== filters.match)) return false;
  if (filters.cv === "YES" && !row.hasCV) return false;
  if (filters.cv === "NO" && row.hasCV) return false;
  return true;
}

export function countRecruiterPresentationRows(rows: readonly PresentationSource[], canonicalReadsEnabled: boolean) {
  const counts = Object.fromEntries(statusOrder.map((key) => [key, 0])) as Record<typeof statusOrder[number], number>;
  for (const row of rows) {
    const presentation = getRecruitingPresentation(row, canonicalReadsEnabled);
    const key = presentation.section === "ACTIVE" ? presentation.column : presentation.section;
    if (key && key in counts) counts[key as typeof statusOrder[number]]++;
  }
  return counts;
}

export function countRecruiterPresentationGroupedRows(rows: readonly (PresentationSource & { _count: { _all: number } })[], canonicalReadsEnabled: boolean) {
  const counts = Object.fromEntries(statusOrder.map((key) => [key, 0])) as Record<typeof statusOrder[number], number>;
  for (const row of rows) {
    const presentation = getRecruitingPresentation(row, canonicalReadsEnabled);
    const key = presentation.section === "ACTIVE" ? presentation.column : presentation.section;
    if (key && key in counts) counts[key as typeof statusOrder[number]] += row._count._all;
  }
  return counts;
}
