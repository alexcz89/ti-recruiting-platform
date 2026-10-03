import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationInterest, ApplicationStatus } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";
import { createLegacyApplicationReconciler } from "@/lib/hiring-process/reconcile-legacy-applications";
import { transitionApplication } from "@/lib/hiring-process/transition-application";

const reconcileLegacyApplications = createLegacyApplicationReconciler(prisma);

const databaseUrl = process.env.DATABASE_URL ?? "";
const safeDatabase =
  databaseUrl.includes("127.0.0.1:55433") &&
  databaseUrl.includes("taskio_canonical_hiring_qa");
const runDatabaseTests =
  process.env.RUN_HIRING_PROCESS_DB_TESTS === "true" && safeDatabase;
const describeDatabase = runDatabaseTests ? describe : describe.skip;

const ids = {
  company: "qa-reconcile-company",
  candidate: "qa-reconcile-candidate",
  job: "qa-reconcile-job",
  application: "qa-reconcile-application",
  template: "qa-reconcile-template",
  attempt: "qa-reconcile-attempt",
};

async function removeFixtures() {
  await prisma.$executeRawUnsafe(
    'DROP TRIGGER IF EXISTS "qa_fail_reconciliation_event" ON "ApplicationEvent"',
  );
  await prisma.$executeRawUnsafe(
    'DROP FUNCTION IF EXISTS "qa_fail_reconciliation_event_write"()',
  );
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: { startsWith: "qa-reconcile-" } },
  });
  await prisma.assessmentAttempt.deleteMany({
    where: { id: { startsWith: "qa-reconcile-" } },
  });
  await prisma.application.deleteMany({
    where: { id: { startsWith: "qa-reconcile-" } },
  });
  await prisma.assessmentTemplate.deleteMany({
    where: { id: { startsWith: "qa-reconcile-" } },
  });
  await prisma.job.deleteMany({
    where: { id: { startsWith: "qa-reconcile-" } },
  });
  await prisma.user.deleteMany({
    where: { id: { startsWith: "qa-reconcile-" } },
  });
  await prisma.company.deleteMany({
    where: { id: { startsWith: "qa-reconcile-" } },
  });
}

async function createFixtures() {
  await prisma.company.create({
    data: { id: ids.company, name: "QA Reconcile Company" },
  });
  await prisma.user.create({
    data: {
      id: ids.candidate,
      email: "qa-reconcile-candidate@example.invalid",
      role: "CANDIDATE",
    },
  });
  await prisma.job.create({
    data: {
      id: ids.job,
      companyId: ids.company,
      title: "QA Reconcile Job",
      location: "Local QA",
      employmentType: "FULL_TIME",
      description: "Synthetic reconciliation fixture",
      skills: [],
    },
  });
  await prisma.application.create({
    data: {
      id: ids.application,
      jobId: ids.job,
      candidateId: ids.candidate,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    },
  });
  await prisma.assessmentTemplate.create({
    data: {
      id: ids.template,
      title: "QA Reconcile Assessment",
      slug: "qa-reconcile-assessment",
      type: "MCQ",
      difficulty: "MID",
      totalQuestions: 1,
      passingScore: 70,
      timeLimit: 30,
      sections: [],
    },
  });
  await prisma.assessmentAttempt.create({
    data: {
      id: ids.attempt,
      candidateId: ids.candidate,
      templateId: ids.template,
      applicationId: ids.application,
      status: "IN_PROGRESS",
      startedAt: new Date("2026-10-02T12:00:00.000Z"),
    },
  });
}

async function setLegacy(
  status: ApplicationStatus,
  recruiterInterest: ApplicationInterest,
) {
  await prisma.application.update({
    where: { id: ids.application },
    data: { status, recruiterInterest },
  });
}

async function storedApplication(applicationId = ids.application) {
  return prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { events: { orderBy: { recordedAt: "asc" } } },
  });
}

async function apply(applicationId = ids.application) {
  return reconcileLegacyApplications({
    mode: "apply",
    applicationId,
    batchSize: 10,
  });
}

async function createScopedApplication(
  suffix: string,
  companyId: string,
  jobId: string,
) {
  const candidateId = `qa-reconcile-candidate-${suffix}`;
  const applicationId = `qa-reconcile-application-${suffix}`;
  await prisma.user.create({
    data: {
      id: candidateId,
      email: `${candidateId}@example.invalid`,
      role: "CANDIDATE",
    },
  });
  await prisma.application.create({
    data: {
      id: applicationId,
      jobId,
      candidateId,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    },
  });
  return applicationId;
}

