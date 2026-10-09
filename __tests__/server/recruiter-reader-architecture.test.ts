import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (...segments: string[]) =>
  readFileSync(join(process.cwd(), ...segments), "utf8");

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
    expect(page).toContain('by: ["stage", "disposition", "recruiterInterest"]');
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
      'by: ["jobId", "stage", "disposition", "recruiterInterest"]',
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

    expect(board).toContain("canonicalRecruiterReadsEnabled");
    expect(board).toContain("a.displayStatus");
    expect(board).toContain("canonicalWriterStatusForMove");
    expect(board).toContain('APPLIED: "PRESELECTED"');
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
});
