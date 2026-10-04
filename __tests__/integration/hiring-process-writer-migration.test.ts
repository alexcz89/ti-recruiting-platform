import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/prisma";
import {
  createApplicationForHiringProcessRollout,
  createCanonicalApplication,
} from "@/lib/hiring-process/create-application";
import { executeApplicationIntent } from "@/lib/hiring-process/application-intents";
import {
  CanonicalStateUnavailableError,
  ConcurrentApplicationTransitionError,
  UnauthorizedApplicationTransitionError,
} from "@/lib/hiring-process/transition-application";

const databaseUrl = process.env.DATABASE_URL ?? "";
const safeDatabase =
  databaseUrl.includes("127.0.0.1:55433") &&
  databaseUrl.includes("taskio_canonical_hiring_qa");
const runDatabaseTests =
  process.env.RUN_HIRING_PROCESS_DB_TESTS === "true" && safeDatabase;
const describeDatabase = runDatabaseTests ? describe : describe.skip;

const ids = {
  company: "qa-writer-company",
  otherCompany: "qa-writer-other-company",
  candidate: "qa-writer-candidate",
  recruiter: "qa-writer-recruiter",
  otherRecruiter: "qa-writer-other-recruiter",
  job: "qa-writer-job",
};

const recruiterActor = {
  type: "RECRUITER" as const,
  id: ids.recruiter,
  companyId: ids.company,
};

async function cleanup() {
  await prisma.applicationEvent.deleteMany({
    where: { application: { jobId: ids.job } },
  });
  await prisma.application.deleteMany({ where: { jobId: ids.job } });
  await prisma.job.deleteMany({ where: { id: ids.job } });
  await prisma.recruiterProfile.deleteMany({
    where: { userId: { in: [ids.recruiter, ids.otherRecruiter] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.candidate, ids.recruiter, ids.otherRecruiter] } },
  });
  await prisma.company.deleteMany({
    where: { id: { in: [ids.company, ids.otherCompany] } },
  });
}

async function fixtures() {
  await prisma.company.createMany({
    data: [
      { id: ids.company, name: "QA Writer Company" },
      { id: ids.otherCompany, name: "QA Writer Other Company" },
    ],
  });
  await prisma.user.createMany({
    data: [
      { id: ids.candidate, email: "qa-writer-candidate@example.invalid", role: "CANDIDATE" },
      { id: ids.recruiter, email: "qa-writer-recruiter@example.invalid", role: "RECRUITER" },
      { id: ids.otherRecruiter, email: "qa-writer-other@example.invalid", role: "RECRUITER" },
    ],
  });
  await prisma.recruiterProfile.createMany({
    data: [
      { userId: ids.recruiter, companyId: ids.company, companyName: "QA Writer Company", status: "APPROVED" },
      { userId: ids.otherRecruiter, companyId: ids.otherCompany, companyName: "QA Writer Other Company", status: "APPROVED" },
    ],
  });
  await prisma.job.create({
    data: {
      id: ids.job,
      companyId: ids.company,
      title: "QA Writer Job",
      location: "Local QA",
      employmentType: "FULL_TIME",
      description: "Synthetic writer migration fixture",
      skills: [],
    },
  });
}

async function createApplication() {
  return createCanonicalApplication({
    jobId: ids.job,
    candidateId: ids.candidate,
    coverLetter: "QA",
    resumeUrl: null,
    happenedAt: new Date("2026-10-03T12:00:00.000Z"),
  });
}

async function createRolloutApplication() {
  return createApplicationForHiringProcessRollout({
    jobId: ids.job,
    candidateId: ids.candidate,
    coverLetter: "QA",
    resumeUrl: null,
    happenedAt: new Date("2026-10-03T12:00:00.000Z"),
  });
}

