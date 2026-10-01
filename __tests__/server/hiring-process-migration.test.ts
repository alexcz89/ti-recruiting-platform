import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    root,
    "prisma",
    "migrations",
    "20260930150000_add_canonical_hiring_process_foundation",
    "migration.sql",
  ),
  "utf8",
);

describe("canonical hiring process additive migration", () => {
  it("adds nullable canonical state and a non-destructive version field", () => {
    expect(schema).toMatch(/stage\s+ApplicationStage\?/);
    expect(schema).toMatch(/disposition\s+ApplicationDisposition\?/);
    expect(schema).toMatch(/stateVersion\s+Int\s+@default\(0\)/);
    expect(migration).toContain('ADD COLUMN     "stage" "ApplicationStage"');
    expect(migration).toContain('ADD COLUMN     "disposition" "ApplicationDisposition"');
    expect(migration).not.toMatch(/^ADD COLUMN\s+"stage"[^\r\n]*NOT NULL/m);
    expect(migration).not.toMatch(
      /^ADD COLUMN\s+"disposition"[^\r\n]*NOT NULL/m,
    );
  });

  it("creates the append-only event model with scoped idempotency and audit indexes", () => {
    expect(schema).toContain("model ApplicationEvent {");
    expect(schema).toContain("@@unique([companyId, applicationId, idempotencyKey])");
    expect(schema).toContain("@@index([applicationId, happenedAt])");
    expect(schema).toContain("@@index([companyId, happenedAt])");
    expect(migration).toContain('CREATE TABLE "ApplicationEvent"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "ApplicationEvent_companyId_applicationId_idempotencyKey_key"',
    );
  });

  it("does not drop or rename legacy state", () => {
    expect(schema).toMatch(/status\s+ApplicationStatus\s+@default\(SUBMITTED\)/);
    expect(schema).toMatch(/recruiterInterest\s+ApplicationInterest\s+@default\(REVIEW\)/);
    expect(migration).not.toMatch(/DROP\s+(COLUMN|TABLE|TYPE)/i);
    expect(migration).not.toMatch(/RENAME\s+(COLUMN|TABLE|TYPE)/i);
    expect(migration).not.toMatch(/UPDATE\s+"Application"/i);
  });
});
