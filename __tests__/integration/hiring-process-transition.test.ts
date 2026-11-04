import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/prisma";
import {
  ConcurrentApplicationTransitionError,
  UnauthorizedApplicationTransitionError,
  transitionApplication,
} from "@/lib/hiring-process/transition-application";
import { collectApplicationDivergenceReport } from "@/lib/hiring-process/divergence-report";
import { executeApplicationIntent } from "@/lib/hiring-process/application-intents";
import { InvalidApplicationTransitionError } from "@/lib/hiring-process/rules";
import { RECRUITING_STATES } from "@/lib/hiring-process/recruiter-state";

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
  it("deduplicates concurrent identical explicit commands during legacy conversion", async () => {
    await prisma.application.update({ where: { id: ids.application }, data: { stage: null, disposition: null } });
    const input = { applicationId: ids.application, actor, command: { intent: "SET_RECRUITING_STATE" as const, destination: "OFFER" as const, expectedVersion: 0, commandId: "same-concurrent-command" } };
    const outcomes = await Promise.all([executeApplicationIntent(input), executeApplicationIntent(input)]);
    expect(outcomes.filter(result => result.replayed)).toHaveLength(1);
    expect(await prisma.applicationEvent.count({ where: { applicationId: ids.application } })).toBe(1);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: ids.application } })).stateVersion).toBe(1);
  });
  it.each([true, false])("preserves hired state and history for every new destination, canonical source=%s", async canonical => {
    const hiredAt = new Date("2026-10-01T00:00:00Z");
    await prisma.application.update({ where: { id: ids.application }, data: {
      stage: canonical ? "CLOSED" : null, disposition: canonical ? "HIRED" : null,
      status: "HIRED", recruiterInterest: "ACCEPTED", hiredAt,
    } });
    const before = await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: true } });
    for (const destination of RECRUITING_STATES) {
      await expect(executeApplicationIntent({ applicationId: ids.application, actor, command: {
        intent: "SET_RECRUITING_STATE", destination, expectedVersion: 0, commandId: `hired-${destination}`, reasonCode: "CORRECTION",
      } })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
      expect(await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: true } })).toEqual(before);
    }
  });

  it("deduplicates concurrent hiring commands and preserves replay after the row becomes HIRED", async () => {
    await prisma.application.update({ where: { id: ids.application }, data: { stage: "OFFER", status: "OFFER", recruiterInterest: "ACCEPTED" } });
    const input = { applicationId: ids.application, actor, command: { intent: "SET_RECRUITING_STATE" as const, destination: "HIRED" as const,
      expectedVersion: 0, commandId: "hire-once" } };
    const results = await Promise.all([executeApplicationIntent(input), executeApplicationIntent(input)]);
    expect(results.filter(result => result.replayed)).toHaveLength(1);
    const hired = await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: true } });
    expect(hired).toMatchObject({ stage: "CLOSED", disposition: "HIRED", status: "HIRED", stateVersion: 1 });
    expect(hired.hiredAt).toBeInstanceOf(Date);
    expect(hired.events).toHaveLength(1);
    expect((await executeApplicationIntent(input)).replayed).toBe(true);
    await expect(executeApplicationIntent({ ...input, command: { intent: "SET_RECRUITING_STATE", destination: "REVIEW", expectedVersion: 1,
      commandId: "reopen-hired", reasonCode: "CORRECTION" } })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    expect(await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: true } })).toEqual(hired);
  });
  it("persists REVIEW → OFFER → REVIEW through the public intent contract without intermediate stages", async () => {
    await prisma.application.update({ where: { id: ids.application }, data: { stage: "REVIEW", status: "REVIEWING" } });
    const first = await executeApplicationIntent({ applicationId: ids.application, actor, command: {
      intent: "SET_RECRUITING_STATE", destination: "OFFER", expectedVersion: 0, commandId: "direct-offer",
    } });
    expect(first.state).toMatchObject({ stage: "OFFER", disposition: "ACTIVE", stateVersion: 1 });
    const second = await executeApplicationIntent({ applicationId: ids.application, actor, command: {
      intent: "SET_RECRUITING_STATE", destination: "REVIEW", expectedVersion: 1, commandId: "direct-review", reasonCode: "PROCESS_CHANGE",
    } });
    expect(second.state).toMatchObject({ stage: "REVIEW", stateVersion: 2 });
    const row = await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: { orderBy: { recordedAt: "asc" } } } });
    expect(row).toMatchObject({ stage: "REVIEW", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 2 });
    expect(row.events).toHaveLength(2);
    expect(row.events.map(e => [e.fromStage, e.toStage])).toEqual([["REVIEW", "OFFER"], ["OFFER", "REVIEW"]]);
    expect(row.events[1]).toMatchObject({ actorId: actor.id, reasonCode: "PROCESS_CHANGE" });
  });
  it("audits and deduplicates on-demand legacy conversion and rejected reopening", async () => {
    const rejectedAt = new Date("2026-10-01T00:00:00Z");
    await prisma.application.update({ where: { id: ids.application }, data: {
      stage: null, disposition: null, status: "REJECTED", recruiterInterest: "REJECTED", rejectedAt,
    } });
    const command = { intent: "SET_RECRUITING_STATE" as const, destination: "OFFER" as const, expectedVersion: 0, commandId: "reopen-rejected", reasonCode: "RECONSIDERED" as const };
    await executeApplicationIntent({ applicationId: ids.application, actor, command });
    const replay = await executeApplicationIntent({ applicationId: ids.application, actor, command });
    expect(replay.replayed).toBe(true);
    const row = await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: true } });
    expect(row).toMatchObject({ stage: "OFFER", disposition: "ACTIVE", status: "OFFER", recruiterInterest: "ACCEPTED", rejectedAt: null, hiredAt: null, stateVersion: 1 });
    expect(row.events).toHaveLength(1);
    expect(row.events[0].metadata).toMatchObject({ legacyImported: true, transitionClass: "REOPEN", previousState: { rejectedAt: rejectedAt.toISOString(), status: "REJECTED" } });
  });
  it("arbitrates concurrent explicit destinations and legacy conversion with one version and event", async () => {
    await prisma.application.update({ where: { id: ids.application }, data: { stage: null, disposition: null } });
    const results = await Promise.allSettled((["OFFER", "HIRED"] as const).map(destination => executeApplicationIntent({ applicationId: ids.application, actor,
      command: { intent: "SET_RECRUITING_STATE", destination, expectedVersion: 0, commandId: `concurrent-${destination}` } })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(ConcurrentApplicationTransitionError);
    const row = await prisma.application.findUniqueOrThrow({ where: { id: ids.application }, include: { events: true } });
    expect(row.stateVersion).toBe(1); expect(row.events).toHaveLength(1);
    expect(["OFFER", "CLOSED"]).toContain(row.stage);
  });
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
