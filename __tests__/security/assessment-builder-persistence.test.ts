import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/dashboard/assessments/templates/route";
import { PUT } from "@/app/api/dashboard/assessments/templates/[id]/route";
import { getAssessmentCodingStarter } from "@/lib/ai/assessment-coding-starters";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), company: vi.fn(), template: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(),
  createQuestion: vi.fn(), deleteQuestions: vi.fn(), transaction: vi.fn(),
  lockedTemplate: vi.fn(), lock: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: mocks.company }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  assessmentTemplate: { findFirst: mocks.template, create: mocks.createTemplate, update: mocks.updateTemplate },
  assessmentQuestion: { create: mocks.createQuestion, deleteMany: mocks.deleteQuestions },
  $transaction: mocks.transaction,
} }));

const question = () => ({
  id: "question-a", type: "CODING", questionText: "Suma dos números", section: "General", difficulty: "JUNIOR",
  codeSnippet: "def solution(data):\n    pass", language: "python", allowedLanguages: ["python"], options: [],
  testCases: [{ input: "1 2", expectedOutput: "3", isHidden: false }],
});
const body = () => ({ title: "Python Junior", type: "CODING", language: "python", difficulty: "JUNIOR", passingScore: 70, timeLimit: 30, questions: [question()] });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "recruiter-a", role: "RECRUITER", companyId: "untrusted-company" } });
  mocks.company.mockResolvedValue("company-a");
  mocks.template.mockResolvedValue({
    id: "template-a", companyId: "company-a", isGlobal: false, language: "python",
    questions: [{ type: "CODING", language: "python", allowedLanguages: '["python"]' }],
  });
  mocks.createTemplate.mockResolvedValue({ id: "template-a", slug: "python-junior" });
  mocks.lock.mockResolvedValue([{ id: "template-a" }]);
  mocks.lockedTemplate.mockResolvedValue({
    id: "template-a", isBadgeExam: false,
    _count: { invites: 0, attempts: 0, jobAssessments: 0, contestTracks: 0 }, questions: [], codingChallenges: [],
  });
  mocks.transaction.mockImplementation(async callback => callback({
    $queryRaw: mocks.lock,
    assessmentTemplate: { findFirst: mocks.lockedTemplate, update: mocks.updateTemplate },
    assessmentQuestion: { create: mocks.createQuestion, deleteMany: mocks.deleteQuestions },
  }));
});

async function save(method: "POST" | "PUT", data: unknown) {
  const request = new NextRequest("http://localhost/api/dashboard/assessments/templates/template-a", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(data),
  });
  const response = method === "POST" ? await POST(request) : await PUT(request, { params: { id: "template-a" } });
  expect(response.headers.get("cache-control")).toBe("no-store");
  return response;
}

function expectNoWrites() {
  for (const mock of [mocks.createTemplate, mocks.updateTemplate, mocks.createQuestion, mocks.deleteQuestions, mocks.transaction]) expect(mock).not.toHaveBeenCalled();
}

describe.each(["POST", "PUT"] as const)("%s builder coding language consistency", (method) => {
  it("persists the controlled AI starter verbatim on explicit recruiter save", async () => {
    const codeSnippet = getAssessmentCodingStarter("python");
    expect((await save(method, { ...body(), questions: [{ ...question(), codeSnippet }] })).status).toBe(method === "POST" ? 201 : 200);
    expect(mocks.createQuestion).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codeSnippet }) }));
  });
  it.each(["CODING", "MIXED"])("rejects Python questions relabeled as JavaScript in a %s template before writing", async (type) => {
    const response = await save(method, { ...body(), type, language: "javascript" });
    expect(response.status).toBe(400);
    expectNoWrites();
  });
  it.each(["", null, "bash", "constructor"])("rejects an empty/unsupported coding template language: %j", async (language) => {
    expect((await save(method, { ...body(), language })).status).toBe(400);
    expectNoWrites();
  });
  it.each(["[malformed", ["javascript"], ["python", "not-a-language"]])("rejects incompatible or malformed question languages: %j", async (allowedLanguages) => {
    expect((await save(method, { ...body(), questions: [{ ...question(), allowedLanguages }] })).status).toBe(400);
    expectNoWrites();
  });
  it.each([undefined, null, [], '["python"]', ["python"]])("preserves valid legacy language metadata: %j", async (allowedLanguages) => {
    const data = { ...body(), questions: [{ ...question(), language: undefined, allowedLanguages }] };
    const response = await save(method, data);
    expect(response.status).toBe(method === "POST" ? 201 : 200);
    expect(mocks.createQuestion).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      language: "python", allowedLanguages: '["python"]', codeSnippet: question().codeSnippet,
    }) }));
  });
  it("keeps explicit compatible multi-language metadata instead of replacing it", async () => {
    mocks.template.mockResolvedValue({ id: "template-a", companyId: "company-a", isGlobal: false, language: "javascript", questions: [
      { type: "CODING", language: "javascript", allowedLanguages: '["javascript","typescript"]' },
    ] });
    const response = await save(method, { ...body(), language: "javascript", questions: [{ ...question(), language: "javascript", allowedLanguages: '["javascript","typescript"]' }] });
    expect(response.status).toBe(method === "POST" ? 201 : 200);
    expect(mocks.createQuestion).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ allowedLanguages: '["javascript","typescript"]' }) }));
  });
  it("keeps MCQ-only topic languages outside the Judge0 catalog usable", async () => {
    const response = await save(method, { ...body(), type: "MCQ", language: "bash", questions: [{ type: "MULTIPLE_CHOICE", questionText: "Comando de Bash", options: [] }] });
    expect(response.status).toBe(method === "POST" ? 201 : 200);
  });
  it("keeps the server-side 50 question limit", async () => {
    expect((await save(method, { ...body(), questions: Array.from({ length: 51 }, question) })).status).toBe(400);
    expectNoWrites();
  });
  it.each([null, { user: { id: "candidate-a", role: "CANDIDATE" } }])("retains authentication and role restrictions: %j", async session => {
    mocks.session.mockResolvedValue(session);
    expect((await save(method, body())).status).toBe(session ? 403 : 401);
    expectNoWrites();
  });
});

describe("PUT persisted language boundary", () => {
  it("checks stored questions even when the client omits all language metadata", async () => {
    const { language: _language, allowedLanguages: _allowed, ...legacyQuestion } = question();
    expect((await save("PUT", { ...body(), language: "javascript", questions: [legacyQuestion] })).status).toBe(400);
    expectNoWrites();
    expect(mocks.template).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "template-a", isActive: true, companyId: "company-a", isGlobal: false },
      select: expect.objectContaining({ language: true, questions: expect.any(Object) }),
    }));
  });
  it("validates stored question metadata even if a legacy template lacks its own language", async () => {
    mocks.template.mockResolvedValue({ id: "template-a", companyId: "company-a", isGlobal: false, language: null, questions: [
      { type: "CODING", language: "python", allowedLanguages: '["python"]' },
    ] });
    expect((await save("PUT", { ...body(), language: "javascript", questions: [{ ...question(), language: "javascript", allowedLanguages: ["javascript"] }] })).status).toBe(400);
    expectNoWrites();
  });
  it("does not reveal or mutate another company's template", async () => {
    mocks.template.mockResolvedValue(null);
    expect((await save("PUT", body())).status).toBe(404);
    expectNoWrites();
  });
});
