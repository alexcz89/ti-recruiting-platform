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
  it("supports only the two approved explicit intents", () => {
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
    expect(() =>
      applicationIntentSchema.parse({
        intent: "MOVE_TO_OFFER",
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

  it("routes candidate application submission through atomic canonical creation", () => {
    const applicationsRoute = read("app", "api", "applications", "route.ts");
    expect(applicationsRoute).toContain("createCanonicalApplication({");
    expect(applicationsRoute).not.toContain("prisma.application.create({");
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

    expect(interestSelect).toContain('intent: "MOVE_TO_INTERVIEW"');
    expect(interestSelect).not.toContain('ACCEPTED: "OFFER"');
  });
});
