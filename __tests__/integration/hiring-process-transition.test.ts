import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/prisma";
import {
  ConcurrentApplicationTransitionError,
  UnauthorizedApplicationTransitionError,
  transitionApplication,
} from "@/lib/hiring-process/transition-application";
import { collectApplicationDivergenceReport } from "@/lib/hiring-process/divergence-report";

const databaseUrl = process.env.DATABASE_URL ?? "";
const safeDatabase =
  databaseUrl.includes("127.0.0.1:55433") &&
  databaseUrl.includes("taskio_canonical_hiring_qa");
const runDatabaseTests =
  process.env.RUN_HIRING_PROCESS_DB_TESTS === "true" && safeDatabase;
const describeDatabase = runDatabaseTests ? describe : describe.skip;

const ids = {
  company: "qa-hiring-company",
  candidate: "qa-hiring-candidate",
  recruiter: "qa-hiring-recruiter",
  job: "qa-hiring-job",
  application: "qa-hiring-application",
};

const actor = {
  type: "RECRUITER" as const,
  id: "qa-hiring-recruiter",
  companyId: ids.company,
};

async function removeFixtures() {
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: ids.application },
  });
  await prisma.application.deleteMany({ where: { id: ids.application } });
  await prisma.job.deleteMany({ where: { id: ids.job } });
  await prisma.recruiterProfile.deleteMany({ where: { userId: ids.recruiter } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.candidate, ids.recruiter] } } });
  await prisma.company.deleteMany({ where: { id: ids.company } });
}

async function createFixtures() {
  await prisma.company.create({ data: { id: ids.company, name: "QA Hiring Company" } });
  await prisma.user.create({
    data: {
      id: ids.candidate,
      email: "qa-canonical-hiring-candidate@example.invalid",
      role: "CANDIDATE",
    },
  });
  await prisma.user.create({
    data: {
      id: ids.recruiter,
      email: "qa-canonical-hiring-recruiter@example.invalid",
      role: "RECRUITER",
    },
  });
  await prisma.recruiterProfile.create({
    data: {
      userId: ids.recruiter,
      companyId: ids.company,
      companyName: "QA Hiring Company",
      status: "APPROVED",
    },
  });
  await prisma.job.create({
    data: {
      id: ids.job,
      companyId: ids.company,
      title: "QA Canonical Hiring Job",
      location: "Local QA",
      employmentType: "FULL_TIME",
      description: "Synthetic fixture",
      skills: [],
    },
  });
  await prisma.application.create({
    data: {
      id: ids.application,
      jobId: ids.job,
      candidateId: ids.candidate,
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    },
  });
}

describeDatabase("transitionApplication with PostgreSQL", () => {
  beforeAll(() => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "qa_fail_application_event" ON "ApplicationEvent"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "qa_fail_application_event_write"()',
    );
    await removeFixtures();
    await createFixtures();
  });

  afterAll(async () => {
    if (!runDatabaseTests) return;
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "qa_fail_application_event" ON "ApplicationEvent"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "qa_fail_application_event_write"()',
    );
    await removeFixtures();
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("commits canonical state, legacy projection and event together", async () => {
    const result = await transitionApplication(
      {
        applicationId: ids.application,
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor,
        idempotencyKey: "qa-review",
      },
    );

    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: ids.application },
      include: { events: true },
    });
    expect(result.state).toEqual({
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 1,
    });
    expect(stored).toMatchObject({
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 1,
      status: "REVIEWING",
      recruiterInterest: "REVIEW",
    });
    expect(stored.events).toHaveLength(1);
  });

  it("rolls back the state when PostgreSQL rejects the event insert", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "qa_fail_application_event_write"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'qa event failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "qa_fail_application_event"
      BEFORE INSERT ON "ApplicationEvent"
      FOR EACH ROW EXECUTE FUNCTION "qa_fail_application_event_write"()
    `);

    await expect(
      transitionApplication(
        {
          applicationId: ids.application,
          targetStage: "REVIEW",
          expectedVersion: 0,
          actor,
        },
      ),
    ).rejects.toThrow();

    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: ids.application },
    });
    expect(stored).toMatchObject({
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
    expect(
      await prisma.applicationEvent.count({
        where: { applicationId: ids.application },
      }),
    ).toBe(0);
  });

  it("deduplicates an idempotent retry", async () => {
    const input = {
      applicationId: ids.application,
      targetStage: "REVIEW" as const,
      expectedVersion: 0,
      actor,
      idempotencyKey: "qa-idempotent",
    };
    const first = await transitionApplication(input);
    const retry = await transitionApplication(input);

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.event.id).toBe(first.event.id);
    expect(
      await prisma.applicationEvent.count({
        where: { applicationId: ids.application },
      }),
    ).toBe(1);
  });

  it("rejects a recruiter whose persisted profile is not approved", async () => {
    await prisma.recruiterProfile.update({
      where: { userId: ids.recruiter },
      data: { status: "PENDING" },
    });

    await expect(
      transitionApplication({
        applicationId: ids.application,
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);

    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: ids.application },
      include: { events: true },
    });
    expect(stored.stateVersion).toBe(0);
    expect(stored.events).toHaveLength(0);
  });

  it("allows only one of two transitions with the same expected version", async () => {
    const outcomes = await Promise.allSettled([
      transitionApplication(
        {
          applicationId: ids.application,
          targetStage: "REVIEW",
          expectedVersion: 0,
          actor,
        },
      ),
      transitionApplication(
        {
          applicationId: ids.application,
          targetStage: "INTERVIEW",
          expectedVersion: 0,
          actor,
        },
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(
      ConcurrentApplicationTransitionError,
    );
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: ids.application },
    });
    expect(stored.stateVersion).toBe(1);
    expect(["REVIEW", "INTERVIEW"]).toContain(stored.stage);
    expect(
      await prisma.applicationEvent.count({
        where: { applicationId: ids.application },
      }),
    ).toBe(1);
  });

  it("runs the divergence report as an aggregate read", async () => {
    const report = await collectApplicationDivergenceReport({
      groupBy: async () => {
        const groups = await prisma.application.groupBy({
          by: ["status", "recruiterInterest"],
          _count: { _all: true },
          orderBy: [{ status: "asc" }, { recruiterInterest: "asc" }],
        });
        return groups.map((group) => ({
          status: group.status,
          recruiterInterest: group.recruiterInterest,
          _count: { _all: group._count._all },
        }));
      },
    });

    expect(report.totalApplications).toBe(1);
    expect(report.rows).toHaveLength(24);
    expect(report.rows).toContainEqual(
      expect.objectContaining({
        status: "SUBMITTED",
        recruiterInterest: "REVIEW",
        classification: "SAFE_AUTO_MAP",
        count: 1,
      }),
    );
  });
});
