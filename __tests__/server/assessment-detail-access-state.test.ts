import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  inviteFindFirst: vi.fn(),
  attemptFindFirst: vi.fn(),
}));

const template = {
  id: "template-a",
  title: "Assessment A",
  slug: "assessment-a",
  type: "TECHNICAL",
  difficulty: "MID",
  timeLimit: 30,
  passingScore: 70,
  totalQuestions: 1,
  allowRetry: false,
  maxAttempts: 1,
  isActive: true,
  sections: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  _count: { questions: 1 },
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/assessmentAntiCheat", () => ({
  isAntiCheatBypassed: vi.fn(() => false),
}));
vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    assessmentTemplate: { findUnique: vi.fn(async () => template) },
    assessmentInvite: { findFirst: mocks.inviteFindFirst },
    assessmentAttempt: {
      count: vi.fn(async () => 0),
      findFirst: mocks.attemptFindFirst,
    },
  },
}));

let GET: typeof import("@/app/api/assessments/[templateId]/route")["GET"];

beforeAll(async () => {
  ({ GET } = await import("@/app/api/assessments/[templateId]/route"));
});

describe("assessment detail access state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE", email: "qa@example.com" },
    });
    mocks.attemptFindFirst.mockResolvedValue(null);
  });

  it("reports an expired invite with no attempt as non-startable", async () => {
    mocks.inviteFindFirst.mockResolvedValue({
      status: "SENT",
      expiresAt: new Date(0),
      attempt: null,
    });

    const response = await GET(
      new Request("http://localhost/api/assessments/template-a?token=expired-token"),
      { params: { templateId: "template-a" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accessState: "EXPIRED" });
  });

  it("keeps an active in-progress attempt resumable after invite expiration", async () => {
    mocks.inviteFindFirst.mockResolvedValue({
      status: "STARTED",
      expiresAt: new Date(0),
      attempt: {
        status: "IN_PROGRESS",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const response = await GET(
      new Request("http://localhost/api/assessments/template-a?token=expired-token"),
      { params: { templateId: "template-a" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accessState: "IN_PROGRESS" });
  });

  it("reports an expired attempt as non-actionable", async () => {
    mocks.attemptFindFirst.mockResolvedValue({
      id: "attempt-expired",
      status: "IN_PROGRESS",
      expiresAt: new Date(0),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/assessments/template-a?attemptId=attempt-expired",
      ),
      { params: { templateId: "template-a" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accessState: "EXPIRED" });
    expect(mocks.attemptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attempt-expired",
          candidateId: "candidate-a",
          templateId: "template-a",
        }),
      }),
    );
  });
});