describeDatabase("safe canonical application reconciliation", () => {
  beforeAll(async () => {
    await removeFixtures();
  });

  beforeEach(async () => {
    await removeFixtures();
    await createFixtures();
  });

  afterAll(async () => {
    if (!runDatabaseTests) return;
    await removeFixtures();
    await prisma.$disconnect();
  });

  it("keeps dry-run read-only while reporting a safe import candidate", async () => {
    const result = await reconcileLegacyApplications({
      mode: "dry-run",
      applicationId: ids.application,
      batchSize: 10,
    });
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: ids.application },
      include: { events: true },
    });

    expect(result).toMatchObject({
      mode: "dry-run",
      processed: 1,
      wouldImport: 1,
      imported: 0,
      conflicts: 0,
      failures: 0,
    });
    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
    expect(stored.events).toHaveLength(0);
  });

  it.each([
    ["SUBMITTED", "REVIEW", "APPLIED", "ACTIVE"],
    ["REVIEWING", "REVIEW", "REVIEW", "ACTIVE"],
    ["REVIEWING", "MAYBE", "REVIEW", "ACTIVE"],
    ["INTERVIEW", "ACCEPTED", "INTERVIEW", "ACTIVE"],
    ["OFFER", "ACCEPTED", "OFFER", "ACTIVE"],
    ["REJECTED", "REJECTED", "CLOSED", "REJECTED"],
    ["HIRED", "ACCEPTED", "CLOSED", "HIRED"],
  ] as const)(
    "imports safe %s + %s as %s/%s without changing legacy state",
    async (status, recruiterInterest, stage, disposition) => {
      vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
      await setLegacy(status, recruiterInterest);

      const result = await apply();
      const stored = await storedApplication();

      expect(result).toMatchObject({ imported: 1, conflicts: 0, failures: 0 });
      expect(stored).toMatchObject({
        status,
        recruiterInterest,
        stage,
        disposition,
        stateVersion: 1,
      });
      expect(stored.events).toHaveLength(1);
      expect(stored.events[0]).toMatchObject({
        type: "LEGACY_STATE_IMPORTED",
        actorType: "IMPORT",
        actorId: null,
        visibility: "INTERNAL",
        fromStage: null,
        toStage: stage,
        fromDisposition: null,
        toDisposition: disposition,
        idempotencyKey:
          "legacy-state-import:legacy-application-state-matrix:v1",
      });
      expect(stored.events[0].happenedAt).toBeInstanceOf(Date);
      expect(stored.events[0].recordedAt).toBeInstanceOf(Date);
      expect(stored.events[0].metadata).toEqual({
        schemaVersion: 1,
        mappingVersion: "legacy-application-state-matrix:v1",
        legacy: { status, recruiterInterest },
        classification: "SAFE_AUTO_MAP",
        imported: { stage, disposition },
      });
      expect(JSON.stringify(stored.events[0].metadata)).not.toContain(
        "qa-reconcile-candidate@example.invalid",
      );
    },
  );

  it.each([
    ["SUBMITTED", "MAYBE", "LIKELY_REVIEW"],
    ["REVIEWING", "ACCEPTED", "AMBIGUOUS"],
    ["SUBMITTED", "REJECTED", "CONTRADICTORY"],
  ] as const)(
    "does not write %s + %s classified as %s",
    async (status, recruiterInterest, classification) => {
      await setLegacy(status, recruiterInterest);

      const result = await apply();
      const stored = await storedApplication();

      expect(result).toMatchObject({
        imported: 0,
        requiresReview: 1,
        conflicts: 0,
      });
      expect(result.items[0].classification).toBe(classification);
      expect(stored).toMatchObject({
        stage: null,
        disposition: null,
        stateVersion: 0,
        status,
        recruiterInterest,
      });
      expect(stored.events).toHaveLength(0);
    },
  );

  it("is idempotent across reruns and concurrent apply calls", async () => {
    const concurrent = await Promise.all([apply(), apply()]);
    const rerun = await apply();
    const stored = await storedApplication();

    expect(concurrent.reduce((sum, result) => sum + result.imported, 0)).toBe(1);
    expect(rerun).toMatchObject({ imported: 0, skipped: 1 });
    expect(stored).toMatchObject({ stateVersion: 1 });
    expect(stored.events).toHaveLength(1);
  });

  it("recognizes a valid baseline after later canonical transitions", async () => {
    expect((await apply()).imported).toBe(1);
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    await transitionApplication({
      applicationId: ids.application,
      targetStage: "REVIEW",
      targetDisposition: "ACTIVE",
      expectedVersion: 1,
      actor: { type: "SYSTEM" },
      idempotencyKey: "qa-reconcile-later-transition",
    });

    const rerun = await apply();
    const stored = await storedApplication();

    expect(rerun).toMatchObject({ imported: 0, skipped: 1, conflicts: 0 });
    expect(stored).toMatchObject({
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 2,
      status: "REVIEWING",
      recruiterInterest: "REVIEW",
    });
    expect(stored.events).toHaveLength(2);
  });

  it("rolls back the canonical snapshot when baseline event insertion fails", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "qa_fail_reconciliation_event_write"() RETURNS trigger AS $$
      BEGIN
        IF NEW."applicationId" = '${ids.application}' THEN
          RAISE EXCEPTION 'qa reconciliation event failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "qa_fail_reconciliation_event"
      BEFORE INSERT ON "ApplicationEvent"
      FOR EACH ROW EXECUTE FUNCTION "qa_fail_reconciliation_event_write"()
    `);

    const result = await apply();
    const stored = await storedApplication();

    expect(result.failures).toBe(1);
    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
    expect(stored.events).toHaveLength(0);
  });

  it("reports partial canonical state as a conflict", async () => {
    await prisma.application.update({
      where: { id: ids.application },
      data: { stage: "APPLIED" },
    });

    const result = await apply();

    expect(result).toMatchObject({ imported: 0, conflicts: 1 });
    expect(result.items[0].reason).toBe("Partial canonical state");
  });

  it("reports a canonical snapshot that contradicts the safe mapping", async () => {
    await prisma.application.update({
      where: { id: ids.application },
      data: { stage: "REVIEW", disposition: "ACTIVE", stateVersion: 1 },
    });
    await prisma.applicationEvent.create({
      data: {
        applicationId: ids.application,
        companyId: ids.company,
        actorType: "IMPORT",
        type: "LEGACY_STATE_IMPORTED",
        toStage: "REVIEW",
        toDisposition: "ACTIVE",
        visibility: "INTERNAL",
        idempotencyKey:
          "legacy-state-import:legacy-application-state-matrix:v1",
        metadata: {
          schemaVersion: 1,
          mappingVersion: "legacy-application-state-matrix:v1",
          legacy: { status: "SUBMITTED", recruiterInterest: "REVIEW" },
          classification: "SAFE_AUTO_MAP",
          imported: { stage: "REVIEW", disposition: "ACTIVE" },
        },
      },
    });

    const result = await apply();

    expect(result).toMatchObject({ imported: 0, conflicts: 1 });
    expect(result.items[0].reason).toContain("contradicts safe mapping");
  });

  it("rejects a baseline event attributed to another company", async () => {
    const otherCompany = "qa-reconcile-company-event-owner";
    await prisma.company.create({
      data: { id: otherCompany, name: "QA Reconcile Event Owner" },
    });
    await prisma.application.update({
      where: { id: ids.application },
      data: { stage: "APPLIED", disposition: "ACTIVE", stateVersion: 1 },
    });
    await prisma.applicationEvent.create({
      data: {
        applicationId: ids.application,
        companyId: otherCompany,
        actorType: "IMPORT",
        type: "LEGACY_STATE_IMPORTED",
        toStage: "APPLIED",
        toDisposition: "ACTIVE",
        visibility: "INTERNAL",
        idempotencyKey:
          "legacy-state-import:legacy-application-state-matrix:v1",
        metadata: {
          schemaVersion: 1,
          mappingVersion: "legacy-application-state-matrix:v1",
          legacy: { status: "SUBMITTED", recruiterInterest: "REVIEW" },
          classification: "SAFE_AUTO_MAP",
          imported: { stage: "APPLIED", disposition: "ACTIVE" },
        },
      },
    });

    const result = await apply();

    expect(result).toMatchObject({ imported: 0, conflicts: 1 });
    expect(result.items[0].reason).toContain("contradicts safe mapping");
  });

  it("reports baseline-without-snapshot and snapshot-without-baseline conflicts", async () => {
    await prisma.applicationEvent.create({
      data: {
        applicationId: ids.application,
        companyId: ids.company,
        actorType: "IMPORT",
        type: "LEGACY_STATE_IMPORTED",
        toStage: "APPLIED",
        toDisposition: "ACTIVE",
        visibility: "INTERNAL",
        idempotencyKey:
          "legacy-state-import:legacy-application-state-matrix:v1",
      },
    });
    const eventWithoutSnapshot = await apply();
    expect(eventWithoutSnapshot.items[0].reason).toContain(
      "Baseline event exists without canonical snapshot",
    );

    await prisma.applicationEvent.deleteMany({
      where: { applicationId: ids.application },
    });
    await prisma.application.update({
      where: { id: ids.application },
      data: { stage: "APPLIED", disposition: "ACTIVE", stateVersion: 1 },
    });
    const snapshotWithoutEvent = await apply();
    expect(snapshotWithoutEvent.items[0].reason).toContain(
      "Canonical snapshot exists without baseline event",
    );
  });

  it("does not import an outdated legacy combination during a concurrent change", async () => {
    let releaseLock!: () => void;
    let locked!: () => void;
    const lockReady = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const writer = prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT id FROM "Application" WHERE id = '${ids.application}' FOR UPDATE`,
      );
      locked();
      await release;
      await tx.application.update({
        where: { id: ids.application },
        data: { status: "REVIEWING", recruiterInterest: "ACCEPTED" },
      });
    });
    await lockReady;
    const reconciliation = apply();
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    releaseLock();
    await writer;
    const result = await reconciliation;
    const stored = await storedApplication();

    expect(result).toMatchObject({ imported: 0, conflicts: 1 });
    expect(result.items[0].reason).toBe("Application changed concurrently");
    expect(stored).toMatchObject({
      status: "REVIEWING",
      recruiterInterest: "ACCEPTED",
      stage: null,
      disposition: null,
      stateVersion: 0,
    });
    expect(stored.events).toHaveLength(0);
  });

  it("processes recoverable batches using the returned cursor", async () => {
    const second = await createScopedApplication("batch", ids.company, ids.job);
    const firstBatch = await reconcileLegacyApplications({
      mode: "apply",
      companyId: ids.company,
      batchSize: 1,
    });
    const secondBatch = await reconcileLegacyApplications({
      mode: "apply",
      companyId: ids.company,
      batchSize: 1,
      afterId: firstBatch.nextAfterId ?? undefined,
    });

    expect(firstBatch).toMatchObject({ processed: 1, imported: 1 });
    expect(firstBatch.nextAfterId).toBeTruthy();
    expect(secondBatch).toMatchObject({ processed: 1, imported: 1 });
    expect((await storedApplication(second)).stage).toBe("APPLIED");
  });

  it("limits reconciliation to the requested company", async () => {
    const otherCompany = "qa-reconcile-company-other";
    const otherJob = "qa-reconcile-job-other";
    await prisma.company.create({
      data: { id: otherCompany, name: "QA Reconcile Other Company" },
    });
    await prisma.job.create({
      data: {
        id: otherJob,
        companyId: otherCompany,
        title: "QA Reconcile Other Job",
        location: "Local QA",
        employmentType: "FULL_TIME",
        description: "Synthetic tenant fixture",
        skills: [],
      },
    });
    const otherApplication = await createScopedApplication(
      "other",
      otherCompany,
      otherJob,
    );

    const result = await reconcileLegacyApplications({
      mode: "apply",
      companyId: ids.company,
      batchSize: 10,
    });

    expect(result.items.every((item) => item.companyId === ids.company)).toBe(true);
    expect((await storedApplication()).stage).toBe("APPLIED");
    expect((await storedApplication(otherApplication)).stage).toBeNull();
  });

  it("preserves linked assessment state", async () => {
    await apply();
    const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: ids.attempt },
    });

    expect(attempt).toMatchObject({
      applicationId: ids.application,
      status: "IN_PROGRESS",
      startedAt: new Date("2026-10-02T12:00:00.000Z"),
    });
  });
});