describeDatabase("canonical hiring process writer migration", () => {
  beforeEach(async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    await cleanup();
    await fixtures();
  });

  afterAll(async () => {
    if (!runDatabaseTests) return;
    await cleanup();
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("creates the canonical snapshot, legacy projection, and APPLICATION_CREATED exactly once when the flag is on", async () => {
    const created = await createRolloutApplication();
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: created.id },
      include: { events: true },
    });

    expect(stored).toMatchObject({
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 1,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      type: "APPLICATION_CREATED",
      actorType: "CANDIDATE",
      actorId: ids.candidate,
      fromStage: null,
      toStage: "APPLIED",
      fromDisposition: null,
      toDisposition: "ACTIVE",
    });

    await expect(createRolloutApplication()).rejects.toMatchObject({ code: "P2002" });
    expect(await prisma.applicationEvent.count({ where: { applicationId: created.id } })).toBe(1);
  });

  it("preserves exact legacy creation with no canonical event when the flag is off", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");

    const created = await createRolloutApplication();
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: created.id },
      include: { events: true },
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

  it("executes START_REVIEW and MOVE_TO_INTERVIEW with their exact projections", async () => {
    const application = await createApplication();
    await executeApplicationIntent({
      applicationId: application.id,
      command: { intent: "START_REVIEW", expectedVersion: 1, commandId: "qa-start-review" },
      actor: recruiterActor,
    });
    const result = await executeApplicationIntent({
      applicationId: application.id,
      command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 2, commandId: "qa-interview" },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: { events: { orderBy: { recordedAt: "asc" } } },
    });

    expect(result.legacy).toEqual({
      status: "INTERVIEW",
      recruiterInterest: "ACCEPTED",
      stateVersion: 3,
    });
    expect(stored).toMatchObject({
      stage: "INTERVIEW",
      disposition: "ACTIVE",
      status: "INTERVIEW",
      recruiterInterest: "ACCEPTED",
      stateVersion: 3,
    });
    expect(stored.status).not.toBe("OFFER");
    expect(stored.events.map((event) => event.type)).toEqual([
      "APPLICATION_CREATED",
      "APPLICATION_STAGE_CHANGED",
      "APPLICATION_STAGE_CHANGED",
    ]);
  });

  it("deduplicates an interview retry and rejects a stale different command", async () => {
    const application = await createApplication();
    const command = {
      intent: "MOVE_TO_INTERVIEW" as const,
      expectedVersion: 1,
      commandId: "qa-interview-retry",
    };
    const first = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const retry = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(2);

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { ...command, commandId: "qa-stale-command" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
  });

  it("denies cross-tenant recruiters and candidates", async () => {
    const application = await createApplication();
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 1, commandId: "qa-cross-tenant" },
        actor: { type: "RECRUITER", id: ids.otherRecruiter, companyId: ids.otherCompany },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 1, commandId: "qa-candidate" },
        actor: { type: "CANDIDATE", id: ids.candidate },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);
  });

  it("keeps flag-off legacy applications non-canonical while applying INTERVIEW + ACCEPTED", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();

    const result = await executeApplicationIntent({
      applicationId: application.id,
      command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 0, commandId: "qa-legacy-interview" },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    expect(result.legacy).toEqual({ status: "INTERVIEW", recruiterInterest: "ACCEPTED", stateVersion: 0 });
    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "INTERVIEW",
      recruiterInterest: "ACCEPTED",
    });
    expect(stored.status).not.toBe("OFFER");
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("refuses flag-off legacy fallback for an already-canonical application", async () => {
    const application = await createApplication();
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 1, commandId: "qa-unsafe-legacy-interview" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(CanonicalStateUnavailableError);

    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 1,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
  });

  it("fails closed for a partial canonical snapshot while the flag is off", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: { stage: "APPLIED" },
    });

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 0, commandId: "qa-partial-canonical" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(CanonicalStateUnavailableError);

    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
      stage: "APPLIED",
      disposition: null,
      stateVersion: 0,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
  });
});
