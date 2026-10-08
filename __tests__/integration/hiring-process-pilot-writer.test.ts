import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { updateApplicationStatus } from "@/app/dashboard/overview/actions";
import { PATCH as patchApplicationStatus } from "@/app/api/applications/[id]/status/route";
import { POST as postApplicationStatus } from "@/app/api/applications/[id]/status/route";
import { PATCH as patchApplicationInterest } from "@/app/api/applications/[id]/interest/route";
import { PATCH as patchApplication } from "@/app/api/applications/[id]/route";
import { DELETE as deleteApplication } from "@/app/api/applications/[id]/route";
import { PATCH as patchApplicationNotes } from "@/app/api/applications/[id]/notes/route";
import { DELETE as deleteJob } from "@/app/api/jobs/[id]/route";
import { POST as deleteDashboardJob } from "@/app/dashboard/jobs/delete/route";
import { transitionApplication } from "@/lib/hiring-process/transition-application";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const databaseUrl = process.env.DATABASE_URL ?? "";
const safeDatabase =
  databaseUrl.includes("127.0.0.1:55433") &&
  databaseUrl.includes("taskio_canonical_hiring_qa");
const runDatabaseTests =
  process.env.RUN_HIRING_PROCESS_DB_TESTS === "true" && safeDatabase;
const describeDatabase = runDatabaseTests ? describe : describe.skip;

const ids = {
  company: "qa-pilot-company",
  otherCompany: "qa-pilot-other-company",
  candidate: "qa-pilot-candidate",
  recruiter: "qa-pilot-recruiter",
  otherRecruiter: "qa-pilot-other-recruiter",
  admin: "qa-pilot-admin",
  job: "qa-pilot-job",
  application: "qa-pilot-application",
  template: "qa-pilot-template",
  attempt: "qa-pilot-attempt",
};

function session(id: string, role: "RECRUITER" | "ADMIN" | "CANDIDATE") {
  mocks.getServerSession.mockResolvedValue({
    user: { id, email: `${id}@example.invalid`, role },
  });
}

async function removeFixtures() {
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: ids.application },
  });
  await prisma.application.deleteMany({ where: { id: ids.application } });
  await prisma.assessmentTemplate.deleteMany({ where: { id: ids.template } });
  await prisma.job.deleteMany({ where: { id: ids.job } });
  await prisma.recruiterProfile.deleteMany({
    where: { userId: { in: [ids.recruiter, ids.otherRecruiter] } },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [ids.candidate, ids.recruiter, ids.otherRecruiter, ids.admin],
      },
    },
  });
  await prisma.company.deleteMany({
    where: { id: { in: [ids.company, ids.otherCompany] } },
  });
}

