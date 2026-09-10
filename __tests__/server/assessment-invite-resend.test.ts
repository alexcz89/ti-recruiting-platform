import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentInvitationPath } from "@/lib/assessments/navigation";

type NotificationInput = {
  type: string;
  metadata?: Record<string, unknown>;
};

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  sendAssessmentInviteEmail: vi.fn(),
  createNotification: vi.fn<(input: NotificationInput) => Promise<void>>(
    async () => undefined,
  ),
}));

const expiredInvite = {
  id: "invite-a",
  token: "token-a",
  status: "STARTED",
  sentAt: new Date(0),
  expiresAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const activeAttempt = {
  id: "attempt-a",
  status: "IN_PROGRESS",
  createdAt: new Date(),
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
};

const tx = {
  assessmentInvite: {
    findFirst: vi.fn(async () => expiredInvite),
    update: vi.fn(),
  },
  assessmentAttempt: {
    findFirst: vi.fn<
      (args?: unknown) => Promise<{ id: string } | null>
    >(async () => ({ id: "attempt-a" })),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
};

const prismaMock = {
  application: {
    findFirst: vi.fn(async () => ({
      id: "application-a",
      jobId: "job-a",
      candidateId: "candidate-a",
      candidate: { id: "candidate-a", email: "a@example.com", name: "Candidate A" },
      job: {
        id: "job-a",
        title: "Job A",
        companyId: "company-a",
        company: { id: "company-a", name: "Company A", assessmentCredits: 1 },
        assessments: [{
          id: "job-assessment-a",
          templateId: "template-a",
          isRequired: true,
          minScore: 70,
          createdAt: new Date(0),
        }],
      },
    })),
  },
  assessmentTemplate: {
    findUnique: vi.fn(async () => ({
      id: "template-a",
      title: "Assessment",
      timeLimit: 30,
      type: "TECHNICAL",
      difficulty: "EASY",
    })),
  },
  recruiterProfile: { findUnique: vi.fn(async () => ({ id: "profile-a", companyId: "company-a" })) },
  assessmentInvite: { update: vi.fn(async () => expiredInvite) },
  assessmentAttempt: { findFirst: vi.fn(async () => activeAttempt) },
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: vi.fn(async () => "company-a") }));
vi.mock("@/lib/server/mailer", () => ({ sendAssessmentInviteEmail: mocks.sendAssessmentInviteEmail }));
vi.mock("@/lib/notifications/service", () => ({
  NotificationService: { create: mocks.createNotification },
}));

let POST: typeof import("@/app/api/applications/[id]/assessment-invite/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/applications/[id]/assessment-invite/route"));
});

describe("assessment invite resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.assessmentInvite.findFirst.mockResolvedValue(expiredInvite);
    tx.assessmentInvite.update.mockImplementation(async ({ data }) => ({
      ...expiredInvite,
      ...data,
      updatedAt: new Date(),
    }));
    tx.assessmentAttempt.findFirst.mockResolvedValue({ id: "attempt-a" });
    mocks.getServerSession.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });
    mocks.sendAssessmentInviteEmail.mockResolvedValue({ ok: true });
  });

  function resend(body: Record<string, unknown>) {
    return POST(
      new Request("http://localhost/api/applications/application-a/assessment-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: "template-a", ...body }),
      }),
      { params: { id: "application-a" } },
    );
  }

  it("uses different provider idempotency keys for distinct resend operations", async () => {
    const requestedAt = new Date().toISOString();
    await resend({
      expiresInDays: 1,
      resendOperationId: "operation-a",
      resendRequestedAt: requestedAt,
    });
    await resend({
      expiresInDays: 2,
      resendOperationId: "operation-b",
      resendRequestedAt: requestedAt,
    });

    const firstKey = mocks.sendAssessmentInviteEmail.mock.calls[0]?.[0]?.dedupeKey;
    const secondKey = mocks.sendAssessmentInviteEmail.mock.calls[1]?.[0]?.dedupeKey;

    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it("keeps the provider idempotency key stable when retrying one resend operation", async () => {
    let storedInvite = { ...expiredInvite };
    tx.assessmentInvite.findFirst.mockImplementation(async () => storedInvite);
    tx.assessmentInvite.update.mockImplementation(async ({ data }) => {
      storedInvite = {
        ...storedInvite,
        ...data,
        updatedAt: new Date(),
      };
      return storedInvite;
    });
    tx.assessmentAttempt.findFirst.mockResolvedValue(null);

    const operation = {
      expiresInDays: 1,
      resendOperationId: "operation-retry",
      resendRequestedAt: new Date().toISOString(),
    };

    await resend(operation);
    await resend(operation);

    expect(mocks.sendAssessmentInviteEmail.mock.calls[0]?.[0]?.dedupeKey).toBe(
      mocks.sendAssessmentInviteEmail.mock.calls[1]?.[0]?.dedupeKey,
    );
    expect(mocks.sendAssessmentInviteEmail.mock.calls[0]?.[0]?.expiresAt).toEqual(
      mocks.sendAssessmentInviteEmail.mock.calls[1]?.[0]?.expiresAt,
    );
    expect(mocks.sendAssessmentInviteEmail.mock.calls[0]?.[0]?.inviteUrl).toBe(
      mocks.sendAssessmentInviteEmail.mock.calls[1]?.[0]?.inviteUrl,
    );
    expect(tx.assessmentAttempt.create).not.toHaveBeenCalled();
    expect(tx.assessmentAttempt.updateMany).toHaveBeenCalledTimes(1);
  });

  it("reactivates an expired invite without creating an attempt", async () => {
    tx.assessmentAttempt.findFirst.mockResolvedValue(null);

    const response = await resend({
      expiresInDays: 3,
      resendOperationId: "operation-reactivate",
      resendRequestedAt: new Date().toISOString(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      invite: { status: "SENT" },
      meta: { rotated: true },
    });
    expect(tx.assessmentInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invite-a" },
        data: expect.objectContaining({
          status: "SENT",
          sentAt: null,
        }),
      }),
    );
    expect(tx.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("does not rotate, renew, unlink, replace, or shorten an active attempt", async () => {
    const response = await POST(
      new Request("http://localhost/api/applications/application-a/assessment-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: "template-a", expiresInDays: 1 }),
      }),
      { params: { id: "application-a" } }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta.rotated).toBe(false);
    expect(body.attempt.id).toBe("attempt-a");
    expect(new Date(body.attempt.expiresAt).toISOString()).toBe(activeAttempt.expiresAt.toISOString());
    expect(tx.assessmentInvite.update).not.toHaveBeenCalled();
    expect(tx.assessmentAttempt.updateMany).not.toHaveBeenCalled();
    expect(tx.assessmentAttempt.create).not.toHaveBeenCalled();
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ASSESSMENT_INVITATION",
        metadata: expect.objectContaining({
          templateId: "template-a",
          token: "token-a",
        }),
      }),
    );
    expect(mocks.createNotification.mock.calls[0]?.[0]?.metadata).not.toHaveProperty(
      "inviteUrl",
    );
    expect(
      assessmentInvitationPath(
        mocks.createNotification.mock.calls[0]?.[0]?.metadata ?? {},
      ),
    ).toBe("/assessments/template-a?token=token-a");
  });
});
