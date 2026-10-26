// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Builder from "@/app/dashboard/assessments/builder/page";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn(), editId: "template-a" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh, back: mocks.back }),
  useSearchParams: () => new URLSearchParams(mocks.editId ? "edit=" + mocks.editId : ""),
}));
const mcq = (id: string, questionText: string) => ({
  id, questionText, type: "MULTIPLE_CHOICE", section: "Fundamentos", difficulty: "MID", explanation: "Revisión del reclutador", allowMultiple: false,
  codeSnippet: "", testCases: [], options: ["Uno", "Dos", "Tres", "Cuatro"].map((text, i) => ({ id: id + i, text, isCorrect: i === 0 })),
});
const coding = () => ({
  id: "coding-a", questionText: "Problema Python", type: "CODING", section: "Algoritmos", difficulty: "SENIOR", explanation: "Explicación privada",
  codeSnippet: "import sys\n# TODO\n", language: "python", allowedLanguages: '["python"]', options: [], allowMultiple: false,
  testCases: [{ input: "3\n5\n", expectedOutput: "8\n", isHidden: false }, { input: "-2\n10\n", expectedOutput: "8\n", isHidden: true }],
});
const template = () => ({
  title: "Evaluación QA", description: "Backend", type: "MIXED", language: "python", difficulty: "MID", passingScore: 70, timeLimit: 45, allowRetry: false, maxAttempts: 1,
  questions: [mcq("mcq-a", "Pregunta inicial"), coding(), mcq("mcq-b", "Pregunta final")],
});
function settings() {
  const button = screen.getByRole("button", { name: "Configuración" });
  if (button.getAttribute("aria-expanded") === "false") fireEvent.click(button);
}
const navigate = (text: string) => fireEvent.click(within(screen.getByRole("navigation", { name: "Lista de preguntas" })).getByRole("button", { name: new RegExp(text) }));
const statement = () => screen.getByRole("textbox", { name: "Enunciado *" });
async function load(data = template()) {
  mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(data)));
  render(<Builder />);
  await screen.findByRole("heading", { name: data.title });
  await screen.findByRole("textbox", { name: "Enunciado *" });
}
async function save() {
  mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ template: { id: "template-a" } })));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar template" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  return JSON.parse(mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1][1].body);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.editId = "template-a";
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("confirm", vi.fn(() => true));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("focused assessment authoring workspace", () => {
  it("edits one question at a time, preserves multiline and MCQ state, and reopens the saved payload", async () => {
    await load();
    expect(screen.getAllByRole("textbox", { name: "Enunciado *" })).toHaveLength(1);
    fireEvent.change(statement(), { target: { value: "Pregunta revisada" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Múltiple respuesta" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Opción 2:/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Opción 2" }), { target: { value: "Dos líneas\nsegunda línea" } });
    navigate("Problema Python");
    const starter = "import sys\n\ndef solution(data):\n    pass\n";
    fireEvent.change(screen.getByLabelText(/Código inicial/), { target: { value: starter } });
    fireEvent.change(screen.getByRole("textbox", { name: "Input del caso 1" }), { target: { value: "30\n50\n" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Output esperado del caso 1" }), { target: { value: "80\n" } });
    navigate("Pregunta revisada");
    expect((statement() as HTMLTextAreaElement).value).toBe("Pregunta revisada");
    expect((screen.getByRole("textbox", { name: "Opción 2" }) as HTMLTextAreaElement).value).toBe("Dos líneas\nsegunda línea");
    expect((screen.getByRole("checkbox", { name: /Opción 2:/ }) as HTMLInputElement).checked).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(1); // No auto-save.
    const saved = await save();
    const lastCall = mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1];
    expect(lastCall[0]).toBe("/api/dashboard/assessments/templates/template-a");
    expect(lastCall[1].method).toBe("PUT");
    expect(saved.questions[0]).toMatchObject({ id: "mcq-a", allowMultiple: true, options: [expect.objectContaining({ isCorrect: true }), expect.objectContaining({ text: "Dos líneas\nsegunda línea", isCorrect: true }), expect.anything(), expect.anything()] });
    expect(saved.questions[1]).toMatchObject({ codeSnippet: starter, language: "python", allowedLanguages: ["python"], difficulty: "SENIOR", explanation: "Explicación privada", testCases: [{ input: "30\n50\n", expectedOutput: "80\n", isHidden: false }, coding().testCases[1]] });
    cleanup();
    await load(saved);
    navigate("Problema Python");
    expect((screen.getByLabelText(/Código inicial/) as HTMLTextAreaElement).value).toBe(starter);
    expect((screen.getByRole("textbox", { name: "Input del caso 1" }) as HTMLTextAreaElement).value).toBe("30\n50\n");
    expect((screen.getByRole("checkbox", { name: "Caso 2: oculto" }) as HTMLInputElement).checked).toBe(true);
  });
  it("reorders by stable identity and keeps the selected question's data", async () => {
    await load();
    navigate("Problema Python");
    fireEvent.click(screen.getByRole("button", { name: "Subir pregunta" }));
    expect((statement() as HTMLTextAreaElement).value).toBe("Problema Python");
    expect((screen.getByRole("button", { name: "Subir pregunta" }) as HTMLButtonElement).disabled).toBe(true);
    const saved = await save();
    expect(saved.questions.map((q: { id: string }) => q.id)).toEqual(["coding-a", "mcq-a", "mcq-b"]);
    expect(saved.questions[0].testCases).toEqual(coding().testCases);
  });
  it("confirms removal and selects a surviving neighbor without changing its content", async () => {
    await load();
    navigate("Problema Python");
    vi.mocked(confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar pregunta" }));
    expect(screen.getByText("3/50 preguntas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar pregunta" }));
    expect((statement() as HTMLTextAreaElement).value).toBe("Pregunta final");
    expect((await save()).questions.map((q: { id: string }) => q.id)).toEqual(["mcq-a", "mcq-b"]);
  });
  it("retains validation errors across navigation and focuses the corresponding question", async () => {
    const data = template(); data.questions[1].questionText = ""; data.questions[1].testCases[0].input = "";
    await load(data);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar template" }));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const alert = screen.getByRole("alert", { name: "Errores de validación" });
    fireEvent.click(within(alert).getByRole("button", { name: "Pregunta 2: falta el enunciado" }));
    await waitFor(() => expect(document.activeElement).toBe(statement()));
    expect((statement() as HTMLTextAreaElement).value).toBe("");
    navigate("Pregunta inicial");
    expect(within(alert).getByRole("button", { name: "Pregunta 2: falta el enunciado" })).toBeTruthy();
    fireEvent.click(within(alert).getByRole("button", { name: "Pregunta 2: completa todos los casos de prueba" }));
    fireEvent.change(statement(), { target: { value: "Problema corregido" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Input del caso 1" }), { target: { value: "3\n5\n" } });
    expect(screen.queryByRole("alert", { name: "Errores de validación" })).toBeNull();
    expect((await save()).questions[1].questionText).toBe("Problema corregido");
  });
  it("searches and paginates a long list without rendering extra question editors", async () => {
    const data = { ...template(), questions: Array.from({ length: 24 }, (_, i) => mcq("q" + i, "Contenido " + (i + 1))) };
    await load(data);
    const nav = screen.getByRole("navigation", { name: "Lista de preguntas" });
    expect(within(nav).getAllByRole("button")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Preguntas siguientes" }));
    expect(within(nav).getByRole("button", { name: /Contenido 11/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar pregunta" }), { target: { value: "Contenido 24" } });
    navigate("Contenido 24");
    expect((statement() as HTMLTextAreaElement).value).toBe("Contenido 24");
    expect(screen.getAllByRole("textbox", { name: "Enunciado *" })).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Pregunta a editar" }), { target: { value: "q0" } });
    expect((statement() as HTMLTextAreaElement).value).toBe("Contenido 1");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("warns before leaving a dirty draft and blocks ordinary internal links when canceled", async () => {
    await load();
    const clean = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(statement(), { target: { value: "Sin guardar" } });
    const dirty = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    vi.mocked(confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(mocks.back).not.toHaveBeenCalled();
    const link = document.createElement("a"); link.href = "/dashboard/overview"; document.body.append(link);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true }); link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); link.remove();
    vi.mocked(confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(mocks.back).toHaveBeenCalledOnce();
  });
  it("requires confirmation before changing type drops incompatible draft questions", async () => {
    await load(); settings();
    vi.mocked(confirm).mockReturnValueOnce(false);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo *" }), { target: { value: "CODING" } });
    expect(screen.getByText("3/50 preguntas")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo *" }), { target: { value: "CODING" } });
    expect(screen.getByText("1/50 preguntas")).toBeTruthy();
    expect((await save()).questions[0].testCases).toEqual(coding().testCases);
  });
  it("creates a manual MCQ from an empty workspace with a single explicit POST", async () => {
    mocks.editId = ""; render(<Builder />);
    fireEvent.change(screen.getByRole("textbox", { name: "Título *" }), { target: { value: "Nueva evaluación manual" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar opción múltiple" }));
    fireEvent.change(statement(), { target: { value: "Pregunta manual" } });
    for (let i = 1; i <= 4; i++) fireEvent.change(screen.getByRole("textbox", { name: "Opción " + i }), { target: { value: "Respuesta " + i } });
    fireEvent.click(screen.getByRole("radio", { name: /Opción 1:/ }));
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ template: { id: "new-a" } }), { status: 201 }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar template" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/dashboard/assessments/templates", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).questions[0]).toMatchObject({ questionText: "Pregunta manual", allowMultiple: false });
  });
  it("opens the existing AI generator outside the sticky layout and restores focus on Escape", async () => {
    await load();
    const trigger = screen.getByRole("button", { name: "Generar con AI" }); trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Generador de preguntas con AI" });
    expect(dialog.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Describe qué quieres evaluar" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("confirms an explicit conversion from multiple correct answers to a single answer", async () => {
    await load();
    const multiple = screen.getByRole("checkbox", { name: "Múltiple respuesta" });
    fireEvent.click(multiple);
    fireEvent.click(screen.getByRole("checkbox", { name: /Opción 2:/ }));
    vi.mocked(confirm).mockReturnValueOnce(false);
    fireEvent.click(multiple);
    expect((multiple as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Opción 2:/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(multiple);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    const saved = await save();
    expect(saved.questions[0].allowMultiple).toBe(false);
    expect(saved.questions[0].options.filter((option: { isCorrect: boolean }) => option.isCorrect)).toHaveLength(1);
  });
  it("keeps server save errors and edited data visible across question navigation", async () => {
    await load();
    fireEvent.change(statement(), { target: { value: "Cambio no guardado" } });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "No se pudo guardar" }), { status: 500 }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar template" }));
    await screen.findByRole("button", { name: "No se pudo guardar" });
    navigate("Problema Python");
    expect(screen.getByRole("button", { name: "No se pudo guardar" })).toBeTruthy();
    navigate("Cambio no guardado");
    expect((statement() as HTMLTextAreaElement).value).toBe("Cambio no guardado");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
