import { describe, expect, it } from "vitest";
import { buildRecruiterListHref, compareRecruiterListRows, countRecruiterPresentationGroupedRows, countRecruiterPresentationRows, matchesRecruiterListFilters, resolveCandidateLocation, resolveProcessActivity, type RecruiterListRow } from "@/lib/hiring-process/recruiter-list";
import { getRecruitingPresentation, type PresentationSource } from "@/lib/hiring-process/recruiting-presentation";

const applied: PresentationSource = { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1 };
const review: PresentationSource = { ...applied, stage: "REVIEW", status: "REVIEWING", recruiterInterest: "MAYBE" };
const closed: PresentationSource = { ...applied, stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED" };
const makeRow = (id: string, source: PresentationSource, score: number | null, assessment: RecruiterListRow["assessment"] = "NONE"): RecruiterListRow => ({
  id, name: id, score, presentation: getRecruitingPresentation(source, true), activityAt: new Date("2026-10-30T12:00:00Z"), location: null, hasCV: id === "review", assessment,
});

describe("recruiter list shared data", () => {
  it.each([true, false])("counts the same partition for rows and grouped states with reads=%s", reads => {
    const sources: PresentationSource[] = [
      applied,
      review,
      closed,
      { ...applied, stage: null, disposition: null, stateVersion: 0 },
      { ...applied, stage: "REVIEW", disposition: "HOLD", status: "REVIEWING" },
      { ...applied, stage: null },
    ];
    const rowCounts = countRecruiterPresentationRows(sources, reads);
    const groupedCounts = countRecruiterPresentationGroupedRows(sources.map((source) => ({ ...source, _count: { _all: 1 } })), reads);
    expect(groupedCounts).toEqual(rowCounts);
    expect(Object.values(rowCounts).reduce((sum, count) => sum + count, 0)).toBe(sources.length);
    expect(rowCounts.REVIEW).toBe(1);
    expect(rowCounts.CLOSED).toBe(1);
    expect(rowCounts.HOLD).toBe(1);
    expect(rowCounts.RECONCILIATION).toBe(1);
  });

  it("combines stage, preselection, assessment, match and CV without interpreting a locked score as zero", () => {
    const rows = [makeRow("applied", applied, null), makeRow("review", review, 85, "COMPLETED"), makeRow("closed", closed, 30)];
    const filters = { pipeline: "REVIEW", preselected: true, assessment: "COMPLETED" as const, match: "HIGH" as const, cv: "YES" as const };
    expect(rows.filter((row) => matchesRecruiterListFilters(row, filters)).map((row) => row.id)).toEqual(["review"]);
    expect(matchesRecruiterListFilters(rows[0], { match: "LOW" })).toBe(false);
    expect(matchesRecruiterListFilters(rows[2], { outcome: "REJECTED" })).toBe(true);
    expect(matchesRecruiterListFilters(rows[1], { outcome: "REJECTED" })).toBe(false);
  });

  it("sorts both directions with deterministic ties and unknown match scores last", () => {
    const a = makeRow("a", applied, null);
    const b = makeRow("b", review, 80);
    const c = { ...makeRow("c", review, 40), activityAt: new Date("2026-10-29T12:00:00Z") };
    for (const direction of ["asc", "desc"] as const) {
      const sorted = [a, b, c].sort((x, y) => compareRecruiterListRows(x, y, "match", direction));
      expect(sorted[sorted.length - 1]?.id).toBe("a");
    }
    expect([a, b, c].sort((x, y) => compareRecruiterListRows(x, y, "status", "asc")).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect([a, b, c].sort((x, y) => compareRecruiterListRows(x, y, "activity", "desc"))[2].id).toBe("c");
  });

  it("uses structured location without inventing a city from legacy text", () => {
    expect(resolveCandidateLocation({ city: "CDMX", admin1: "Ciudad de México", country: "México", location: "Remoto" })).toEqual({ full: "CDMX, Ciudad de México, México", compact: "CDMX" });
    expect(resolveCandidateLocation({ location: "Remoto o Monterrey" })).toEqual({ full: "Remoto o Monterrey", compact: "Remoto o Monterrey" });
    expect(resolveCandidateLocation({})).toEqual({ full: null, compact: null });
  });

  it("uses the latest process event, falling back to the submitted date rather than createdAt or updatedAt", () => {
    const submitted = new Date("2026-10-01T12:00:00Z");
    const event = new Date("2026-10-03T12:00:00Z");
    expect(resolveProcessActivity(submitted, event)).toEqual({ at: event, kind: "PROCESS" });
    expect(resolveProcessActivity(submitted, null)).toEqual({ at: submitted, kind: "APPLICATION" });
  });

  it("preserves combined filters and search when sorting or changing stage", () => {
    const current = { pipeline: "REVIEW", q: "typescript", sort: "activity", dir: "desc", match: "HIGH", cv: "YES", preselected: "1", assessment: "COMPLETED" };
    const sorted = new URL(buildRecruiterListHref("job-1", current, { sort: "candidate", dir: "asc" }), "https://example.test");
    expect(Object.fromEntries(sorted.searchParams)).toMatchObject({ ...current, sort: "candidate", dir: "asc" });
    const closed = new URL(buildRecruiterListHref("job-1", current, { pipeline: "CLOSED", outcome: "HIRED" }), "https://example.test");
    expect(Object.fromEntries(closed.searchParams)).toMatchObject({ ...current, pipeline: "CLOSED", outcome: "HIRED" });
    const cleared = new URL(buildRecruiterListHref("job-1", { ...current, pipeline: "CLOSED", outcome: "HIRED" }, { pipeline: "REVIEW", match: undefined, cv: undefined, preselected: undefined, assessment: undefined }), "https://example.test");
    expect(cleared.searchParams.has("outcome")).toBe(false);
    expect(cleared.searchParams.get("q")).toBe("typescript");
  });
});
