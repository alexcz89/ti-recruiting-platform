import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  applicationIntentTarget,
  applicationIntentSchema,
} from "@/lib/hiring-process/application-intents";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

describe("canonical hiring process writer migration", () => {
  it("supports the nine approved explicit intents and reason contract", () => {
    expect(
      applicationIntentSchema.parse({
        intent: "START_REVIEW",
        expectedVersion: 1,
        commandId: "review-command",
      }),
    ).toEqual({
      intent: "START_REVIEW",
      expectedVersion: 1,
      commandId: "review-command",
    });
    expect(
      applicationIntentTarget("MOVE_TO_INTERVIEW"),
    ).toEqual({ targetStage: "INTERVIEW", targetDisposition: "ACTIVE" });
    expect(
      applicationIntentTarget("REJECT_CANDIDATE"),
    ).toEqual({ targetStage: "CLOSED", targetDisposition: "REJECTED" });
    expect(
      applicationIntentTarget("MOVE_TO_OFFER"),
    ).toEqual({ targetStage: "OFFER", targetDisposition: "ACTIVE" });
    expect(
      applicationIntentSchema.parse({
        intent: "HIRE_CANDIDATE",
        expectedVersion: 1,
        commandId: "hire-command",
      }),
    ).toEqual({
      intent: "HIRE_CANDIDATE",
      expectedVersion: 1,
      commandId: "hire-command",
    });
    expect(applicationIntentTarget("HIRE_CANDIDATE")).toEqual({
      targetStage: "CLOSED",
      targetDisposition: "HIRED",
    });
    expect(
      applicationIntentSchema.parse({
        intent: "MARK_PRESELECTED",
        expectedVersion: 1,
        commandId: "mark-preselected-command",
      }),
    ).toEqual({
      intent: "MARK_PRESELECTED",
      expectedVersion: 1,
      commandId: "mark-preselected-command",
    });
    expect(
      applicationIntentSchema.parse({
        intent: "CLEAR_PRESELECTED",
        expectedVersion: 2,
        commandId: "clear-preselected-command",
      }),
    ).toEqual({
      intent: "CLEAR_PRESELECTED",
      expectedVersion: 2,
      commandId: "clear-preselected-command",
    });
    expect(applicationIntentSchema.parse({
      intent: "MOVE_BACKWARD",
      expectedVersion: 4,
      commandId: "move-backward-command",
      targetStage: "REVIEW",
      reasonCode: "ADDITIONAL_REVIEW",
      reasonText: "  Verificar señales nuevas  ",
    })).toEqual({
      intent: "MOVE_BACKWARD",
      expectedVersion: 4,
      commandId: "move-backward-command",
      targetStage: "REVIEW",
      reasonCode: "ADDITIONAL_REVIEW",
      reasonText: "Verificar señales nuevas",
    });
    expect(applicationIntentSchema.parse({
      intent: "REOPEN_REJECTED",
      expectedVersion: 5,
      commandId: "reopen-command",
      reasonCode: "RECONSIDERED",
    })).toEqual({
      intent: "REOPEN_REJECTED",
      expectedVersion: 5,
      commandId: "reopen-command",
      reasonCode: "RECONSIDERED",
    });
    expect(() => applicationIntentSchema.parse({
      intent: "MOVE_BACKWARD",
      expectedVersion: 4,
      commandId: "missing-reason",
      targetStage: "REVIEW",
    })).toThrow();
    expect(() => applicationIntentSchema.parse({
      intent: "REOPEN_REJECTED",
      expectedVersion: 5,
      commandId: "other-without-note",
      reasonCode: "OTHER",
    })).toThrow();
  });

  it("adds APPLICATION_CREATED with an additive enum migration", () => {
    const schema = read("prisma", "schema.prisma");
    const migration = read(
      "prisma",
      "migrations",
      "20261003090000_add_application_created_event",
      "migration.sql",
    );

    expect(schema).toMatch(/enum ApplicationEventType\s*{[^}]*APPLICATION_CREATED/s);
    expect(migration).toContain(
      `ALTER TYPE "ApplicationEventType" ADD VALUE 'APPLICATION_CREATED'`,
    );
    expect(migration).not.toMatch(/UPDATE|DELETE|DROP|TRUNCATE/i);
  });

  it("routes candidate application submission through the feature-flagged rollout creator", () => {
    const applicationsRoute = read("app", "api", "applications", "route.ts");
    const creationModule = read("lib", "hiring-process", "create-application.ts");
    expect(applicationsRoute).toContain("createApplicationForHiringProcessRollout({");
    expect(applicationsRoute).not.toContain("prisma.application.create({");
    expect(creationModule).toContain("isCanonicalHiringProcessEnabled()");
    expect(creationModule).toContain("return createCanonicalApplication(input);");
  });

  it("routes Entrevista through one explicit command without OFFER", () => {
    const interestSelect = read(
      "app",
      "dashboard",
      "jobs",
      "[id]",
      "applications",
      "InterestSelect.tsx",
    );

    expect(interestSelect).toContain('"MOVE_TO_INTERVIEW"');
    expect(interestSelect).not.toContain('ACCEPTED: "OFFER"');
  });

  it("routes every visible Preselecto writer through one explicit command", () => {
    const interestSelect = read("app", "dashboard", "jobs", "[id]", "applications", "InterestSelect.tsx");
    const candidateShell = read("components", "dashboard", "CandidateReviewShell.tsx");
    const kanban = read("app", "dashboard", "jobs", "[id]", "KanbanBoard.tsx");
    const kanbanAction = read("app", "dashboard", "jobs", "[id]", "page.tsx");

    for (const source of [interestSelect, candidateShell, kanbanAction]) {
      expect(source).toContain('"MARK_PRESELECTED"');
      expect(source).toContain('"CLEAR_PRESELECTED"');
    }
    expect(interestSelect).not.toContain('/status`');
    expect(interestSelect).not.toMatch(/recruiterInterest:\s*next/);
    expect(candidateShell).not.toMatch(/canonicalIntent \? "intent" : "interest"/);
    expect(kanban).toMatch(/toStatus === "PRESELECTED"[\s\S]*return "MAYBE"/);
    expect(kanban).toContain('fromStatus === "PRESELECTED" && toStatus === "REVIEW"');
    expect(kanbanAction).not.toContain("prisma.application.updateMany({");
  });

  it("blocks direct MAYBE and Preselecto clear bypasses in the legacy interest endpoint", () => {
    const interestRoute = read("app", "api", "applications", "[id]", "interest", "route.ts");
    expect(interestRoute).toContain('if (next === "MAYBE")');
    expect(interestRoute).toContain("MARK_PRESELECTED");
    expect(interestRoute).toMatch(/app\.recruiterInterest === "MAYBE"[\s\S]*next === "REVIEW"/);
    expect(interestRoute).toContain("CLEAR_PRESELECTED");
  });

  it("exposes one explicit CandidateReviewShell offer command without reinterpreting Entrevista", () => {
    const candidateShell = read("components", "dashboard", "CandidateReviewShell.tsx");
    const candidatePage = read("app", "dashboard", "candidates", "[id]", "page.tsx");

    expect(candidateShell).toContain('intent: "MOVE_TO_OFFER"');
    expect(candidateShell).toContain('app?.stage === "INTERVIEW"');
    expect(candidateShell).toContain('app.disposition === "ACTIVE"');
    expect(candidateShell).toContain("Mover a oferta");
    expect(candidateShell).toContain('? "MOVE_TO_INTERVIEW"');
    expect(candidatePage).toContain("stage: currentApplication.stage");
    expect(candidatePage).toContain("disposition: currentApplication.disposition");

    const intentRoute = read("app", "api", "applications", "[id]", "intent", "route.ts");
    expect(intentRoute).toContain("result.timestamps.offerAt");
    expect(intentRoute).not.toContain("prisma.application.findUnique");
  });

  it("keeps the flag-off legacy write conditional on a fully non-canonical row", () => {
    const intents = read("lib", "hiring-process", "application-intents.ts");
    expect(intents).toMatch(
      /updateMany\(\{\s*where:\s*\{[^}]*stage:\s*null[^}]*disposition:\s*null[^}]*stateVersion:\s*0/s,
    );
  });

  it("routes every visible rejection surface through one explicit intent", () => {
    const interestSelect = read("app", "dashboard", "jobs", "[id]", "applications", "InterestSelect.tsx");
    const candidateShell = read("components", "dashboard", "CandidateReviewShell.tsx");
    const kanban = read("app", "dashboard", "jobs", "[id]", "KanbanBoard.tsx");
    const jobPage = read("app", "dashboard", "jobs", "[id]", "page.tsx");
    const overviewButtons = read("app", "dashboard", "overview", "QuickActionButtons.tsx");
    const overviewActions = read("app", "dashboard", "overview", "actions.ts");

    expect(interestSelect).toContain('"REJECT_CANDIDATE"');
    expect(interestSelect).toMatch(
      /next === "REJECTED"[\s\S]*"REJECT_CANDIDATE"[\s\S]*\/intent[\s\S]*return;/,
    );
    expect(candidateShell).toContain('? "REJECT_CANDIDATE"');
    expect(candidateShell).toContain('if (currentInterest === "REJECTED") return;');
    expect(kanban).toMatch(/toStatus === "INTERVIEW"[\s\S]*return "ACCEPTED"/);
    expect(kanban).toContain('toStatus === "REJECTED"');
    expect(jobPage).toContain('"REJECT_CANDIDATE"');
    expect(overviewButtons).toContain('commandId: crypto.randomUUID()');
    expect(overviewActions).toContain('intent: "REJECT_CANDIDATE"');
    expect(overviewActions).not.toContain('recruiterInterest: status === "REVIEWING" ? "ACCEPTED" : "REJECTED"');
  });

  it("closes all direct rejection endpoint bypasses", () => {
    const statusRoute = read("app", "api", "applications", "[id]", "status", "route.ts");
    const interestRoute = read("app", "api", "applications", "[id]", "interest", "route.ts");
    const applicationRoute = read("app", "api", "applications", "[id]", "route.ts");

    expect(statusRoute).toContain('if (newStatus === "REJECTED")');
    expect(interestRoute).toContain('if (next === "REJECTED")');
    expect(applicationRoute).toContain('if (body.status === "REJECTED")');
    for (const source of [statusRoute, interestRoute, applicationRoute]) {
      expect(source).toContain("REJECT_CANDIDATE");
    }
  });

  it("closes direct OFFER endpoint bypasses", () => {
    const statusRoute = read("app", "api", "applications", "[id]", "status", "route.ts");
    const applicationRoute = read("app", "api", "applications", "[id]", "route.ts");

    expect(statusRoute).toContain('if (newStatus === "OFFER")');
    expect(applicationRoute).toContain('if (body.status === "OFFER")');
    for (const source of [statusRoute, applicationRoute]) {
      expect(source).toContain("MOVE_TO_OFFER");
    }
  });

  it("protects canonical OFFER/ACTIVE from every remaining legacy writer and surface", () => {
    const helper = read("lib", "hiring-process", "offer-footprint.ts");
    expect(helper).toContain('application.stage === "OFFER"');
    expect(helper).toContain('application.disposition === "ACTIVE"');
    expect(helper).not.toContain('status === "OFFER"');
    expect(helper).not.toContain('recruiterInterest === "ACCEPTED"');

    const guardedDirectWriters = [
      read("app", "api", "applications", "[id]", "status", "route.ts"),
      read("app", "api", "applications", "[id]", "interest", "route.ts"),
      read("app", "api", "applications", "[id]", "route.ts"),
      read("app", "dashboard", "overview", "actions.ts"),
    ];
    for (const source of guardedDirectWriters) {
      expect(source).toContain("hasCanonicalApplicationOffer");
      expect(source).toContain("APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE");
    }
    expect(read("app", "dashboard", "jobs", "[id]", "page.tsx")).toContain(
      "hasCanonicalApplicationOffer",
    );

    const interestSelect = read(
      "app",
      "dashboard",
      "jobs",
      "[id]",
      "applications",
      "InterestSelect.tsx",
    );
    const applicationsPage = read(
      "app",
      "dashboard",
      "jobs",
      "[id]",
      "applications",
      "page.tsx",
    );
    const candidateShell = read("components", "dashboard", "CandidateReviewShell.tsx");
    const kanban = read("app", "dashboard", "jobs", "[id]", "KanbanBoard.tsx");

    expect(interestSelect).toContain("blockedByCanonicalOffer");
    expect(applicationsPage).toContain("canonicalStage={a.stage}");
    expect(applicationsPage).toContain("canonicalDisposition={a.disposition}");
    expect(candidateShell).toContain("blockedByCanonicalOffer");
    expect(kanban).toContain('moved.stage === "OFFER"');
    expect(kanban).toContain('moved.disposition === "ACTIVE"');
  });

  it("keeps backward and reopen commands in the explicit CandidateReviewShell path", () => {
    const helper = read("lib", "hiring-process", "backward-transition-footprint.ts");
    expect(helper).toContain('application.stage === "INTERVIEW"');
    expect(helper).toContain('application.disposition === "ACTIVE"');

    const guardedDirectWriters = [
      read("app", "api", "applications", "[id]", "status", "route.ts"),
      read("app", "api", "applications", "[id]", "interest", "route.ts"),
      read("app", "api", "applications", "[id]", "route.ts"),
      read("app", "dashboard", "overview", "actions.ts"),
    ];
    for (const source of guardedDirectWriters) {
      expect(source).toContain("hasCanonicalApplicationInterview");
      expect(source).toContain("APPLICATION_WITHOUT_CANONICAL_INTERVIEW_WHERE");
      expect(source).toContain("MOVE_BACKWARD");
    }
    for (const source of guardedDirectWriters.slice(0, 3)) {
      expect(source).toContain("REOPEN_REJECTED");
    }

    const shell = read("components", "dashboard", "CandidateReviewShell.tsx");
    expect(shell).toContain('intent: "MOVE_BACKWARD"');
    expect(shell).toContain('intent: "REOPEN_REJECTED"');
    expect(shell).toContain("Regresar a revisión");
    expect(shell).toContain("Regresar a entrevista");
    expect(shell).toContain("Reabrir proceso");
    expect(shell).not.toContain("window.prompt");

    const interestSelect = read(
      "app",
      "dashboard",
      "jobs",
      "[id]",
      "applications",
      "InterestSelect.tsx",
    );
    const kanbanAction = read("app", "dashboard", "jobs", "[id]", "page.tsx");
    for (const source of [interestSelect, kanbanAction]) {
      expect(source).not.toContain('"MOVE_BACKWARD"');
      expect(source).not.toContain('"REOPEN_REJECTED"');
    }
  });

  it("routes hire through one explicit command and protects the terminal footprint", () => {
    const helper = read("lib", "hiring-process", "hired-footprint.ts");
    expect(helper).toContain('application.stage === "CLOSED"');
    expect(helper).toContain('application.disposition === "HIRED"');
    expect(helper).toContain('application.status === "HIRED"');
    expect(helper).not.toContain('recruiterInterest === "ACCEPTED"');
    expect(helper).not.toContain("hiredAt");

    const statusRoute = read("app", "api", "applications", "[id]", "status", "route.ts");
    const interestRoute = read("app", "api", "applications", "[id]", "interest", "route.ts");
    const applicationRoute = read("app", "api", "applications", "[id]", "route.ts");
    for (const source of [statusRoute, interestRoute, applicationRoute]) {
      expect(source).toContain("hasApplicationHiredFootprint");
      expect(source).toContain("APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE");
    }
    expect(statusRoute).toContain('if (newStatus === "HIRED")');
    expect(applicationRoute).toContain('if (body.status === "HIRED")');

    const shell = read("components", "dashboard", "CandidateReviewShell.tsx");
    expect(shell).toContain('intent: "HIRE_CANDIDATE"');
    expect(shell).toContain("Contratar");
    expect(shell).toContain("terminalHired");
    expect(shell).toContain("updated.hiredAt");

    const kanbanAction = read("app", "dashboard", "jobs", "[id]", "page.tsx");
    const kanban = read("app", "dashboard", "jobs", "[id]", "KanbanBoard.tsx");
    const overview = read("app", "dashboard", "overview", "actions.ts");
    const interestSelect = read("app", "dashboard", "jobs", "[id]", "applications", "InterestSelect.tsx");
    expect(kanbanAction).toContain("hasApplicationHiredFootprint");
    for (const source of [overview]) {
      expect(source).toContain("hasApplicationHiredFootprint");
      expect(source).toContain("APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE");
    }
    expect(kanban).toContain('moved.applicationStatus === "HIRED"');
    expect(interestSelect).toContain("terminalHired");

    const intentRoute = read("app", "api", "applications", "[id]", "intent", "route.ts");
    expect(intentRoute).toContain("result.timestamps.hiredAt");
    expect(intentRoute).not.toContain("prisma.application.findUnique");
  });
});
