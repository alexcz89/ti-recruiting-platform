import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/assessment-builder/generate/route";
import { resetActionRateLimit } from "@/lib/server/rate-limit";
import { AI_MODEL_SMART } from "@/lib/ai/config";
import { GenerationInputSchema } from "@/lib/ai/assessment-builder-contract";
import { buildGenerationMessages, parseGeneratedQuestions } from "@/lib/ai/assessment-generation";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), profile: vi.fn(), create: vi.fn(), openai: vi.fn(), write: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  recruiterProfile: { findUnique: mocks.profile },
  assessmentTemplate: { create: mocks.write, update: mocks.write },
  assessmentQuestion: { create: mocks.write, update: mocks.write },
  codeTestCase: { create: mocks.write },
  application: { create: mocks.write, update: mocks.write },
  $transaction: mocks.write,
} }));
vi.mock("@/lib/ai/openai", () => ({ getOpenAI: mocks.openai }));

function mcq() {
  return {
    type: "MULTIPLE_CHOICE", questionText: "¿Cuál es la complejidad de una búsqueda binaria?",
    section: "Algoritmos", difficulty: "MID", explanation: "Divide el espacio de búsqueda a la mitad.",
    options: [
      { text: "O(log n)", isCorrect: true }, { text: "O(n)", isCorrect: false },
      { text: "O(n²)", isCorrect: false }, { text: "O(1)", isCorrect: false },
    ],
  };
}

function coding(language = "javascript") {
  return {
    type: "CODING", questionText: "Suma dos enteros. Entrada: dos números; salida: su suma.",
    section: "Algoritmos", difficulty: "MID", explanation: "La solución suma los enteros.",
    codeSnippet: "function solution(a, b) { /* implementar */ }",
    allowedLanguages: [language],
    testCases: [
      { input: "console.log(JSON.stringify(solution(...[1,2])));", expectedOutput: "3", isHidden: false },
      { input: "console.log(JSON.stringify(solution(...[9,1])));", expectedOutput: "10", isHidden: true },
    ],
  };
}

function completion(questions: unknown[]) {
  return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ questions }), refusal: null } }] };
}
const baseRequest = { prompt: "Algoritmos para backend", questionType: "MULTIPLE_CHOICE", difficulty: "MID", count: 1 };

async function request(body: unknown = baseRequest, raw?: string, headers?: Record<string, string>) {
  const response = await POST(new NextRequest("http://localhost/api/ai/assessment-builder/generate", {
    method: "POST", headers: { "content-type": "application/json", ...headers },
    body: raw ?? JSON.stringify(body),
  }));
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.write).not.toHaveBeenCalled();
  return response;
}

beforeEach(() => {
  vi.resetAllMocks();
  resetActionRateLimit("assessment-generation", "company:company-a");
  resetActionRateLimit("assessment-generation", "admin:admin-a");
  mocks.session.mockResolvedValue({ user: { id: "recruiter-a", role: "RECRUITER", companyId: "untrusted-company" } });
  mocks.profile.mockResolvedValue({ companyId: "company-a", status: "APPROVED" });
  mocks.openai.mockReturnValue({ chat: { completions: { create: mocks.create } } });
  mocks.create.mockResolvedValue(completion([mcq()]));
});

