import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const read = (...segments: string[]) =>
  readFileSync(join(process.cwd(), ...segments), "utf8");

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}

describe("candidate reader architecture", () => {
  it("keeps candidate applications on the centralized read model", () => {
    const page = read("app", "profile", "applications", "page.tsx");

    expect(page).toContain("buildCandidateApplicationReadRows");
    expect(page).toContain("filterCandidateProcessRows");
    expect(page).toContain("countCandidateProcessBuckets");
    expect(page).toContain("CANDIDATE_PROCESS_LABELS");
    expect(page).toContain(
      "isCanonicalHiringProcessCandidateReadsEnabled",
    );
    expect(page).toContain(
      'a._candidateRead.source === "CANONICAL"',
    );
    expect(page).toContain("?process=${bucket}");

    expect(page).not.toContain('a.stage ===');
    expect(page).not.toContain('a.disposition ===');
  });

  it("keeps candidate-safe stage presentation inside the centralized helper", () => {
    const helper = read(
      "lib",
      "hiring-process",
      "candidate-read-model.ts",
    );

    expect(helper).toContain(
      'RECEIVED: "Postulación recibida"',
    );
    expect(helper).toContain(
      'REVIEWING: "Revisando perfil"',
    );
    expect(helper).toContain(
      'ASSESSMENT: "Evaluación"',
    );
    expect(helper).toContain(
      'INTERVIEW: "Entrevista"',
    );
    expect(helper).toContain(
      'DECISION: "Decisión"',
    );
    expect(helper).toContain(
      'CLOSED: "Proceso cerrado"',
    );

    expect(helper).not.toContain("recruiterInterest");
    expect(helper).not.toContain('disposition === "HOLD"');
  });

  it("keeps candidate reads independently feature flagged", () => {
    const flags = read(
      "lib",
      "hiring-process",
      "feature-flags.ts",
    );

    expect(flags).toContain(
      "isCanonicalHiringProcessCandidateReadsEnabled",
    );
    expect(flags).toContain(
      'CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED === "true"',
    );
    expect(flags).toContain(
      "isCanonicalHiringProcessRecruiterReadsEnabled",
    );
  });
  it("keeps profile summary application presentation on the candidate read model", () => {
    const page = read("app", "profile", "summary", "page.tsx");
    const client = read(
      "app",
      "profile",
      "summary",
      "ProfileSummaryClient.tsx",
    );

    expect(page).toContain("buildCandidateApplicationReadRows");
    expect(page).toContain(
      "isCanonicalHiringProcessCandidateReadsEnabled",
    );
    expect(page).toContain("candidateApplicationRows.map");
    expect(page).toContain("readModel: a._candidateRead");

    expect(client).toContain(
      'application.readModel.source === "CANONICAL"',
    );
    expect(client).toContain("application.readModel.label");
    expect(client).toContain("application.readModel.bucket");

    // Legacy presentation remains available for flag-off/fallback rows.
    expect(client).toContain(
      "APPLICATION_STATUS_CONFIG[application.status]",
    );
    expect(client).toContain("legacyStatus");

    // Canonical state interpretation stays on the server-side read model.
    expect(client).not.toContain("application.stage");
    expect(client).not.toContain("application.disposition");
  });

  it("limits the candidate reader flag to its definition and candidate read surfaces", () => {
    const root = process.cwd();
    const consumers = ["app", "lib", "components"]
      .flatMap((directory) => sources(join(root, directory)))
      .filter((file) =>
        /\b(?:isCanonicalHiringProcessCandidateReadsEnabled|CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED)\b/.test(
          readFileSync(file, "utf8"),
        ),
      )
      .map((file) => relative(root, file).replaceAll("\\", "/"))
      .sort();

    expect(consumers).toEqual([
      "app/profile/applications/page.tsx",
      "app/profile/summary/page.tsx",
      "lib/hiring-process/feature-flags.ts",
    ]);
  });

  it("keeps the candidate read model free of writer and persistence concerns", () => {
    const helper = read("lib", "hiring-process", "candidate-read-model.ts");

    for (const forbidden of [
      "@/lib/server/prisma",
      "executeApplicationIntent",
      "transitionApplication",
      "getApplicationWriterCompatibility",
      "applicationEvent",
      "ApplicationEvent",
      ".update(",
      ".updateMany(",
      ".create(",
      "reconcile",
      "backfill",
      "expectedVersion",
      "stateVersion",
      "idempotency",
      "recruiterInterest",
    ]) {
      expect(helper).not.toContain(forbidden);
    }
  });

  it("keeps recruiter read semantics independent from the candidate reader flag", () => {
    const recruiterHelper = read(
      "lib",
      "hiring-process",
      "recruiter-read-model.ts",
    );

    expect(recruiterHelper).not.toContain(
      "isCanonicalHiringProcessCandidateReadsEnabled",
    );
    expect(recruiterHelper).not.toContain(
      "CANONICAL_HIRING_PROCESS_CANDIDATE_READS_ENABLED",
    );
  });
});
