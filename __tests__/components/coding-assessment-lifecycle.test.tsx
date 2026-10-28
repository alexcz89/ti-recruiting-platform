// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { refreshAssessmentInbox } from "@/app/assessments/actions";
import CandidateAssessment from "@/app/assessments/[templateId]/page";
import AssessmentResults from "@/app/assessments/attempts/[attemptId]/results/page";
import { ASSESSMENTS_UPDATED_EVENT } from "@/lib/client/assessment-updates";
import { toastError } from "@/lib/ui/toast";
import { getAssessmentCodingStarter } from "@/lib/ai/assessment-coding-starters";
import { candidateExecutionResult } from "@/lib/code-execution/public-result";

const mocks = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  const refresh = vi.fn();
  return {
    fetch: vi.fn(), push, replace, refresh, router: { push, replace, refresh },
    layout: "single", status: "IN_PROGRESS", trace: [] as string[],
    answers: {} as Record<string, string[]>, expired: false,
  };
});
vi.mock("@/app/assessments/actions", () => ({ refreshAssessmentInbox: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ templateId: "template-a", attemptId: "attempt-a" }),
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams("attemptId=attempt-a"),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "candidate-a", role: "CANDIDATE" } } }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/lib/ui/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn(), toastInfo: vi.fn(), toastWarning: vi.fn() }));
vi.mock("@/app/assessments/[templateId]/useAntiCheating", () => ({ useAntiCheating: vi.fn() }));
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

const solution = "import sys\ndef solution(data):\n    return str(sum(map(int, data.split())))\nsys.stdout.write(solution(sys.stdin.read()))";
const coding = (id: string) => ({
  id, type: "CODING", questionText: "Suma dos enteros", section: "General", difficulty: "JUNIOR",
  codeSnippet: getAssessmentCodingStarter("python"), language: "python", allowedLanguages: '["python"]', options: [],
  testCases: [{ id: "public-a", input: "3 5", expectedOutput: "8", isHidden: false, points: 1 }],
});
const mcq = { id: "mcq-a", type: "MULTIPLE_CHOICE", questionText: "Elige una opción", options: [{ id: "a", text: "Respuesta A" }] };
function questions() {
  if (mocks.layout === "multi") return [coding("question-a"), coding("question-b")];
  if (mocks.layout === "mixed") return [coding("question-a"), mcq];
  if (mocks.layout === "mixed-last") return [mcq, coding("question-a")];
  if (mocks.layout === "mcq") return [mcq];
  return [coding("question-a")];
}
const json = (value: unknown) => new Response(JSON.stringify(value));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refreshAssessmentInbox).mockReset().mockResolvedValue(undefined);
  mocks.layout = "single";
  mocks.status = "IN_PROGRESS";
  mocks.trace = [];
  mocks.answers = {};
  mocks.expired = false;
  localStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal("fetch", mocks.fetch);
  // Page, editor, timer, persistence hook and queue are real. Only network,
  // Monaco and unrelated anti-cheat effects are replaced, retaining the full call chain.
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const expiresAt = new Date(Date.now() + (mocks.expired ? -1 : 1_800_000)).toISOString();
    if (url.endsWith("/start")) return json({ attemptId: "attempt-a", questions: questions(), expiresAt });
    if (url.endsWith("/state")) return json({ status: mocks.status, answers: mocks.answers, timeSpent: {}, answerUpdatedAt: {}, expiresAt });
    if (url === "/api/assessments/code/execute") {
      const body = JSON.parse(String(init?.body));
      mocks.trace.push(body.isSubmission ? "execute:submit" : "execute:run");
      const passed = body.code === solution;
      return json({ result: { success: passed, testResults: [{
        testCaseId: "public-a", hidden: false, passed, input: "3 5", expectedOutput: "8",
        actualOutput: passed ? "8" : "NotImplementedError: TODO", error: passed ? "" : "NotImplementedError: TODO",
      }] } });
    }
    if (url.endsWith("/answer")) {
      mocks.trace.push("answer");
      const body = JSON.parse(String(init?.body));
      mocks.answers[body.questionId] = body.selectedOptions;
      return json({ ok: true });
    }
    if (url.endsWith("/submit")) {
      mocks.trace.push("submit");
      mocks.status = "SUBMITTED";
      return json({ passed: true, totalScore: 100 });
    }
    if (url.endsWith("/results")) return json({
      attempt: { status: mocks.status, totalScore: 100, passed: true, timeSpent: 30, sectionScores: {} },
      template: { title: "Coding QA", passingScore: 60 }, answers: [], stats: { totalQuestions: 1, answeredQuestions: 1 },
    });
    return json({ template: { id: "template-a", title: "Coding QA", type: "CODING", language: "python" }, userStatus: { canStart: true }, accessState: "IN_PROGRESS", antiCheatBypass: true });
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const runButton = () => screen.getAllByRole("button", { name: "Ejecutar pruebas" })[0];
async function openEditor() {
  render(<CandidateAssessment />);
  return screen.findByRole("textbox", { name: "Código del candidato" });
}