describe("AI assessment generator authorization and bounded requests", () => {
  it.each([null, { user: {} }])("rejects unauthenticated or incomplete sessions: %j", async (session) => {
    mocks.session.mockResolvedValue(session);
    expect((await request()).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["CANDIDATE", "UNKNOWN"])('rejects role %s', async (role) => {
    mocks.session.mockResolvedValue({ user: { id: "candidate-a", role } });
    expect((await request()).status).toBe(403);
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([null, { status: "PENDING", companyId: "company-a" }, { status: "REJECTED", companyId: "company-a" }, { status: "APPROVED", companyId: null }])(
    "requires an approved recruiter company: %j", async (profile) => {
      mocks.profile.mockResolvedValue(profile);
      expect((await request()).status).toBe(403);
      expect(mocks.create).not.toHaveBeenCalled();
    }
  );
  it("authorizes recruiters through their persisted profile, not the session company", async () => {
    expect((await request()).status).toBe(200);
    expect(mocks.profile).toHaveBeenCalledWith({ where: { userId: "recruiter-a" }, select: { companyId: true, status: true } });
    expect(JSON.stringify(mocks.create.mock.calls)).not.toContain("company-a");
    expect(JSON.stringify(mocks.create.mock.calls)).not.toContain("recruiter-a");
  });
  it("explicitly authorizes an admin without a recruiter profile or company", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin-a", role: "ADMIN" } });
    expect((await request()).status).toBe(200);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it.each([
    { prompt: "" }, { prompt: "   " }, { prompt: "x".repeat(6001) }, { prompt: 123 },
    { questionType: "OPEN_ENDED" }, { questionType: "MCQ" }, { difficulty: "EXPERT" },
    { language: "not-a-language" }, { questionType: "CODING", language: "bash" },
    { questionType: "CODING", language: "" }, { language: "constructor" },
    { count: 0 }, { count: 6 }, { count: 1.5 }, { count: "3" }, { count: null },
    { companyId: "company-b" }, { jobId: "private-job" },
  ])("rejects invalid input before contacting OpenAI: %j", async (patch) => {
    expect((await request({ ...baseRequest, ...patch })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps defaults for omitted count and difficulty and supports generic MCQs", async () => {
    expect((await request({ prompt: "Algoritmos", questionType: "MULTIPLE_CHOICE" })).status).toBe(200);
  });
  it("rejects malformed JSON without echoing content", async () => {
    const response = await request(null, '{"secret":"candidate-private-text"');
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("candidate-private-text");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([false, true])("bounds bytes with or without a declared length: %j", async (declared) => {
    const headers: Record<string, string> = declared ? { "content-length": "999999" } : {};
    expect((await request(null, " ".repeat(24001), headers)).status).toBe(413);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reuses local company throttling and includes Retry-After", async () => {
    for (let i = 0; i < 10; i++) expect((await request()).status).toBe(200);
    mocks.session.mockResolvedValue({ user: { id: "another-recruiter", role: "RECRUITER" } });
    const response = await request();
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mocks.create).toHaveBeenCalledTimes(10);
  });
});

describe("validated generation and builder response compatibility", () => {
  it("returns the existing ok/questions shape, uses the configured model and bounds provider work", async () => {
    const response = await request();
    expect(await response.json()).toEqual({ ok: true, questions: [mcq()] });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      model: AI_MODEL_SMART, max_tokens: 2500,
      response_format: expect.objectContaining({ type: "json_schema", json_schema: expect.objectContaining({ strict: true }) }),
    }), { timeout: 45000, maxRetries: 0 });
  });
  it("accepts exactly five distinct questions without clamping count", async () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({ ...mcq(), questionText: `Pregunta ${i + 1}` }));
    mocks.create.mockResolvedValue(completion(questions));
    expect((await request({ ...baseRequest, count: 5 })).status).toBe(200);
    expect(mocks.create.mock.calls[0][0].max_tokens).toBe(8000);
  });
  it.each([0, 2])("rejects a response with %i questions when one was requested", async (count) => {
    mocks.create.mockResolvedValue(completion(Array.from({ length: count }, () => mcq())));
    expect((await request()).status).toBe(502);
  });
  it("rejects duplicate questions", async () => {
    mocks.create.mockResolvedValue(completion([mcq(), mcq()]));
    expect((await request({ ...baseRequest, count: 2 })).status).toBe(502);
  });
  it.each([
    { questionText: " " }, { difficulty: "SENIOR" }, { type: "CODING" },
    { options: mcq().options.slice(0, 3) },
    { options: mcq().options.map(o => ({ ...o, isCorrect: false })) },
    { options: mcq().options.map(o => ({ ...o, isCorrect: true })) },
    { options: mcq().options.map(o => ({ ...o, text: "Misma opción" })) },
    { options: [{ text: " ", isCorrect: true }, ...mcq().options.slice(1)] },
    { options: [{ text: " O(N)  ", isCorrect: true }, ...mcq().options.slice(1)] },
    { solutionCode: "unexpected-secret-field" },
  ])("rejects invalid MCQ constraints atomically: %j", async (patch) => {
    mocks.create.mockResolvedValue(completion([{ ...mcq(), ...patch }]));
    expect((await request()).status).toBe(502);
  });
  it.each(["not-json", "```json\n{}\n```", '{"questions":'])('rejects malformed model JSON: %s', async (content) => {
    mocks.create.mockResolvedValue({ choices: [{ finish_reason: "stop", message: { content } }] });
    expect((await request()).status).toBe(502);
  });
  it.each(["length", "content_filter", "tool_calls"])("rejects incomplete generation (%s)", async (finish_reason) => {
    const result = completion([mcq()]);
    result.choices[0].finish_reason = finish_reason;
    mocks.create.mockResolvedValue(result);
    expect((await request()).status).toBe(502);
  });
  it("rejects provider refusals even alongside valid-looking JSON", async () => {
    const result = completion([mcq()]);
    mocks.create.mockResolvedValue({ choices: [{ ...result.choices[0], message: { ...result.choices[0].message, refusal: "refusal" } }] });
    expect((await request()).status).toBe(502);
  });
  it("does not expose or log provider errors, prompts or solutions", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValue(new Error("sk-secret candidate@example.com official-solution"));
    const response = await request({ ...baseRequest, prompt: "private-job-requirements" });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(/sk-secret|candidate@example|official-solution|private-job/);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("returns 503 for an unconfigured provider without exposing configuration", async () => {
    mocks.openai.mockImplementation(() => { throw new Error("OPENAI_API_KEY no esta definida"); });
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("OPENAI_API_KEY");
  });
});

describe("coding formats match the Judge0 contract", () => {
  it.each(["javascript", "typescript"])("accepts constrained JSON-argument runners for %s", async (language) => {
    mocks.create.mockResolvedValue(completion([coding(language)]));
    const response = await request({ ...baseRequest, questionType: "CODING", language });
    expect(response.status).toBe(200);
    expect((await response.json()).questions[0]).toMatchObject({ codeSnippet: coding().codeSnippet, allowedLanguages: [language], testCases: coding().testCases });
  });
  it.each(["[1,2]", "console.log(solution(...[1,2]));", "console.log(JSON.stringify(solution(...[process.env])));", "console.log(JSON.stringify(solution(...[1,2]))); process.exit();"])(
    "rejects malformed or arbitrary JS runners: %s", async (input) => {
      const q = coding(); q.testCases[0].input = input;
      mocks.create.mockResolvedValue(completion([q]));
      expect((await request({ ...baseRequest, questionType: "CODING", language: "javascript" })).status).toBe(502);
    }
  );
  it.each([
    { codeSnippet: "   " }, { allowedLanguages: ["ruby"] },
    { testCases: [] }, { testCases: coding().testCases.map(tc => ({ ...tc, isHidden: false })) },
    { testCases: coding().testCases.map(tc => ({ ...tc, isHidden: true })) },
    { testCases: coding().testCases.map(tc => ({ ...tc, input: " " })) },
    { testCases: coding().testCases.map(tc => ({ ...tc, expectedOutput: "__NO_CHECK__" })) },
    { testCases: coding().testCases.map(tc => ({ ...tc, expectedOutput: " " })) },
    { testCases: coding().testCases.map(tc => ({ ...tc, input: { value: 1 } })) },
    { testCases: coding().testCases.map(tc => ({ ...tc, isHidden: "false" })) },
  ])("rejects invalid coding questions without partial acceptance: %j", async (patch) => {
    mocks.create.mockResolvedValue(completion([{ ...coding(), ...patch }]));
    expect((await request({ ...baseRequest, questionType: "CODING", language: "javascript" })).status).toBe(502);
  });
  it("preserves raw stdin and requires full-program scaffolding in the Python prompt", () => {
    const input = GenerationInputSchema.parse({ ...baseRequest, questionType: "CODING", language: "python" });
    const q = coding("python");
    q.testCases = q.testCases.map((tc, i) => ({ ...tc, input: i ? "9 1\n" : "1 2\n" }));
    expect(parseGeneratedQuestions({ questions: [q] }, input)[0]).toEqual(q);
    expect(buildGenerationMessages(input)[0].content).toContain("sys.stdin");
  });
  it("accepts SQLite datasets, rejects queries or dangerous setup commands", () => {
    const input = GenerationInputSchema.parse({ ...baseRequest, questionType: "CODING", language: "sql" });
    const q = coding("sql"); q.codeSnippet = "SELECT ...;";
    q.testCases = q.testCases.map((tc, i) => ({ ...tc, input: `CREATE TABLE items (n INTEGER); INSERT INTO items VALUES (${i});` }));
    expect(parseGeneratedQuestions({ questions: [q] }, input)).toHaveLength(1);
    for (const sql of ["SELECT 1;", "DROP TABLE items;", ".read /etc/passwd", "CREATE TABLE items(n); ATTACH 'x' AS external;"]) {
      expect(() => parseGeneratedQuestions({ questions: [{ ...q, testCases: [{ ...q.testCases[0], input: sql }, q.testCases[1]] }] }, input)).toThrow("invalid_output");
    }
  });
});