async function createFixtures() {
  await prisma.company.createMany({
    data: [
      { id: ids.company, name: "QA Pilot Company" },
      { id: ids.otherCompany, name: "QA Pilot Other Company" },
    ],
  });
  await prisma.user.createMany({
    data: [
      {
        id: ids.candidate,
        email: "qa-pilot-candidate@example.invalid",
        role: "CANDIDATE",
      },
      {
        id: ids.recruiter,
        email: "qa-pilot-recruiter@example.invalid",
        role: "RECRUITER",
      },
      {
        id: ids.otherRecruiter,
        email: "qa-pilot-other-recruiter@example.invalid",
        role: "RECRUITER",
      },
      {
        id: ids.admin,
        email: "qa-pilot-admin@example.invalid",
        role: "ADMIN",
      },
    ],
  });
  await prisma.recruiterProfile.createMany({
    data: [
      {
        userId: ids.recruiter,
        companyId: ids.company,
        companyName: "QA Pilot Company",
        status: "APPROVED",
      },
      {
        userId: ids.otherRecruiter,
        companyId: ids.otherCompany,
        companyName: "QA Pilot Other Company",
        status: "APPROVED",
      },
    ],
  });
  await prisma.job.create({
    data: {
      id: ids.job,
      companyId: ids.company,
      title: "QA Pilot Job",
      location: "Local QA",
      employmentType: "FULL_TIME",
      description: "Synthetic pilot fixture",
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
  await prisma.assessmentTemplate.create({
    data: {
      id: ids.template,
      title: "QA Pilot Assessment",
      slug: "qa-pilot-assessment",
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
      startedAt: new Date("2026-10-01T12:00:00.000Z"),
    },
  });
}

async function storedApplication() {
  return prisma.application.findUniqueOrThrow({
    where: { id: ids.application },
    include: { events: { orderBy: { recordedAt: "asc" } } },
  });
}

async function removeFailureTrigger() {
  await prisma.$executeRawUnsafe(
    'DROP TRIGGER IF EXISTS "qa_fail_pilot_application_event" ON "ApplicationEvent"',
  );
  await prisma.$executeRawUnsafe(
    'DROP FUNCTION IF EXISTS "qa_fail_pilot_application_event_write"()',
  );
}

describeDatabase("canonical hiring process pilot writer", () => {
  beforeAll(async () => {
    await removeFailureTrigger();
  });

  beforeEach(async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    await removeFailureTrigger();
    await removeFixtures();
    await createFixtures();
    session(ids.recruiter, "RECRUITER");
  });

  afterAll(async () => {
    if (!runDatabaseTests) return;
    await removeFailureTrigger();
    await removeFixtures();
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("preserves the exact legacy REVIEWING write when the flag is off", async () => {
    const result = await updateApplicationStatus(ids.application, "REVIEWING");
    const stored = await storedApplication();

    expect(result).toEqual({ success: true });
    expect(stored).toMatchObject({
      status: "REVIEWING",
      recruiterInterest: "ACCEPTED",
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
    });
    expect(stored.reviewingAt).toBeNull();
    expect(stored.events).toHaveLength(0);
  });

  it("routes APPLIED to REVIEW through the canonical command when the flag is on", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");

    const result = await updateApplicationStatus(ids.application, "REVIEWING");
    const stored = await storedApplication();

    expect(result).toEqual({ success: true });
    expect(stored).toMatchObject({
      status: "REVIEWING",
      recruiterInterest: "REVIEW",
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 1,
    });
    expect(stored.reviewingAt).toBeInstanceOf(Date);
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      companyId: ids.company,
      actorType: "RECRUITER",
      actorId: ids.recruiter,
      type: "APPLICATION_STAGE_CHANGED",
      fromStage: "APPLIED",
      toStage: "REVIEW",
      fromDisposition: "ACTIVE",
      toDisposition: "ACTIVE",
      visibility: "INTERNAL",
      reasonCode: null,
    });
    expect(stored.events[0].idempotencyKey).toBeTruthy();
    expect(JSON.stringify(stored.events[0].metadata)).not.toContain(
      "qa-pilot-candidate@example.invalid",
    );
  });

  it("allows an active admin to execute the pilot transition", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    session(ids.admin, "ADMIN");

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: true });
    const stored = await storedApplication();
    expect(stored.stage).toBe("REVIEW");
    expect(stored.events[0]).toMatchObject({
      actorType: "ADMIN",
      actorId: ids.admin,
    });
  });

  it("rejects candidates without changing application state", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    session(ids.candidate, "CANDIDATE");

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "No autorizado" });
    const stored = await storedApplication();
    expect(stored.stateVersion).toBe(0);
    expect(stored.events).toHaveLength(0);
  });

  it("rejects a recruiter from another tenant", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    session(ids.otherRecruiter, "RECRUITER");

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "Aplicación no encontrada" });
    const stored = await storedApplication();
    expect(stored.stateVersion).toBe(0);
    expect(stored.events).toHaveLength(0);
  });

  it("returns not found for an unknown application", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");

    expect(
      await updateApplicationStatus("qa-pilot-missing", "REVIEWING"),
    ).toEqual({ success: false, error: "Aplicación no encontrada" });
  });

  it("deduplicates concurrent clicks and later retries", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");

    const concurrent = await Promise.all([
      updateApplicationStatus(ids.application, "REVIEWING"),
      updateApplicationStatus(ids.application, "REVIEWING"),
    ]);
    const retry = await updateApplicationStatus(ids.application, "REVIEWING");
    const stored = await storedApplication();

    expect(concurrent).toEqual([{ success: true }, { success: true }]);
    expect(retry).toEqual({ success: true });
    expect(stored.stateVersion).toBe(1);
    expect(stored.events).toHaveLength(1);
  });

  it("allows a later APPLIED to REVIEW re-entry as a distinct transition", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: true });
    await transitionApplication({
      applicationId: ids.application,
      targetStage: "APPLIED",
      expectedVersion: 1,
      actor: {
        type: "RECRUITER",
        id: ids.recruiter,
        companyId: ids.company,
      },
      reasonCode: "CORRECTION",
      idempotencyKey: "qa-pilot-return-to-applied",
    });

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: true });
    const stored = await storedApplication();
    expect(stored).toMatchObject({
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 3,
    });
    expect(stored.events).toHaveLength(3);
    expect(stored.events[2].idempotencyKey).toBe(
      `overview-review:${ids.application}:v2`,
    );
  });

  it("does not accept REVIEW state as a successful retry without its pilot event", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    await prisma.application.update({
      where: { id: ids.application },
      data: { stage: "REVIEW", stateVersion: 1 },
    });

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "Error al actualizar" });
    const stored = await storedApplication();
    expect(stored.stateVersion).toBe(1);
    expect(stored.events).toHaveLength(0);
  });

  it("does not turn a non-pilot REVIEW hold into ACTIVE", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    await prisma.application.update({
      where: { id: ids.application },
      data: {
        stage: "REVIEW",
        disposition: "HOLD",
        stateVersion: 1,
        status: "REVIEWING",
      },
    });

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "Error al actualizar" });
    const stored = await storedApplication();
    expect(stored).toMatchObject({
      stage: "REVIEW",
      disposition: "HOLD",
      stateVersion: 1,
      status: "REVIEWING",
    });
    expect(stored.events).toHaveLength(0);
  });

  it("re-authorizes the persisted actor before replaying a successful request", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: true });
    await prisma.user.update({
      where: { id: ids.recruiter },
      data: { isSuspended: true },
    });

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "Error al actualizar" });
    const stored = await storedApplication();
    expect(stored.stateVersion).toBe(1);
    expect(stored.events).toHaveLength(1);
  });

  it("rolls back the pilot transition when the event cannot be written", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "qa_fail_pilot_application_event_write"() RETURNS trigger AS $$
      BEGIN
        IF NEW."applicationId" = '${ids.application}' THEN
          RAISE EXCEPTION 'qa pilot event failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "qa_fail_pilot_application_event"
      BEFORE INSERT ON "ApplicationEvent"
      FOR EACH ROW EXECUTE FUNCTION "qa_fail_pilot_application_event_write"()
    `);

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "Error al actualizar" });
    const stored = await storedApplication();
    expect(stored).toMatchObject({
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
    });
    expect(stored.events).toHaveLength(0);
  });

  it("routes overview rejection through the canonical command", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");

    expect(
      await updateApplicationStatus(ids.application, "REJECTED", {
        expectedVersion: 0,
        commandId: "qa-overview-reject",
      }),
    ).toEqual({ success: true });
    const stored = await storedApplication();
    expect(stored).toMatchObject({
      status: "REJECTED",
      recruiterInterest: "REJECTED",
      stage: "CLOSED",
      disposition: "REJECTED",
      stateVersion: 1,
    });
    expect(stored.rejectedAt).toBeInstanceOf(Date);
    expect(stored.rejectionEmailSent).toBe(false);
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      type: "CANDIDATE_REJECTED",
      actorType: "RECRUITER",
      actorId: ids.recruiter,
      visibility: "BOTH",
    });
  });

  it("rejects direct REJECTED writes through the generic status endpoint", async () => {
    const request = new NextRequest(
      `http://localhost/api/applications/${ids.application}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      },
    );

    const response = await patchApplicationStatus(request, {
      params: { id: ids.application },
    });
    const stored = await storedApplication();

    expect(response.status).toBe(400);
    expect(stored).toMatchObject({
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
    });
    expect(stored.events).toHaveLength(0);
  });

  it("rejects direct OFFER writes through both status methods and generic PATCH", async () => {
    const statusPatch = await patchApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OFFER" }),
      }),
      { params: { id: ids.application } },
    );
    const statusPost = await postApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OFFER" }),
      }),
      { params: { id: ids.application } },
    );
    const genericPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OFFER" }),
      }),
      { params: { id: ids.application } },
    );
    const unrelatedPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: "Offer bypass remains closed" }),
      }),
      { params: { id: ids.application } },
    );
    expect([statusPatch.status, statusPost.status, genericPatch.status]).toEqual([400, 400, 400]);
    expect(unrelatedPatch.status).toBe(200);
    expect(await storedApplication()).toMatchObject({
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
      coverLetter: "Offer bypass remains closed",
      events: [],
    });
  });

  it("rejects every remaining direct rejection endpoint and method", async () => {
    const statusPost = await postApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      { params: { id: ids.application } },
    );
    const interestPatch = await patchApplicationInterest(
      new Request(`http://localhost/api/applications/${ids.application}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest: "REJECTED" }),
      }),
      { params: { id: ids.application } },
    );
    const genericPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      { params: { id: ids.application } },
    );

    expect([statusPost.status, interestPatch.status, genericPatch.status]).toEqual([400, 400, 400]);
    expect(await storedApplication()).toMatchObject({
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
      events: [],
    });
  });

  it("rejects direct MAYBE and direct Preselecto clear bypasses", async () => {
    const directMaybe = await patchApplicationInterest(
      new Request(`http://localhost/api/applications/${ids.application}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest: "MAYBE" }),
      }),
      { params: { id: ids.application } },
    );
    expect(directMaybe.status).toBe(400);

    await prisma.application.update({
      where: { id: ids.application },
      data: {
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "REVIEWING",
        recruiterInterest: "MAYBE",
      },
    });
    const directClear = await patchApplicationInterest(
      new Request(`http://localhost/api/applications/${ids.application}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest: "REVIEW" }),
      }),
      { params: { id: ids.application } },
    );
    expect(directClear.status).toBe(400);
    expect(await storedApplication()).toMatchObject({
      stage: "REVIEW",
      disposition: "ACTIVE",
      status: "REVIEWING",
      recruiterInterest: "MAYBE",
    });
  });

  it("prevents generic legacy endpoints from reopening any rejection footprint", async () => {
    const rejectedAt = new Date("2026-10-05T12:00:00.000Z");
    await prisma.application.update({
      where: { id: ids.application },
      data: {
        stage: null,
        disposition: null,
        status: "REJECTED",
        recruiterInterest: "REJECTED",
        rejectedAt,
        rejectionEmailSent: true,
      },
    });

    const statusResponse = await patchApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWING" }),
      }),
      { params: { id: ids.application } },
    );
    expect(statusResponse.status).toBe(409);

    for (const recruiterInterest of ["REVIEW", "MAYBE", "ACCEPTED"]) {
      const interestResponse = await patchApplicationInterest(
        new Request(`http://localhost/api/applications/${ids.application}/interest`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recruiterInterest }),
        }),
        { params: { id: ids.application } },
      );
      expect(interestResponse.status).toBe(409);
    }

    const statusPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INTERVIEW" }),
      }),
      { params: { id: ids.application } },
    );
    expect(statusPatch.status).toBe(409);

    const unrelatedPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeUrl: "https://example.invalid/rejected-resume.pdf",
          coverLetter: "Actualización permitida",
        }),
      }),
      { params: { id: ids.application } },
    );
    expect(unrelatedPatch.status).toBe(200);

    expect(await storedApplication()).toMatchObject({
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: "REJECTED",
      recruiterInterest: "REJECTED",
      rejectedAt,
      rejectionEmailSent: true,
      resumeUrl: "https://example.invalid/rejected-resume.pdf",
      coverLetter: "Actualización permitida",
      events: [],
    });
  });

  it("protects canonical CLOSED/REJECTED through every generic legacy endpoint", async () => {
    await prisma.application.update({
      where: { id: ids.application },
      data: {
        stage: "CLOSED",
        disposition: "REJECTED",
        status: "SUBMITTED",
        recruiterInterest: "REVIEW",
      },
    });

    const statusResponse = await patchApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWING" }),
      }),
      { params: { id: ids.application } },
    );
    const interestResponse = await patchApplicationInterest(
      new Request(`http://localhost/api/applications/${ids.application}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest: "MAYBE" }),
      }),
      { params: { id: ids.application } },
    );
    const genericResponse = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INTERVIEW" }),
      }),
      { params: { id: ids.application } },
    );

    expect([statusResponse.status, interestResponse.status, genericResponse.status]).toEqual([
      409,
      409,
      409,
    ]);
    expect(await storedApplication()).toMatchObject({
      stage: "CLOSED",
      disposition: "REJECTED",
      status: "SUBMITTED",
      recruiterInterest: "REVIEW",
      stateVersion: 0,
      events: [],
    });
  });

  it("protects canonical OFFER/ACTIVE from every generic legacy state endpoint", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    await prisma.application.update({
      where: { id: ids.application },
      data: {
        stage: "OFFER",
        disposition: "ACTIVE",
        stateVersion: 2,
        status: "OFFER",
        recruiterInterest: "ACCEPTED",
      },
    });

    const statusPatch = await patchApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWING" }),
      }),
      { params: { id: ids.application } },
    );
    const statusPost = await postApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INTERVIEW" }),
      }),
      { params: { id: ids.application } },
    );

    const interestStatuses: number[] = [];
    for (const recruiterInterest of ["REVIEW", "MAYBE", "ACCEPTED"]) {
      const response = await patchApplicationInterest(
        new Request(`http://localhost/api/applications/${ids.application}/interest`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recruiterInterest }),
        }),
        { params: { id: ids.application } },
      );
      interestStatuses.push(response.status);
    }

    const genericStatusPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWING" }),
      }),
      { params: { id: ids.application } },
    );
    const unrelatedPatch = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeUrl: "https://example.invalid/offer-resume.pdf",
          coverLetter: "La oferta sigue vigente",
        }),
      }),
      { params: { id: ids.application } },
    );
    const notesPatch = await patchApplicationNotes(
      new NextRequest(`http://localhost/api/applications/${ids.application}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Seguimiento de la oferta" }),
      }),
      { params: { id: ids.application } },
    );

    expect([statusPatch.status, statusPost.status]).toEqual([409, 409]);
    expect(interestStatuses).toEqual([409, 409, 409]);
    expect(genericStatusPatch.status).toBe(409);
    expect(unrelatedPatch.status).toBe(200);
    expect(notesPatch.status).toBe(200);
    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: false, error: "La oferta canónica no admite retroceso legacy" });

    expect(await storedApplication()).toMatchObject({
      stage: "OFFER",
      disposition: "ACTIVE",
      stateVersion: 2,
      status: "OFFER",
      recruiterInterest: "ACCEPTED",
      resumeUrl: "https://example.invalid/offer-resume.pdf",
      coverLetter: "La oferta sigue vigente",
      internalNotes: "Seguimiento de la oferta",
      events: [],
    });
  });

  it("keeps canonical rejection eligible for the delayed rejection cron", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    expect(
      await updateApplicationStatus(ids.application, "REJECTED", {
        expectedVersion: 0,
        commandId: "qa-overview-reject-cron",
      }),
    ).toEqual({ success: true });

    const cutoff = new Date(Date.now() + 1_000);
    const eligible = await prisma.application.findMany({
      where: {
        id: ids.application,
        status: "REJECTED",
        rejectionEmailSent: false,
        rejectedAt: { lte: cutoff },
      },
      select: { id: true },
    });
    expect(eligible).toEqual([{ id: ids.application }]);
  });

  it("does not intercept the separate generic Application.status writer", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    const request = new NextRequest(
      `http://localhost/api/applications/${ids.application}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INTERVIEW" }),
      },
    );

    const response = await patchApplicationStatus(request, {
      params: { id: ids.application },
    });
    const stored = await storedApplication();

    expect(response.status).toBe(200);
    expect(stored).toMatchObject({
      status: "INTERVIEW",
      recruiterInterest: "REVIEW",
      stage: "APPLIED",
      disposition: "ACTIVE",
      stateVersion: 0,
    });
    expect(stored.events).toHaveLength(0);
  });

  it("preserves assessment state and the candidate-facing legacy projection", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");

    expect(
      await updateApplicationStatus(ids.application, "REVIEWING"),
    ).toEqual({ success: true });
    const stored = await storedApplication();
    const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: ids.attempt },
    });

    expect(attempt).toMatchObject({
      status: "IN_PROGRESS",
      applicationId: ids.application,
      startedAt: new Date("2026-10-01T12:00:00.000Z"),
    });
    expect(stored.status).toBe("REVIEWING");
    expect(stored.events[0].visibility).toBe("INTERNAL");
  });

  it.each([
    {
      name: "canonical",
      stage: "CLOSED" as const,
      disposition: "HIRED" as const,
      legacyStatus: "OFFER" as const,
    },
    {
      name: "legacy",
      stage: null,
      disposition: null,
      legacyStatus: "HIRED" as const,
    },
  ])("protects a $name HIRED row from generic writers and deletes", async ({
    stage,
    disposition,
    legacyStatus,
  }) => {
    await prisma.application.update({
      where: { id: ids.application },
      data: {
        stage,
        disposition,
        stateVersion: stage ? 3 : 0,
        status: legacyStatus,
        recruiterInterest: "ACCEPTED",
        hiredAt: new Date("2026-10-06T10:00:00.000Z"),
      },
    });

    const statusResponses = [];
    for (const status of ["SUBMITTED", "REVIEWING", "INTERVIEW", "OFFER"]) {
      statusResponses.push(await patchApplicationStatus(
        new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
        { params: { id: ids.application } },
      ));
    }
    expect(statusResponses.map((response) => response.status)).toEqual([409, 409, 409, 400]);

    const interestResponses = [];
    for (const recruiterInterest of ["REVIEW", "MAYBE", "ACCEPTED"]) {
      interestResponses.push(await patchApplicationInterest(
        new Request(`http://localhost/api/applications/${ids.application}/interest`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recruiterInterest }),
        }),
        { params: { id: ids.application } },
      ));
    }
    expect(interestResponses.map((response) => response.status)).toEqual([409, 409, 409]);

    const genericState = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWING" }),
      }),
      { params: { id: ids.application } },
    );
    const unrelated = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl: "https://example.invalid/hired.pdf", coverLetter: "Contratado" }),
      }),
      { params: { id: ids.application } },
    );
    expect(genericState.status).toBe(409);
    expect(unrelated.status).toBe(200);
    expect(await updateApplicationStatus(ids.application, "REVIEWING")).toEqual({
      success: false,
      error: "HIRED es terminal",
    });

    const applicationDelete = await deleteApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, { method: "DELETE" }),
      { params: { id: ids.application } },
    );
    const jobDelete = await deleteJob(
      new NextRequest(`http://localhost/api/jobs/${ids.job}`, { method: "DELETE" }),
      { params: { id: ids.job } },
    );
    const form = new FormData();
    form.set("jobId", ids.job);
    const dashboardDelete = await deleteDashboardJob(
      new Request("http://localhost/dashboard/jobs/delete", { method: "POST", body: form }),
    );
    expect([applicationDelete.status, jobDelete.status, dashboardDelete.status]).toEqual([409, 409, 409]);

    expect(await storedApplication()).toMatchObject({
      stage,
      disposition,
      status: legacyStatus,
      recruiterInterest: "ACCEPTED",
      resumeUrl: "https://example.invalid/hired.pdf",
      coverLetter: "Contratado",
    });
    expect(await prisma.job.count({ where: { id: ids.job } })).toBe(1);
  });

  it("blocks direct HIRED inputs and preserves deletion for a non-HIRED application", async () => {
    const statusPatch = await patchApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HIRED" }),
      }),
      { params: { id: ids.application } },
    );
    const statusPost = await postApplicationStatus(
      new NextRequest(`http://localhost/api/applications/${ids.application}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HIRED" }),
      }),
      { params: { id: ids.application } },
    );
    const generic = await patchApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HIRED" }),
      }),
      { params: { id: ids.application } },
    );
    expect([statusPatch.status, statusPost.status, generic.status]).toEqual([400, 400, 400]);

    const deleted = await deleteApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, { method: "DELETE" }),
      { params: { id: ids.application } },
    );
    expect(deleted.status).toBe(200);
    expect(await prisma.application.count({ where: { id: ids.application } })).toBe(0);
  });

  it("preserves API Job deletion when the job has no HIRED application", async () => {
    const response = await deleteJob(
      new NextRequest(`http://localhost/api/jobs/${ids.job}`, { method: "DELETE" }),
      { params: { id: ids.job } },
    );
    expect(response.status).toBe(200);
    expect(await prisma.job.count({ where: { id: ids.job } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId: ids.job } })).toBe(0);
  });

  it("preserves dashboard Job deletion when the job has no HIRED application", async () => {
    const form = new FormData();
    form.set("jobId", ids.job);
    const response = await deleteDashboardJob(
      new Request("http://localhost/dashboard/jobs/delete", { method: "POST", body: form }),
    );
    expect(response.status).toBe(200);
    expect(await prisma.job.count({ where: { id: ids.job } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId: ids.job } })).toBe(0);
  });

  async function addApplicationHistory() {
    await prisma.applicationEvent.create({
      data: {
        applicationId: ids.application,
        companyId: ids.company,
        actorType: "SYSTEM",
        type: "APPLICATION_CREATED",
        toStage: "APPLIED",
        toDisposition: "ACTIVE",
        visibility: "INTERNAL",
        happenedAt: new Date("2026-10-03T12:00:00.000Z"),
      },
    });
  }

  it("returns 409 instead of deleting a non-HIRED application with canonical history", async () => {
    await addApplicationHistory();

    const response = await deleteApplication(
      new NextRequest(`http://localhost/api/applications/${ids.application}`, { method: "DELETE" }),
      { params: { id: ids.application } },
    );

    expect(response.status).toBe(409);
    expect(await prisma.application.count({ where: { id: ids.application } })).toBe(1);
    expect(await prisma.applicationEvent.count({ where: { applicationId: ids.application } })).toBe(1);
  });

  it("returns 409 without partial API Job deletion when canonical history exists", async () => {
    await addApplicationHistory();

    const response = await deleteJob(
      new NextRequest(`http://localhost/api/jobs/${ids.job}`, { method: "DELETE" }),
      { params: { id: ids.job } },
    );

    expect(response.status).toBe(409);
    expect(await prisma.job.count({ where: { id: ids.job } })).toBe(1);
    expect(await prisma.application.count({ where: { id: ids.application } })).toBe(1);
    expect(await prisma.applicationEvent.count({ where: { applicationId: ids.application } })).toBe(1);
  });

  it("returns 409 without partial dashboard Job deletion when canonical history exists", async () => {
    await addApplicationHistory();
    const form = new FormData();
    form.set("jobId", ids.job);

    const response = await deleteDashboardJob(
      new Request("http://localhost/dashboard/jobs/delete", { method: "POST", body: form }),
    );

    expect(response.status).toBe(409);
    expect(await prisma.job.count({ where: { id: ids.job } })).toBe(1);
    expect(await prisma.application.count({ where: { id: ids.application } })).toBe(1);
    expect(await prisma.applicationEvent.count({ where: { applicationId: ids.application } })).toBe(1);
  });
});
