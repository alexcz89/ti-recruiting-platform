import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/prisma";
import {
  createApplicationForHiringProcessRollout,
  createCanonicalApplication,
} from "@/lib/hiring-process/create-application";
import { executeApplicationIntent } from "@/lib/hiring-process/application-intents";
import {
  ApplicationNotFoundError,
  CanonicalStateUnavailableError,
  ConcurrentApplicationTransitionError,
  IdempotencyKeyConflictError,
  UnauthorizedApplicationTransitionError,
} from "@/lib/hiring-process/transition-application";
import { InvalidApplicationTransitionError } from "@/lib/hiring-process/rules";

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
  admin: "qa-writer-admin",
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
    where: { id: { in: [ids.candidate, ids.recruiter, ids.otherRecruiter, ids.admin] } },
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
      { id: ids.admin, email: "qa-writer-admin@example.invalid", role: "ADMIN" },
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

async function createInterviewApplication() {
  const application = await createApplication();
  return prisma.application.update({
    where: { id: application.id },
    data: {
      stage: "INTERVIEW",
      disposition: "ACTIVE",
      status: "INTERVIEW",
      recruiterInterest: "ACCEPTED",
    },
  });
}

async function createOfferApplication() {
  const application = await createApplication();
  return prisma.application.update({
    where: { id: application.id },
    data: {
      stage: "OFFER",
      disposition: "ACTIVE",
      status: "OFFER",
      recruiterInterest: "ACCEPTED",
      offerAt: new Date("2026-10-05T12:10:00.000Z"),
    },
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

  it("moves only INTERVIEW/ACTIVE to OFFER/ACTIVE with one internal event", async () => {
    const application = await createInterviewApplication();
    const command = {
      intent: "MOVE_TO_OFFER" as const,
      expectedVersion: 1,
      commandId: "qa-move-to-offer",
    };

    const first = await executeApplicationIntent({
      applicationId: application.id,
      command,
      actor: recruiterActor,
    });
    const storedAfterFirst = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: { events: { orderBy: { recordedAt: "asc" } } },
    });
    const retry = await executeApplicationIntent({
      applicationId: application.id,
      command,
      actor: recruiterActor,
    });
    const storedAfterRetry = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: { events: { orderBy: { recordedAt: "asc" } } },
    });

    expect(first).toMatchObject({
      state: { stage: "OFFER", disposition: "ACTIVE", stateVersion: 2 },
      replayed: false,
      legacy: {
        status: "OFFER",
        recruiterInterest: "ACCEPTED",
        stateVersion: 2,
      },
    });
    expect(storedAfterFirst).toMatchObject({
      stage: "OFFER",
      disposition: "ACTIVE",
      stateVersion: 2,
      status: "OFFER",
      recruiterInterest: "ACCEPTED",
    });
    expect(storedAfterFirst.offerAt).toBeInstanceOf(Date);
    expect(first.timestamps.offerAt).toEqual(storedAfterFirst.offerAt);
    expect(storedAfterFirst.events).toHaveLength(2);
    expect(storedAfterFirst.events[1]).toMatchObject({
      type: "APPLICATION_STAGE_CHANGED",
      visibility: "INTERNAL",
      actorType: "RECRUITER",
      actorId: ids.recruiter,
      fromStage: "INTERVIEW",
      toStage: "OFFER",
      fromDisposition: "ACTIVE",
      toDisposition: "ACTIVE",
    });
    expect(retry.replayed).toBe(true);
    expect(retry.timestamps.offerAt).toEqual(storedAfterFirst.offerAt);
    expect(storedAfterRetry.offerAt).toEqual(storedAfterFirst.offerAt);
    expect(storedAfterRetry.events).toHaveLength(2);

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: {
          intent: "REJECT_CANDIDATE",
          expectedVersion: 1,
          commandId: command.commandId,
        },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: {
          ...command,
          expectedVersion: 2,
          commandId: "qa-move-to-offer-again",
        },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
  });

  it("rejects every non-INTERVIEW/ACTIVE canonical source for MOVE_TO_OFFER", async () => {
    const cases = [
      { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", interest: "REVIEW" },
      { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", interest: "REVIEW" },
      { stage: "ASSESSMENT", disposition: "ACTIVE", status: "REVIEWING", interest: "REVIEW" },
      { stage: "OFFER", disposition: "ACTIVE", status: "OFFER", interest: "ACCEPTED" },
      { stage: "INTERVIEW", disposition: "HOLD", status: "INTERVIEW", interest: "ACCEPTED" },
      { stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", interest: "REJECTED" },
    ] as const;

    for (const [index, source] of cases.entries()) {
      const application = await createApplication();
      await prisma.application.update({
        where: { id: application.id },
        data: {
          stage: source.stage,
          disposition: source.disposition,
          status: source.status,
          recruiterInterest: source.interest,
        },
      });

      await expect(
        executeApplicationIntent({
          applicationId: application.id,
          command: {
            intent: "MOVE_TO_OFFER",
            expectedVersion: 1,
            commandId: `qa-invalid-offer-${index}`,
          },
          actor: recruiterActor,
        }),
      ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);

      expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(1);
      await prisma.applicationEvent.deleteMany({ where: { applicationId: application.id } });
      await prisma.application.delete({ where: { id: application.id } });
    }
  });

  it("enforces version, tenant, role, admin, and concurrent MOVE_TO_OFFER rules", async () => {
    const stale = await createInterviewApplication();
    await expect(
      executeApplicationIntent({
        applicationId: stale.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 0, commandId: "qa-offer-stale" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
    await expect(
      executeApplicationIntent({
        applicationId: stale.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 1, commandId: "qa-offer-cross-tenant" },
        actor: { type: "RECRUITER", id: ids.otherRecruiter, companyId: ids.otherCompany },
      }),
    ).rejects.toBeInstanceOf(ApplicationNotFoundError);
    await expect(
      executeApplicationIntent({
        applicationId: stale.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 1, commandId: "qa-offer-candidate" },
        actor: { type: "CANDIDATE", id: ids.candidate },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);
    await expect(
      executeApplicationIntent({
        applicationId: stale.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 1, commandId: "qa-offer-admin" },
        actor: { type: "ADMIN", id: ids.admin },
      }),
    ).resolves.toMatchObject({
      state: { stage: "OFFER", disposition: "ACTIVE", stateVersion: 2 },
    });

    await prisma.applicationEvent.deleteMany({ where: { applicationId: stale.id } });
    await prisma.application.delete({ where: { id: stale.id } });
    const concurrent = await createInterviewApplication();
    const outcomes = await Promise.allSettled([
      executeApplicationIntent({
        applicationId: concurrent.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 1, commandId: "qa-offer-race-a" },
        actor: recruiterActor,
      }),
      executeApplicationIntent({
        applicationId: concurrent.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 1, commandId: "qa-offer-race-b" },
        actor: recruiterActor,
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(await prisma.applicationEvent.count({
      where: { applicationId: concurrent.id, type: "APPLICATION_STAGE_CHANGED" },
    })).toBe(1);
  });

  it.each(["APPLIED", "REVIEW", "ASSESSMENT", "INTERVIEW", "OFFER"] as const)(
    "rejects from %s/ACTIVE with one terminal domain event",
    async (stage) => {
      const application = await createApplication();
      if (stage !== "APPLIED") {
        await prisma.application.update({
          where: { id: application.id },
          data: { stage },
        });
      }

      const result = await executeApplicationIntent({
        applicationId: application.id,
        command: {
          intent: "REJECT_CANDIDATE",
          expectedVersion: 1,
          commandId: `qa-reject-${stage.toLowerCase()}`,
        },
        actor: recruiterActor,
      });
      const stored = await prisma.application.findUniqueOrThrow({
        where: { id: application.id },
        include: { events: { orderBy: { recordedAt: "asc" } } },
      });

      expect(result).toMatchObject({
        state: { stage: "CLOSED", disposition: "REJECTED", stateVersion: 2 },
        replayed: false,
        legacy: {
          status: "REJECTED",
          recruiterInterest: "REJECTED",
          stateVersion: 2,
        },
      });
      expect(stored).toMatchObject({
        stage: "CLOSED",
        disposition: "REJECTED",
        stateVersion: 2,
        status: "REJECTED",
        recruiterInterest: "REJECTED",
        rejectionEmailSent: false,
      });
      expect(stored.rejectedAt).toBeInstanceOf(Date);
      const rejectionEvents = stored.events.filter((event) => event.type === "CANDIDATE_REJECTED");
      expect(rejectionEvents).toHaveLength(1);
      expect(rejectionEvents[0]).toMatchObject({
        actorType: "RECRUITER",
        actorId: ids.recruiter,
        fromStage: stage,
        toStage: "CLOSED",
        fromDisposition: "ACTIVE",
        toDisposition: "REJECTED",
        visibility: "BOTH",
      });
    },
  );

  it("deduplicates rejection, rejects a conflicting fingerprint, and refuses a new terminal command", async () => {
    const application = await createApplication();
    const command = {
      intent: "REJECT_CANDIDATE" as const,
      expectedVersion: 1,
      commandId: "qa-reject-retry",
    };
    const first = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const retry = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(await prisma.applicationEvent.count({
      where: { applicationId: application.id, type: "CANDIDATE_REJECTED" },
    })).toBe(1);

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "MOVE_TO_INTERVIEW", expectedVersion: 1, commandId: command.commandId },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { ...command, commandId: "qa-reject-again", expectedVersion: 2 },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
  });

  it("rejects HOLD, stale versions, and concurrent rejection losers", async () => {
    const held = await createApplication();
    await prisma.application.update({
      where: { id: held.id },
      data: { disposition: "HOLD" },
    });
    await expect(
      executeApplicationIntent({
        applicationId: held.id,
        command: { intent: "REJECT_CANDIDATE", expectedVersion: 1, commandId: "qa-reject-hold" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);

    await prisma.applicationEvent.deleteMany({ where: { applicationId: held.id } });
    await prisma.application.delete({ where: { id: held.id } });
    const active = await createApplication();
    await expect(
      executeApplicationIntent({
        applicationId: active.id,
        command: { intent: "REJECT_CANDIDATE", expectedVersion: 0, commandId: "qa-reject-stale" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);

    const concurrent = await Promise.allSettled([
      executeApplicationIntent({
        applicationId: active.id,
        command: { intent: "REJECT_CANDIDATE", expectedVersion: 1, commandId: "qa-reject-race-a" },
        actor: recruiterActor,
      }),
      executeApplicationIntent({
        applicationId: active.id,
        command: { intent: "REJECT_CANDIDATE", expectedVersion: 1, commandId: "qa-reject-race-b" },
        actor: recruiterActor,
      }),
    ]);
    expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.applicationEvent.count({
      where: { applicationId: active.id, type: "CANDIDATE_REJECTED" },
    })).toBe(1);
  });

  it("authorizes an active admin and rejects a missing actor", async () => {
    const application = await createApplication();
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "REJECT_CANDIDATE", expectedVersion: 1, commandId: "qa-reject-missing-actor" },
        actor: { type: "RECRUITER", id: null, companyId: ids.company },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "REJECT_CANDIDATE", expectedVersion: 1, commandId: "qa-reject-admin" },
        actor: { type: "ADMIN", id: ids.admin, companyId: null },
      }),
    ).resolves.toMatchObject({
      state: { stage: "CLOSED", disposition: "REJECTED", stateVersion: 2 },
    });
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

  it("denies cross-tenant recruiters and candidates specifically for rejection", async () => {
    const application = await createApplication();
    const baseCommand = {
      intent: "REJECT_CANDIDATE" as const,
      expectedVersion: 1,
    };

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { ...baseCommand, commandId: "qa-reject-cross-tenant" },
        actor: { type: "RECRUITER", id: ids.otherRecruiter, companyId: ids.otherCompany },
      }),
    ).rejects.toMatchObject({ code: "APPLICATION_NOT_FOUND" });
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { ...baseCommand, commandId: "qa-reject-candidate" },
        actor: { type: "CANDIDATE", id: ids.candidate },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);

    expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 1,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
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

  it("moves the exact flag-off INTERVIEW/ACCEPTED source to OFFER as a set-once legacy write", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
    });
    const command = {
      intent: "MOVE_TO_OFFER" as const,
      expectedVersion: 0,
      commandId: "qa-legacy-offer",
    };

    const first = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const storedAfterFirst = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    const retry = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const storedAfterRetry = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    expect(first).toMatchObject({
      state: null,
      event: null,
      replayed: false,
      legacy: { status: "OFFER", recruiterInterest: "ACCEPTED", stateVersion: 0 },
    });
    expect(storedAfterFirst).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "OFFER",
      recruiterInterest: "ACCEPTED",
    });
    expect(storedAfterFirst.offerAt).toBeInstanceOf(Date);
    expect(first.timestamps.offerAt).toEqual(storedAfterFirst.offerAt);
    expect(retry.replayed).toBe(true);
    expect(retry.timestamps.offerAt).toEqual(storedAfterFirst.offerAt);
    expect(storedAfterRetry.offerAt).toEqual(storedAfterFirst.offerAt);
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("preserves a pre-existing flag-off offerAt while moving the exact legacy source", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    const existingOfferAt = new Date("2026-09-15T10:00:00.000Z");
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "INTERVIEW",
        recruiterInterest: "ACCEPTED",
        offerAt: existingOfferAt,
      },
    });

    const result = await executeApplicationIntent({
      applicationId: application.id,
      command: { intent: "MOVE_TO_OFFER", expectedVersion: 0, commandId: "qa-legacy-offer-existing-at" },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "OFFER",
      recruiterInterest: "ACCEPTED",
      offerAt: existingOfferAt,
    });
    expect(result.timestamps.offerAt).toEqual(existingOfferAt);
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("fails closed for ambiguous flag-off MOVE_TO_OFFER states and canonical footprints", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const cases = [
      { status: "SUBMITTED", interest: "ACCEPTED" },
      { status: "REVIEWING", interest: "ACCEPTED" },
      { status: "INTERVIEW", interest: "REVIEW" },
      { status: "INTERVIEW", interest: "MAYBE" },
      { status: "OFFER", interest: "REVIEW" },
      { status: "REJECTED", interest: "REJECTED" },
      { status: "REJECTED", interest: "ACCEPTED" },
      { status: "INTERVIEW", interest: "REJECTED" },
      { status: "HIRED", interest: "ACCEPTED" },
    ] as const;

    for (const [index, source] of cases.entries()) {
      const application = await createRolloutApplication();
      await prisma.application.update({
        where: { id: application.id },
        data: { status: source.status, recruiterInterest: source.interest },
      });
      await expect(
        executeApplicationIntent({
          applicationId: application.id,
          command: { intent: "MOVE_TO_OFFER", expectedVersion: 0, commandId: `qa-ambiguous-offer-${index}` },
          actor: recruiterActor,
        }),
      ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
      const stored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
      expect(stored).toMatchObject({
        stage: null,
        disposition: null,
        stateVersion: 0,
        status: source.status,
        recruiterInterest: source.interest,
      });
      expect(stored.offerAt).toBeNull();
      await prisma.application.delete({ where: { id: application.id } });
    }

    const canonical = await createRolloutApplication();
    await prisma.application.update({
      where: { id: canonical.id },
      data: {
        stage: "INTERVIEW",
        disposition: "ACTIVE",
        status: "INTERVIEW",
        recruiterInterest: "ACCEPTED",
      },
    });
    await expect(
      executeApplicationIntent({
        applicationId: canonical.id,
        command: { intent: "MOVE_TO_OFFER", expectedVersion: 0, commandId: "qa-canonical-offer-flag-off" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(CanonicalStateUnavailableError);
  });

  it("applies flag-off rejection once and preserves its first rejectedAt on retry", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    const staleRejectedAt = new Date("2026-01-01T00:00:00.000Z");
    await prisma.application.update({
      where: { id: application.id },
      data: { rejectedAt: staleRejectedAt },
    });
    const command = {
      intent: "REJECT_CANDIDATE" as const,
      expectedVersion: 0,
      commandId: "qa-legacy-reject",
    };

    const first = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const firstStored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    const retry = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const retriedStored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retriedStored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "REJECTED",
      recruiterInterest: "REJECTED",
      rejectionEmailSent: false,
    });
    expect(firstStored.rejectedAt).toBeInstanceOf(Date);
    expect(firstStored.rejectedAt).not.toEqual(staleRejectedAt);
    expect(retriedStored.rejectedAt).toEqual(firstStored.rejectedAt);
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("treats an exact delivered legacy rejection as a true flag-off no-op", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    const rejectedAt = new Date("2026-02-01T00:00:00.000Z");
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "REJECTED",
        recruiterInterest: "REJECTED",
        rejectedAt,
        rejectionEmailSent: true,
      },
    });
    const before = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });

    const result = await executeApplicationIntent({
      applicationId: application.id,
      command: {
        intent: "REJECT_CANDIDATE",
        expectedVersion: 0,
        commandId: "qa-legacy-reject-delivered-retry",
      },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });

    expect(result.replayed).toBe(true);
    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "REJECTED",
      recruiterInterest: "REJECTED",
      rejectedAt,
      rejectionEmailSent: true,
      updatedAt: before.updatedAt,
    });
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("normalizes a status-only delivered legacy rejection without resetting delivery", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    const rejectedAt = new Date("2026-02-02T00:00:00.000Z");
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "REJECTED",
        recruiterInterest: "REVIEW",
        rejectedAt,
        rejectionEmailSent: true,
      },
    });

    await executeApplicationIntent({
      applicationId: application.id,
      command: {
        intent: "REJECT_CANDIDATE",
        expectedVersion: 0,
        commandId: "qa-legacy-reject-status-only",
      },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });

    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "REJECTED",
      recruiterInterest: "REJECTED",
      rejectedAt,
      rejectionEmailSent: true,
    });
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("normalizes an interest-only legacy rejection and sets a missing rejectedAt once", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "SUBMITTED",
        recruiterInterest: "REJECTED",
        rejectedAt: null,
        rejectionEmailSent: true,
      },
    });

    await executeApplicationIntent({
      applicationId: application.id,
      command: {
        intent: "REJECT_CANDIDATE",
        expectedVersion: 0,
        commandId: "qa-legacy-reject-interest-only",
      },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });

    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "REJECTED",
      recruiterInterest: "REJECTED",
      rejectionEmailSent: true,
    });
    expect(stored.rejectedAt).toBeInstanceOf(Date);
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

  it("hires only OFFER/ACTIVE with one BOTH event and replays the exact hiredAt", async () => {
    const application = await createOfferApplication();
    const command = {
      intent: "HIRE_CANDIDATE" as const,
      expectedVersion: 1,
      commandId: "qa-hire-candidate",
    };

    const first = await executeApplicationIntent({
      applicationId: application.id,
      command,
      actor: recruiterActor,
    });
    const storedAfterFirst = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: { events: true },
    });
    const replay = await executeApplicationIntent({
      applicationId: application.id,
      command,
      actor: recruiterActor,
    });

    expect(first).toMatchObject({
      state: { stage: "CLOSED", disposition: "HIRED", stateVersion: 2 },
      legacy: { status: "HIRED", recruiterInterest: "ACCEPTED", stateVersion: 2 },
      replayed: false,
    });
    expect(storedAfterFirst.hiredAt).toBeInstanceOf(Date);
    expect(first.timestamps.hiredAt).toEqual(storedAfterFirst.hiredAt);
    expect(replay.replayed).toBe(true);
    expect(replay.timestamps.hiredAt).toEqual(storedAfterFirst.hiredAt);
    expect(storedAfterFirst.events.filter((event) => event.type === "CANDIDATE_HIRED")).toHaveLength(1);
    expect(storedAfterFirst.events.find((event) => event.type === "CANDIDATE_HIRED")).toMatchObject({
      actorType: "RECRUITER",
      actorId: ids.recruiter,
      fromStage: "OFFER",
      toStage: "CLOSED",
      fromDisposition: "ACTIVE",
      toDisposition: "HIRED",
      visibility: "BOTH",
    });

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { ...command, expectedVersion: 2 },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 2, commandId: "qa-new-hire-command" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
  });

  it.each([
    ["APPLIED", "ACTIVE"],
    ["REVIEW", "ACTIVE"],
    ["ASSESSMENT", "ACTIVE"],
    ["INTERVIEW", "ACTIVE"],
    ["OFFER", "HOLD"],
    ["CLOSED", "REJECTED"],
  ] as const)("rejects HIRE_CANDIDATE from %s/%s", async (stage, disposition) => {
    const application = await createApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: { stage, disposition },
    });

    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 1, commandId: `qa-hire-${stage}-${disposition}` },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
  });

  it("enforces HIRE_CANDIDATE tenant, role, admin, stale-version, and concurrency rules", async () => {
    let application = await createOfferApplication();
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 0, commandId: "qa-hire-stale" },
        actor: recruiterActor,
      }),
    ).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 1, commandId: "qa-hire-cross-tenant" },
        actor: { type: "RECRUITER", id: ids.otherRecruiter, companyId: ids.otherCompany },
      }),
    ).rejects.toBeInstanceOf(ApplicationNotFoundError);
    await expect(
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 1, commandId: "qa-hire-candidate-actor" },
        actor: { type: "CANDIDATE", id: ids.candidate, companyId: null },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);

    const adminResult = await executeApplicationIntent({
      applicationId: application.id,
      command: { intent: "HIRE_CANDIDATE", expectedVersion: 1, commandId: "qa-hire-admin" },
      actor: { type: "ADMIN", id: ids.admin, companyId: null },
    });
    expect(adminResult.state).toMatchObject({ stage: "CLOSED", disposition: "HIRED" });

    await cleanup();
    await fixtures();
    application = await createOfferApplication();
    const results = await Promise.allSettled([
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 1, commandId: "qa-hire-race-a" },
        actor: recruiterActor,
      }),
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 1, commandId: "qa-hire-race-b" },
        actor: recruiterActor,
      }),
    ]);
    const applied = results.filter(
      (result) => result.status === "fulfilled" && result.value.replayed === false,
    );
    expect(applied).toHaveLength(1);
    expect(await prisma.applicationEvent.count({
      where: { applicationId: application.id, type: "CANDIDATE_HIRED" },
    })).toBe(1);
  });

  it("implements the exact flag-off HIRE_CANDIDATE source and retry contracts", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    const existingHiredAt = new Date("2026-10-04T10:00:00.000Z");
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "OFFER", recruiterInterest: "ACCEPTED", hiredAt: existingHiredAt },
    });
    const command = { intent: "HIRE_CANDIDATE" as const, expectedVersion: 0, commandId: "qa-legacy-hire" };

    const first = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const afterFirst = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    const retry = await executeApplicationIntent({ applicationId: application.id, command, actor: recruiterActor });
    const afterRetry = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    expect(first.replayed).toBe(false);
    expect(afterFirst).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "HIRED",
      recruiterInterest: "ACCEPTED",
      hiredAt: existingHiredAt,
    });
    expect(retry.replayed).toBe(true);
    expect(retry.timestamps.hiredAt).toEqual(existingHiredAt);
    expect(afterRetry.updatedAt).toEqual(afterFirst.updatedAt);
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("sets flag-off hiredAt once and does not overwrite a concurrent winner", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "OFFER", recruiterInterest: "ACCEPTED", hiredAt: null },
    });
    const results = await Promise.allSettled([
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 0, commandId: "qa-legacy-hire-race-a" },
        actor: recruiterActor,
      }),
      executeApplicationIntent({
        applicationId: application.id,
        command: { intent: "HIRE_CANDIDATE", expectedVersion: 0, commandId: "qa-legacy-hire-race-b" },
        actor: recruiterActor,
      }),
    ]);
    const stored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    const writes = results.filter(
      (result) => result.status === "fulfilled" && result.value.replayed === false,
    );
    expect(writes).toHaveLength(1);
    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "HIRED",
      recruiterInterest: "ACCEPTED",
    });
    expect(stored.hiredAt).toBeInstanceOf(Date);
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("does not overwrite hiredAt when a concurrent writer wins before the legacy CAS", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "OFFER", recruiterInterest: "ACCEPTED", hiredAt: null },
    });
    const concurrentHiredAt = new Date("2026-10-06T14:00:00.000Z");
    let releaseRowLock = () => {};
    let reportRowLock = () => {};
    const rowLockReady = new Promise<void>((resolve) => {
      reportRowLock = resolve;
    });
    const rowLockRelease = new Promise<void>((resolve) => {
      releaseRowLock = resolve;
    });
    const concurrentWinner = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Application"
        WHERE "id" = ${application.id}
        FOR UPDATE
      `;
      reportRowLock();
      await rowLockRelease;
      await tx.application.update({
        where: { id: application.id },
        data: { hiredAt: concurrentHiredAt },
      });
    });
    await rowLockReady;

    const command = executeApplicationIntent({
      applicationId: application.id,
      command: {
        intent: "HIRE_CANDIDATE",
        expectedVersion: 0,
        commandId: "qa-legacy-hire-hired-at-race",
      },
      actor: recruiterActor,
    });
    const losingCommand = expect(command).rejects.toBeInstanceOf(
      ConcurrentApplicationTransitionError,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseRowLock();
    await concurrentWinner;
    await losingCommand;

    const stored = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(stored).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "OFFER",
      recruiterInterest: "ACCEPTED",
      hiredAt: concurrentHiredAt,
    });
    expect(await prisma.applicationEvent.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it("preserves null hiredAt on an exact flag-off HIRED/ACCEPTED retry", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const application = await createRolloutApplication();
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "HIRED", recruiterInterest: "ACCEPTED", hiredAt: null },
    });
    const before = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    const result = await executeApplicationIntent({
      applicationId: application.id,
      command: { intent: "HIRE_CANDIDATE", expectedVersion: 0, commandId: "qa-legacy-hire-null" },
      actor: recruiterActor,
    });
    const stored = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });

    expect(result.replayed).toBe(true);
    expect(result.timestamps.hiredAt).toBeNull();
    expect(stored.hiredAt).toBeNull();
    expect(stored.updatedAt).toEqual(before.updatedAt);
  });

  it("fails closed for ambiguous flag-off HIRE_CANDIDATE tuples and existing HIRED mutation", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const cases = [
      { status: "INTERVIEW", interest: "ACCEPTED" },
      { status: "REVIEWING", interest: "ACCEPTED" },
      { status: "SUBMITTED", interest: "ACCEPTED" },
      { status: "OFFER", interest: "REVIEW" },
      { status: "OFFER", interest: "MAYBE" },
      { status: "HIRED", interest: "REVIEW" },
      { status: "HIRED", interest: "MAYBE" },
      { status: "HIRED", interest: "REJECTED" },
      { status: "REJECTED", interest: "REJECTED" },
    ] as const;

    for (const [index, tuple] of cases.entries()) {
      const application = await createRolloutApplication();
      await prisma.application.update({
        where: { id: application.id },
        data: { status: tuple.status, recruiterInterest: tuple.interest },
      });
      await expect(
        executeApplicationIntent({
          applicationId: application.id,
          command: { intent: "HIRE_CANDIDATE", expectedVersion: 0, commandId: `qa-legacy-hire-invalid-${index}` },
          actor: recruiterActor,
        }),
      ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
      await prisma.application.delete({ where: { id: application.id } });
    }

    const legacyHired = await createRolloutApplication();
    await prisma.application.update({
      where: { id: legacyHired.id },
      data: { status: "HIRED", recruiterInterest: "ACCEPTED" },
    });
    for (const intent of ["START_REVIEW", "MOVE_TO_INTERVIEW", "MOVE_TO_OFFER", "REJECT_CANDIDATE"] as const) {
      await expect(
        executeApplicationIntent({
          applicationId: legacyHired.id,
          command: { intent, expectedVersion: 0, commandId: `qa-hired-terminal-${intent}` },
          actor: recruiterActor,
        }),
      ).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    }
  });
});
