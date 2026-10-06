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
  it("supports only the four approved explicit intents", () => {
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
    expect(() =>
      applicationIntentSchema.parse({
        intent: "HIRE_CANDIDATE",
        expectedVersion: 1,
        commandId: "unsupported-command",
      }),
    ).toThrow();
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

    expect(interestSelect).toContain('next === "ACCEPTED" || next === "REJECTED"');
    expect(interestSelect).toContain('"REJECT_CANDIDATE"');
    expect(interestSelect).toMatch(
      /next === "ACCEPTED" \|\| next === "REJECTED"[\s\S]*\/intent[\s\S]*return;/,
    );
    expect(candidateShell).toContain('? "REJECT_CANDIDATE"');
    expect(candidateShell).toContain('if (currentInterest === "REJECTED") return;');
    expect(kanban).toContain('toStatus === "ACCEPTED" || toStatus === "REJECTED"');
    expect(jobPage).toContain(': "REJECT_CANDIDATE"');
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

    const serverWriters = [
      read("app", "api", "applications", "[id]", "status", "route.ts"),
      read("app", "api", "applications", "[id]", "interest", "route.ts"),
      read("app", "api", "applications", "[id]", "route.ts"),
      read("app", "dashboard", "jobs", "[id]", "page.tsx"),
      read("app", "dashboard", "overview", "actions.ts"),
    ];
    for (const source of serverWriters) {
      expect(source).toContain("hasCanonicalApplicationOffer");
      expect(source).toContain("APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE");
    }

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
});
