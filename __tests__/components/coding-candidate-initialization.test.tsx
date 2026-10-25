// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CandidateAssessment from "@/app/assessments/[templateId]/page";
import { getAssessmentCodingStarter } from "@/lib/ai/assessment-coding-starters";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), replace: vi.fn(), push: vi.fn(), resumed: false, starter: "" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ templateId: "template-a" }),
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSearchParams: () => new URLSearchParams("attemptId=attempt-a"),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/lib/ui/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn(), toastInfo: vi.fn(), toastWarning: vi.fn() }));
vi.mock("@/app/assessments/[templateId]/useAntiCheating", () => ({ useAntiCheating: vi.fn() }));
vi.mock("@/app/assessments/[templateId]/AssessmentTimer", () => ({ default: () => null }));
vi.mock("@/app/assessments/[templateId]/useAnswerPersistence", () => ({
  useAnswerPersistence: () => ({ ready: true, answerStates: {}, pendingCount: 0, saveAnswer: vi.fn(), retryPending: vi.fn(), clearPending: vi.fn(), flushPending: vi.fn() }),
}));
vi.mock("next/dynamic", async () => {
  const react = await import("react");
  return { default: (load: () => Promise<{ default: React.ComponentType }>) => {
    const Component = react.lazy(load);
    return (props: object) => <react.Suspense fallback={null}><Component {...props} /></react.Suspense>;
  } };
});
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Código del candidato" value={value} onChange={event => onChange(event.target.value)} />
  ),
}));

// Existing saved questions must not be rewritten, including the known bad starter.
const legacyStarter = "import sys\na = int(sys.stdin.readline())\nb = int(sys.stdin.readline())\nresultado = a + b\nprint(resultado)";
const question = {
  id: "question-a", type: "CODING", questionText: "Suma dos enteros de stdin", section: "General", difficulty: "JUNIOR",
  language: "python", allowedLanguages: '["python"]', options: [], testCases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resumed = false;
  mocks.starter = getAssessmentCodingStarter("python");
  localStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/start")) return new Response(JSON.stringify({ attemptId: "attempt-a", questions: [{ ...question, codeSnippet: mocks.starter }, { id: "question-b", type: "MULTIPLE_CHOICE", options: [] }] }));
    if (url.endsWith("/state")) return new Response(JSON.stringify({ attemptId: "attempt-a", status: "IN_PROGRESS", answers: mocks.resumed ? { "question-a": ["__CODE_SUBMITTED__"] } : {}, timeSpent: {}, answerUpdatedAt: {} }));
    if (url === "/api/assessments/code/execute") return new Response(JSON.stringify({ result: { testResults: [] } }));
    if (url.endsWith("/answer")) return new Response(JSON.stringify({ ok: true }));
    return new Response(JSON.stringify({ template: { id: "template-a", title: "Python Junior", type: "CODING", language: "python" }, userStatus: { canStart: true }, accessState: "IN_PROGRESS", antiCheatBypass: true }));
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("candidate coding initialization and answered status", () => {
  it.each(["generated", "legacy"])("loads the %s starter without marking answered, running or submitting any code", async (source) => {
    if (source === "legacy") mocks.starter = legacyStarter;
    render(<CandidateAssessment />);
    const editor = await screen.findByRole("textbox", { name: "Código del candidato" });
    expect((editor as HTMLTextAreaElement).value).toBe(mocks.starter);
    expect(screen.getByRole("button", { name: "Pregunta 1: Pendiente" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pregunta 1: Respondida" })).toBeNull();
    expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/execute") || url.endsWith("/answer"))).toBe(false);
    fireEvent.change(editor, { target: { value: "print(8)" } });
    expect(screen.getByRole("button", { name: "Pregunta 1: Pendiente" })).toBeTruthy();
  });

  it("marks answered only after an explicit successful code submission", async () => {
    render(<CandidateAssessment />);
    await screen.findByRole("textbox", { name: "Código del candidato" });
    fireEvent.click(screen.getAllByRole("button", { name: /Enviar solución/ })[0]);
    await screen.findByRole("button", { name: "Pregunta 1: Respondida" });
    const execution = mocks.fetch.mock.calls.find(([url]) => url === "/api/assessments/code/execute");
    expect(JSON.parse(execution![1].body)).toMatchObject({ code: getAssessmentCodingStarter("python"), language: "python", isSubmission: true });
    await waitFor(() => expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/answer"))).toBe(true));
  });

  it("preserves answered status from a previously submitted attempt", async () => {
    mocks.resumed = true;
    render(<CandidateAssessment />);
    await screen.findByRole("button", { name: "Pregunta 1: Respondida" });
    expect(mocks.fetch.mock.calls.some(([url]) => url === "/api/assessments/code/execute")).toBe(false);
  });
});