describe("coding run, answer persistence and explicit assessment finalization", () => {
  it.each(["pending", "rejected"])("navigates and loads submitted results with %s inbox invalidation without submitting twice", async outcome => {
    vi.mocked(refreshAssessmentInbox).mockImplementation(() => outcome === "pending"
      ? new Promise<void>(() => {})
      : Promise.reject(new Error("Invalidation unavailable")));
    const updated = vi.fn(); window.addEventListener(ASSESSMENTS_UPDATED_EVENT, updated, { once: true });
    mocks.layout = "mcq";
    const view = render(<CandidateAssessment />);
    const option = await screen.findByRole("button", { name: /Respuesta A/ });
    await waitFor(() => expect((option as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(option);
    await waitFor(() => expect(mocks.answers["mcq-a"]).toEqual(["a"]));
    const submit = screen.getByRole("button", { name: "Enviar evaluación ✓" });
    await act(async () => { fireEvent.click(submit); });
    expect(refreshAssessmentInbox).toHaveBeenCalledOnce();
    expect(updated).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.replace.mock.calls.filter(([url]) => url.endsWith("/results"))).toEqual([["/assessments/attempts/attempt-a/results"]]);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submit);
    expect(mocks.trace).toEqual(["answer", "submit"]);
    expect(mocks.status).toBe("SUBMITTED");
    expect(toastError).not.toHaveBeenCalled();
    view.unmount(); render(<AssessmentResults />);
    expect(await screen.findByText("Aprobaste con 100%")).toBeTruthy();
    expect(mocks.trace.filter(step => step === "submit")).toHaveLength(1);
  });

  it.each(["pending", "rejected"])("finishes expiration and opens results with %s inbox invalidation", async outcome => {
    vi.mocked(refreshAssessmentInbox).mockImplementation(() => outcome === "pending"
      ? new Promise<void>(() => {})
      : Promise.reject(new Error("Invalidation unavailable")));
    const updated = vi.fn(); window.addEventListener(ASSESSMENTS_UPDATED_EVENT, updated, { once: true });
    mocks.expired = true;
    const view = render(<CandidateAssessment />);
    const results = await screen.findByRole("button", { name: "Ver resultados" });
    expect(refreshAssessmentInbox).toHaveBeenCalledOnce();
    expect(updated).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.trace).toEqual(["submit"]);
    expect(screen.queryByText("Calculando resultado…")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar cierre" })).toBeNull();
    fireEvent.click(results);
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/assessments/attempts/attempt-a/results");
    view.unmount(); render(<AssessmentResults />);
    expect(await screen.findByText("Aprobaste con 100%")).toBeTruthy();
    expect(mocks.trace).toEqual(["submit"]);
  });

  it("renders sanitized hidden outcomes without diagnostics or timing and retains explicit finalization", async () => {
    const originalFetch = mocks.fetch.getMockImplementation()!;
    const safeResult = candidateExecutionResult({
      success: false, status: "RUNTIME_ERROR", output: "SECRET_HIDDEN_OUTPUT",
      executionTimeMs: 400, memoryUsedMb: 64,
      testResults: [
        { testCaseId: "public-a", passed: true, input: "3 5", expectedOutput: "8", actualOutput: "8" },
        { testCaseId: "hidden-a", passed: false, input: "SECRET_INPUT", expectedOutput: "SECRET_EXPECTED", error: "SECRET_STACK", executionTimeMs: 399 },
      ],
    }, [
      { id: "public-a", input: "3 5", expectedOutput: "8", isHidden: false },
      { id: "hidden-a", input: "SECRET_INPUT", expectedOutput: "SECRET_EXPECTED", isHidden: true },
    ], true);
    mocks.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url !== "/api/assessments/code/execute") return originalFetch(url, init);
      mocks.trace.push("execute:submit");
      return Promise.resolve(json({ success: true, result: { ...safeResult, pointsEarned: 0, passedTests: 1, totalTests: 2 } }));
    });
    await openEditor();
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Enviar solución" })[0]); });
    expect(await screen.findByText("Algunos tests fallaron")).toBeTruthy();
    expect(screen.getByText(/Test 2 Falló/)).toBeTruthy();
    expect(screen.getByText("(Oculto)")).toBeTruthy();
    expect(document.body.textContent).not.toContain("SECRET_");
    expect(mocks.trace).toEqual(["execute:submit", "answer"]);
    expect(mocks.status).toBe("IN_PROGRESS");
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Finalizar" })[0]); });
    expect(mocks.trace).toEqual(["execute:submit", "answer", "submit"]);
  });

  it.each(["single", "multi", "mixed"])("keeps a %s attempt active after running a correct solution", async (layout) => {
    mocks.layout = layout;
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: solution } });
    await act(async () => { fireEvent.click(runButton()); });
    expect(await screen.findByText("¡Todos los tests pasaron!")).toBeTruthy();
    expect(mocks.trace).toEqual(["execute:run"]);
    expect(mocks.status).toBe("IN_PROGRESS");
    expect(mocks.answers).toEqual({});
    expect(screen.getByRole("button", { name: "Pregunta 1: Pendiente" })).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace.mock.calls.some(([url]) => url.endsWith("/results"))).toBe(false);
    expect((runButton() as HTMLButtonElement).disabled).toBe(false);
  });
  it("shows the starter failure, allows editing and repeated runs, and never saves or finalizes on run", async () => {
    const editor = await openEditor();
    expect((runButton() as HTMLButtonElement).type).toBe("button");
    expect(runButton().closest("form")).toBeNull();
    await act(async () => { fireEvent.click(runButton()); });
    expect(await screen.findByText("Algunos tests fallaron")).toBeTruthy();
    expect(screen.getAllByText(/NotImplementedError/).length).toBeGreaterThan(0);
    fireEvent.change(editor, { target: { value: solution } });
    await act(async () => { fireEvent.click(runButton()); });
    expect(await screen.findByText("¡Todos los tests pasaron!")).toBeTruthy();
    fireEvent.change(editor, { target: { value: getAssessmentCodingStarter("python") } });
    await act(async () => { fireEvent.click(runButton()); });
    expect(await screen.findByText("Algunos tests fallaron")).toBeTruthy();
    expect(mocks.trace).toEqual(["execute:run", "execute:run", "execute:run"]);
    expect(mocks.answers).toEqual({});
    expect(mocks.status).toBe("IN_PROGRESS");
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it.each(["single", "multi", "mixed-last"])("only explicit Finalizar closes a %s attempt after Enviar solución", async (layout) => {
    mocks.layout = layout;
    if (layout === "mixed-last") mocks.answers = { "mcq-a": ["a"] };
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: solution } });
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Enviar solución" })[0]); });
    await waitFor(() => expect(mocks.answers["question-a"]).toEqual(["__CODE_SUBMITTED__"]));
    expect(mocks.trace).toEqual(["execute:submit", "answer"]);
    expect(mocks.status).toBe("IN_PROGRESS");
    expect(mocks.push).not.toHaveBeenCalled();
    const submission = mocks.fetch.mock.calls.find(([url, init]) => url.endsWith("/execute") && JSON.parse(init.body).isSubmission);
    expect(JSON.parse(submission![1].body)).toMatchObject({ attemptId: "attempt-a", questionId: "question-a", code: solution, language: "python", isSubmission: true });
    if (layout === "multi") fireEvent.click(screen.getByRole("button", { name: "Pregunta 2: Pendiente" }));
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Finalizar" })[0]); });
    expect(mocks.trace).toEqual(["execute:submit", "answer", "submit"]);
    expect(mocks.status).toBe("SUBMITTED");
    expect(refreshAssessmentInbox).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenLastCalledWith("/assessments/attempts/attempt-a/results");
    expect(mocks.replace.mock.calls.filter(([url]) => url.endsWith("/results"))).toHaveLength(1);
  });
  it.each(["mcq", "mixed"])("autosaves MCQ answers in %s without submitting the attempt", async (layout) => {
    mocks.layout = layout;
    render(<CandidateAssessment />);
    if (layout === "mixed") {
      await screen.findByRole("textbox", { name: "Código del candidato" });
      fireEvent.click(screen.getByRole("button", { name: "Pregunta 2: Pendiente" }));
    }
    const option = await screen.findByRole("button", { name: /Respuesta A/ });
    await waitFor(() => expect((option as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(option);
    await waitFor(() => expect(mocks.answers["mcq-a"]).toEqual(["a"]));
    expect(mocks.trace).toEqual(["answer"]);
    expect(mocks.status).toBe("IN_PROGRESS");
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enviar evaluación ✓" })); });
    expect(mocks.status).toBe("SUBMITTED");
    expect(mocks.trace).toEqual(["answer", "submit"]);
    expect(mocks.replace).toHaveBeenLastCalledWith("/assessments/attempts/attempt-a/results");
    expect(mocks.replace.mock.calls.filter(([url]) => url.endsWith("/results"))).toHaveLength(1);
  });
  it("keeps the existing expiration policy and finalizes only once even with two timers", async () => {
    mocks.expired = true;
    render(<CandidateAssessment />);
    await waitFor(() => expect(mocks.trace).toEqual(["submit"]));
    expect(mocks.status).toBe("SUBMITTED");
    expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/execute"))).toBe(false);
  });
});
