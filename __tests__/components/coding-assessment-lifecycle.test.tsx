// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CandidateAssessment from "@/app/assessments/[templateId]/page";
import { getAssessmentCodingStarter } from "@/lib/ai/assessment-coding-starters";

const mocks = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return {
    fetch: vi.fn(), push, replace, router: { push, replace },
    layout: "single", status: "IN_PROGRESS", trace: [] as string[],
    answers: {} as Record<string, string[]>, expired: false,
  };
});
vi.mock("next/navigation", () => ({
  useParams: () => ({ templateId: "template-a" }),
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams("attemptId=attempt-a"),
}));
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
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/assessments/attempts/attempt-a/results");
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
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/assessments/attempts/attempt-a/results");
  });
  it("keeps the existing expiration policy and finalizes only once even with two timers", async () => {
    mocks.expired = true;
    render(<CandidateAssessment />);
    await waitFor(() => expect(mocks.trace).toEqual(["submit"]));
    expect(mocks.status).toBe("SUBMITTED");
    expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/execute"))).toBe(false);
  });
});
