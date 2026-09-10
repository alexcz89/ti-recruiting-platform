import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  inviteExpiresAt: new Date(Date.now() + 60_000),
  attempt: null as null | {
    id: string;
    status: string;
    applicationId: string;
    expiresAt: Date | null;
    startedAt: Date;
    flagsJson: { questionOrder: string[]; optionOrderByQuestion: Record<string, string[]> };
    createdAt: Date;
  },
}));

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const question = {
  id: "question-a",
  section: "General",
  difficulty: "EASY",
  questionText: "Q",
  codeSnippet: null,
  options: [{ id: "a" }],
  allowMultiple: false,
  type: "MULTIPLE_CHOICE",
  language: null,
  allowedLanguages: null,
  starterCode: null,
  timesUsed: 0,
  testCases: [],
};

const tx = {
  assessmentInvite: {
    findFirst: vi.fn(async () =>
      state.inviteExpiresAt.getTime() > Date.now() ? { id: "invite-a" } : null
    ),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  assessmentAttempt: {
    create: vi.fn(async () => ({ id: "attempt-new" })),
    update: vi.fn(async () => ({})),
  },
};

const prismaMock = {
  assessmentTemplate: {
    findUnique: vi.fn(async () => ({
      id: "template-a",
      isActive: true,
      allowRetry: false,
      maxAttempts: 1,
      timeLimit: 30,
      shuffleQuestions: true,
      isBadgeExam: false,
      totalQuestions: 1,
      sections: [],
    })),
  },
  assessmentQuestion: { findMany: vi.fn(async () => [question]) },
  assessmentInvite: {
    findUnique: vi.fn(async () => ({
      id: "invite-a",
      status: "STARTED",
      expiresAt: state.inviteExpiresAt,
      applicationId: "application-a",
      jobId: "job-a",
      candidateId: "candidate-a",
      templateId: "template-a",
      updatedAt: new Date(0),
    })),
  },
  application: {
    findFirst: vi.fn(async () => ({
      id: "application-a",
      jobId: "job-a",
      job: { id: "job-a", assessments: [{ id: "job-assessment-a" }] },
    })),
  },
  assessmentAttempt: {
    count: vi.fn(async () => 0),
    findFirst: vi.fn(async (args: { where?: { status?: unknown; inviteId?: string } }) => {
      if (args.where?.status) return state.attempt;
      if (args.where?.inviteId) return state.attempt;
      return null;
    }),
    update: vi.fn(async () => ({})),
  },
  attemptAnswer: { findMany: vi.fn(async () => []) },
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/contests/domain", () => ({ challengeAvailability: vi.fn() }));

let POST: typeof import("@/app/api/assessments/[templateId]/start/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/assessments/[templateId]/start/route"));
});

function request() {
  return new Request("http://localhost/api/assessments/template-a/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "token-a" }),
  });
}

describe("assessment invite and attempt deadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inviteExpiresAt = new Date(Date.now() + 60_000);
    state.attempt = null;
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
  });

  it("allows a new attempt before invite expiry", async () => {
    const response = await POST(request(), { params: { templateId: "template-a" } });
    expect(response.status).toBe(200);
    expect(tx.assessmentAttempt.create).toHaveBeenCalledOnce();
  });

  it("rejects a new attempt after invite expiry", async () => {
    state.inviteExpiresAt = new Date(0);
    const response = await POST(request(), { params: { templateId: "template-a" } });
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: "ASSESSMENT_EXPIRED" });
    expect(tx.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("resumes an attempt started before invite expiry using the attempt deadline", async () => {
    state.inviteExpiresAt = new Date(0);
    state.attempt = {
      id: "attempt-a",
      status: "IN_PROGRESS",
      applicationId: "application-a",
      expiresAt: new Date(Date.now() + 60_000),
      startedAt: new Date(),
      flagsJson: { questionOrder: ["question-a"], optionOrderByQuestion: {} },
      createdAt: new Date(),
    };
    const response = await POST(request(), { params: { templateId: "template-a" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      attemptId: "attempt-a",
      reused: true,
    });
    expect(tx.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("resumes a legacy attempt with null expiresAt", async () => {
    state.inviteExpiresAt = new Date(0);
    state.attempt = {
      id: "attempt-legacy",
      status: "IN_PROGRESS",
      applicationId: "application-a",
      expiresAt: null,
      startedAt: new Date(),
      flagsJson: { questionOrder: ["question-a"], optionOrderByQuestion: {} },
      createdAt: new Date(),
    };
    const response = await POST(request(), { params: { templateId: "template-a" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ attemptId: "attempt-legacy", expiresAt: null });
  });
});
