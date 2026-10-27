import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.session,
}));

vi.mock("@/lib/server/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

let POST: typeof import(
  "@/app/api/assessments/attempts/[attemptId]/answer/route"
)["POST"];

beforeAll(async () => {
  ({ POST } = await import(
    "@/app/api/assessments/attempts/[attemptId]/answer/route"
  ));
});

describe("MCQ answer persistence regression", () => {
  let stored: string[] | null;
  let history: string[][];
  let usageCount: number;

  beforeEach(() => {
    vi.resetAllMocks();

    stored = null;
    history = [];
    usageCount = 0;

    mocks.session.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });

    mocks.transaction.mockImplementation(async (
      callback: (tx: any) => Promise<any>
    ) => callback({
      $queryRaw: vi.fn(async () => []),
      assessmentAttempt: {
        findUnique: async () => ({
          id: "attempt-a",
          candidateId: "candidate-a",
          templateId: "template-a",
          status: "IN_PROGRESS",
          expiresAt: null,
          flagsJson: { questionOrder: ["question-a"] },
          template: { penalizeWrong: false },
        }),
      },
      assessmentQuestion: {
        findFirst: async () => ({
          id: "question-a",
          type: "MULTIPLE_CHOICE",
          allowMultiple: true,
          options: [
            { id: "a", isCorrect: true },
            { id: "b", isCorrect: true },
            { id: "c", isCorrect: true },
          ],
        }),
        update: async () => {
          usageCount++;
          return { id: "question-a" };
        },
      },
      attemptAnswer: {
        createMany: async ({ data }: {
          data: { selectedOptions: string[] }[]
        }) => {
          if (stored !== null) return { count: 0 };
          stored = [...data[0].selectedOptions];
          return { count: 1 };
        },
        update: async ({ data }: {
          data: { selectedOptions: string[] }
        }) => {
          if (stored === null) throw new Error("Missing answer");
          stored = [...data.selectedOptions];
          history.push([...stored]);
          return { id: "answer-a" };
        },
      },
    }));
  });

  it("saves 1, then 3, then 2 options for the same question", async () => {
    const selections = [
      ["a"],
      ["a", "b", "c"],
      ["a", "c"],
    ];

    for (const selectedOptions of selections) {
      const response = await POST(
        new Request("http://localhost/api/assessments/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: "question-a",
            selectedOptions,
            timeSpent: 10,
          }),
        }),
        { params: { attemptId: "attempt-a" } }
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
      });
    }

    expect(history).toEqual(selections);
    expect(stored).toEqual(["a", "c"]);
    expect(usageCount).toBe(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });
});
