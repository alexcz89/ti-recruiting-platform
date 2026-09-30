import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));
const answeredAt = new Date("2026-09-29T12:00:00.000Z");

const prismaMock = {
  assessmentAttempt: {
    findUnique: vi.fn(async () => ({
      id: "attempt-a",
      candidateId: "candidate-a",
      status: "IN_PROGRESS",
      expiresAt: null,
      flagsJson: { questionOrder: ["question-a"] },
      startedAt: new Date("2026-09-29T11:00:00.000Z"),
      submittedAt: null,
    })),
  },
  attemptAnswer: {
    findMany: vi.fn(async () => [{
      questionId: "question-a",
      selectedOptions: ["option-a"],
      timeSpent: 12,
      answeredAt,
    }]),
  },
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));

let GET: typeof import("@/app/api/assessments/attempts/[attemptId]/state/route")["GET"];

beforeAll(async () => {
  ({ GET } = await import("@/app/api/assessments/attempts/[attemptId]/state/route"));
});

describe("assessment answer resume state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
  });

  it("returns an authoritative timestamp for each saved answer", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: { attemptId: "attempt-a" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      answers: { "question-a": ["option-a"] },
      answerUpdatedAt: { "question-a": answeredAt.toISOString() },
      serverNow: expect.any(String),
    });
  });
});
