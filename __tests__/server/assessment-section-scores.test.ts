import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findAttempt: vi.fn(),
  findQuestions: vi.fn(),
  updateAttempt: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.session,
}));

vi.mock("@/lib/server/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    assessmentAttempt: { findUnique: mocks.findAttempt },
    assessmentQuestion: { findMany: mocks.findQuestions },
    $transaction: async (callback: (tx: any) => Promise<any>) =>
      callback({
        $queryRaw: vi.fn(async () => []),
        assessmentAttempt: { findUnique: mocks.findAttempt, updateMany: mocks.updateAttempt },
        assessmentQuestion: { findMany: mocks.findQuestions },
      }),
  },
}));

vi.mock("@/lib/notifications/service", () => ({
  NotificationService: { create: vi.fn() },
}));

let POST: typeof import(
  "@/app/api/assessments/attempts/[attemptId]/submit/route"
)["POST"];

beforeAll(async () => {
  ({ POST } = await import(
    "@/app/api/assessments/attempts/[attemptId]/submit/route"
  ));
});

const question = (id: string, section: string) => ({
  id,
  section,
  type: "MULTIPLE_CHOICE",
  testCases: [],
});

const answer = (
  questionId: string,
  section: string,
  pointsEarned: number
) => ({
  questionId,
  pointsEarned,
  timeSpent: 10,
  question: { section },
});

function makeAttempt(
  sections: unknown[],
  answers: ReturnType<typeof answer>[]
) {
  return {
    id: "attempt-a",
    candidateId: "candidate-a",
    templateId: "template-a",
    applicationId: null,
    inviteId: null,
    status: "IN_PROGRESS",
    startedAt: new Date(Date.now() - 60000),
    expiresAt: null,
    severity: "NORMAL",
    flagsJson: {},
    template: {
      passingScore: 50,
      sections,
      isBadgeExam: false,
      badgeTermId: null,
      badgeLevel: null,
    },
    answers,
    invite: null,
    candidate: {
      id: "candidate-a",
      name: "QA Candidate",
      email: "qa@example.invalid",
    },
    contestRegistration: null,
  };
}

async function submit() {
  return POST(
    new Request("http://localhost/api/assessments/submit", {
      method: "POST",
    }),
    { params: { attemptId: "attempt-a" } }
  );
}

describe("assessment section scoring regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
    mocks.updateAttempt.mockResolvedValue({ count: 1 });
  });

  it("includes all real sections and unanswered questions", async () => {
    mocks.findQuestions.mockResolvedValue([
      question("q1", "Fundamentos de Java"),
      question("q2", "Fundamentos de Java"),
      question("q3", "Java 8 / Streams / Lambdas"),
      question("q4", "Git y HTTP básico"),
      question("q5", "Java Core"),
    ]);

    mocks.findAttempt.mockResolvedValue(
      makeAttempt(
        [
          { title: "Fundamentos de Java" },
          { title: "Java 8 / Streams / Lambdas" },
          { title: "Git y HTTP básico" },
        ],
        [
          answer("q1", "Fundamentos de Java", 1),
          // q2 deliberately unanswered
          answer("q3", "Java 8 / Streams / Lambdas", 1),
          answer("q4", "Git y HTTP básico", 0),
          answer("q5", "Java Core", 0),
        ]
      )
    );

    const response = await submit();
    expect(response.status).toBe(200);

    const result = await response.json();

    expect(result.sectionScores).toEqual({
      "Fundamentos de Java": 50,
      "Java 8 / Streams / Lambdas": 100,
      "Git y HTTP básico": 0,
      "Java Core": 0,
    });

    expect(result.totalScore).toBe(40);
    expect(result.passed).toBe(false);

    expect(mocks.updateAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sectionScores: result.sectionScores,
          totalScore: 40,
        }),
      })
    );
  });

  it("preserves minimum requirements with legacy name and title", async () => {
    mocks.findQuestions.mockResolvedValue([
      question("q1", "Fundamentos de Java"),
      question("q2", "Java 8 / Streams / Lambdas"),
    ]);

    mocks.findAttempt.mockResolvedValue(
      makeAttempt(
        [
          { name: "Fundamentos de Java", minimumCorrect: 2 },
          { title: "Java 8 / Streams / Lambdas", minimumCorrect: 1 },
        ],
        [
          answer("q1", "Fundamentos de Java", 1),
          answer("q2", "Java 8 / Streams / Lambdas", 1),
        ]
      )
    );

    const response = await submit();
    expect(response.status).toBe(200);

    const result = await response.json();

    expect(result.totalScore).toBe(100);
    expect(result.passed).toBe(false);

    expect(mocks.updateAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flagsJson: expect.objectContaining({
            sectionRequirements: {
              "Fundamentos de Java": {
                minimumCorrect: 2,
                correct: 1,
                met: false,
              },
              "Java 8 / Streams / Lambdas": {
                minimumCorrect: 1,
                correct: 1,
                met: true,
              },
            },
          }),
        }),
      })
    );
  });
});
