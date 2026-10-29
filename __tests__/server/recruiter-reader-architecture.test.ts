import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const read = (...segments: string[]) =>
  readFileSync(join(process.cwd(), ...segments), "utf8");

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("recruiter reader architecture", () => {
  it("keeps job application presentation on the centralized read model", () => {
    const page = read("app", "dashboard", "jobs", "[id]", "applications", "page.tsx");

    expect(page).toContain("buildRecruiterApplicationReadRows");
    expect(page).toContain("countRecruiterPipelineBuckets");
    expect(page).toContain("filterRecruiterPipelineRows");
    expect(page).toContain("RECRUITER_PIPELINE_LABELS");
    expect(page).not.toContain("function getAppInterest");
    expect(page).not.toContain("INTEREST_LABEL");
  });

  it("keeps candidate rail presentation independent from raw legacy fields", () => {
    const page = read("app", "dashboard", "candidates", "[id]", "page.tsx");
    const shell = read("components", "dashboard", "CandidateReviewShell.tsx");

    expect(page).toContain("readModel: getRecruiterApplicationReadModel");
    expect(shell).toContain("entry.readModel");
    expect(shell).not.toContain("entry.recruiterInterest");
    expect(shell).not.toContain("entry.status");
  });

  it("keeps canonical row presentation centralized without adding writer paths", () => {
    const select = read(
      "app",
      "dashboard",
      "jobs",
      "[id]",
      "applications",
      "InterestSelect.tsx",
    );

    expect(select).toContain("getRecruiterApplicationReadModel");
    expect(select).toContain("readModel.label");
    expect(select).not.toContain("/status");
    expect(select).not.toContain("/interest");
  });

  it("keeps the MAYBE presentation exception inside the centralized helper", () => {
    const helper = read("lib", "hiring-process", "recruiter-read-model.ts");
    const serverPresentation = [
      read("app", "dashboard", "jobs", "[id]", "applications", "page.tsx"),
      read("app", "dashboard", "candidates", "[id]", "page.tsx"),
    ].join("\n");

    expect(helper).toContain('recruiterInterest === "MAYBE"');
    expect(serverPresentation).not.toContain('recruiterInterest === "MAYBE"');
  });

  it("keeps overview aggregation and current labels on the centralized read model", () => {
    const page = read("app", "dashboard", "overview", "page.tsx");

    expect(page).toContain("countRecruiterPipelineGroupedRows");
    expect(page).toContain("getRecruiterApplicationReadModel");
    expect(page).toContain('by: ["stage", "disposition", "status", "recruiterInterest"]');
    expect(page).not.toContain("for (const row of funnelRaw)");
  });

  it("keeps the pending queue selection on the centralized read model", () => {
    const page = read("app", "dashboard", "candidates", "pending", "page.tsx");

    expect(page).toContain("filterPendingRecruiterApplications");
    expect(page).toContain("isCanonicalHiringProcessRecruiterReadsEnabled");
    expect(page).toContain("?pipeline=APPLIED");
  });

  it("keeps job aggregate pending counts on the centralized recruiter read model", () => {
    const page = read("app", "dashboard", "jobs", "page.tsx");

    expect(page).toContain("isCanonicalHiringProcessRecruiterReadsEnabled");
    expect(page).toContain("getRecruiterApplicationReadModel");
    expect(page).toContain(
      'by: ["jobId", "stage", "disposition", "status", "recruiterInterest"]',
    );
    expect(page).toContain('readModel.bucket !== "APPLIED"');
    expect(page).toContain("?pipeline=APPLIED");
  });

  it("keeps canonical Kanban presentation separate from existing writer commands", () => {
    const page = read("app", "dashboard", "jobs", "[id]", "page.tsx");
    const board = read("app", "dashboard", "jobs", "[id]", "KanbanBoard.tsx");

    expect(page).toContain("buildRecruiterApplicationReadRows");
    expect(page).toContain("displayStatus: canonicalRecruiterReadsEnabled");
    expect(page).toContain("statuses={kanbanStatuses}");
    expect(page).toContain("statusLabels={kanbanStatusLabels}");
    expect(page).toContain("getApplicationWriterCompatibility");
    expect(page).toContain("writerCompatibility: getApplicationWriterCompatibility(a)");
    expect(page).not.toContain("canonicalHiringProcessEnabled");

    expect(board).toContain("canonicalRecruiterReadsEnabled");
    expect(board).toContain("isCardWritable");
    expect(board).toContain('card.writerCompatibility !== "NONE"');
    expect(board).not.toContain("canonicalHiringProcessEnabled");
    expect(board).toContain("isDragDisabled={!isCardWritable(card)}");
    expect(board).toContain("a.displayStatus");
    expect(board).toContain("canonicalWriterStatusForMove");
    expect(board).toContain('APPLIED: "REVIEW"');
    expect(board).toContain('REVIEW: "PRESELECTED"');
    expect(board).toContain('PRESELECTED: "INTERVIEW"');
    expect(board).toContain('OFFER: null');
    expect(board).toContain('OFFER: null');
    expect(board).toContain('HIRED: null');
    expect(board).toContain('HOLD: null');
    expect(board).toContain('CLOSED_OTHER: null');

    expect(page).not.toContain('intent: "MOVE_TO_OFFER"');
    expect(page).not.toContain('intent: "HIRE_CANDIDATE"');
    expect(page).not.toContain('intent: "MOVE_BACKWARD"');
    expect(page).not.toContain('intent: "REOPEN_REJECTED"');
  });

  it("limits the recruiter reader environment flag to approved read surfaces", () => {
    const root = process.cwd();
    const consumers = ["app", "lib", "components"]
      .flatMap((directory) => sources(join(root, directory)))
      .filter((file) =>
        /\b(?:isCanonicalHiringProcessRecruiterReadsEnabled|CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED)\b/.test(
          readFileSync(file, "utf8"),
        ),
      )
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .sort();

    expect(consumers).toEqual([
      "app/dashboard/candidates/[id]/page.tsx",
      "app/dashboard/candidates/pending/page.tsx",
      "app/dashboard/jobs/[id]/applications/page.tsx",
      "app/dashboard/jobs/[id]/page.tsx",
      "app/dashboard/jobs/page.tsx",
      "app/dashboard/overview/page.tsx",
      "lib/hiring-process/feature-flags.ts",
    ]);
  });

  it("keeps the mixed Kanban server action independent from the reader flag", () => {
    const page = read("app", "dashboard", "jobs", "[id]", "page.tsx");
    const actionStart = page.indexOf("async function moveAction(");
    const actionEnd = page.indexOf("\n  return (", actionStart);
    const moveAction = page.slice(actionStart, actionEnd);

    expect(actionStart).toBeGreaterThan(-1);
    expect(actionEnd).toBeGreaterThan(actionStart);
    expect(moveAction).toContain("executeApplicationIntent({");
    expect(moveAction).not.toContain("canonicalRecruiterReadsEnabled");
    expect(moveAction).not.toContain("isCanonicalHiringProcessRecruiterReadsEnabled");
  });

  it("keeps the centralized recruiter reader free of writer side effects", () => {
    const helper = read("lib", "hiring-process", "recruiter-read-model.ts");

    for (const forbidden of [
      "@/lib/server/prisma",
      "executeApplicationIntent",
      "transitionApplication",
      "applicationEvent",
      "ApplicationEvent",
      ".update(",
      ".updateMany(",
      ".create(",
      "reconcile",
      "backfill",
      "expectedVersion",
      "idempotency",
    ]) {
      expect(helper).not.toContain(forbidden);
    }
  });
});
