// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Builder from "@/app/dashboard/assessments/builder/page";
import { getAssessmentCodingStarter } from "@/lib/ai/assessment-coding-starters";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  editId: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(mocks.editId ? `edit=${mocks.editId}` : ""),
}));

const codingQuestion = (language = "python") => ({
  type: "CODING",
  questionText: "Suma los dos enteros de stdin",
  section: "Algoritmos",
  difficulty: "JUNIOR",
  explanation: "Sumar ambos valores y mostrar el resultado.",
  codeSnippet: getAssessmentCodingStarter("python"),
  allowedLanguages: [language],
  testCases: [
    {
      input: "1 2",
      expectedOutput: "3",
      isHidden: false,
    },
    {
      input: "9 1",
      expectedOutput: "10",
      isHidden: true,
    },
  ],
});

function typeSelect() {
  return screen
    .getByRole("option", { name: "Mixto (MCQ + Código)" })
    .closest("select")!;
}

async function generate(questions: unknown[]) {
  mocks.fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ ok: true, questions }))
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Generar con AI" })
  );

  fireEvent.change(
    screen.getByRole("textbox", { name: "Describe qué quieres evaluar" }),
    {
      target: { value: "Problemas de algoritmos" },
    }
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Generar" })
  );

  await screen.findByRole("button", { name: /^Agregar \(/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.editId = "";
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("existing recruiter review and persistence flow", () => {
  it("previews/selects generated MCQs and persists recruiter edits only after an explicit save", async () => {
    render(<Builder />);

    const question = (questionText: string) => ({
      type: "MULTIPLE_CHOICE",
      questionText,
      section: "Algoritmos",
      difficulty: "JUNIOR",
      explanation: "Explicación",
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: false },
        { text: "C", isCorrect: false },
        { text: "D", isCorrect: false },
      ],
    });

    await generate([
      question("Pregunta uno"),
      question("Pregunta dos"),
      question("Pregunta tres"),
    ]);

    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: /Pregunta dos/ })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar (2)" })
    );

    expect(screen.queryByText("Pregunta dos")).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Pregunta uno"));

    fireEvent.change(
      screen.getByDisplayValue("Pregunta uno"),
      {
        target: { value: "Pregunta revisada" },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "Ej: React Senior — Evaluación técnica"
      ),
      {
        target: { value: "Evaluación revisada" },
      }
    );

    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          template: { id: "new-template" },
        })
      )
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar template" })
    );

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalled()
    );

    const [url, init] = mocks.fetch.mock.calls[1];

    expect(url).toBe(
      "/api/dashboard/assessments/templates"
    );

    const saved = JSON.parse(init.body);

    expect(
      saved.questions.map(
        (q: { questionText: string }) => q.questionText
      )
    ).toEqual([
      "Pregunta revisada",
      "Pregunta tres",
    ]);
  });

  it("preserves the generated coding language and full test cases when saving in the existing builder", async () => {
    render(<Builder />);

    fireEvent.change(typeSelect(), {
      target: { value: "CODING" },
    });

    await generate([codingQuestion()]);

    // Only languages supported by the existing Judge0 runner
    // are offered in the generator.
    const pythonOptions = screen.getAllByRole("option", {
      name: "Python",
    });

    const modalLanguageSelect =
      pythonOptions[pythonOptions.length - 1].closest("select")!;

    expect(
      Array.from(modalLanguageSelect.options).some(
        (option) => option.value === "bash"
      )
    ).toBe(false);

    // Add the generated coding question to the builder.
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar (1)" })
    );

    // Verify that the generated question is present.
    expect(
      screen.getByText(codingQuestion().questionText)
    ).toBeTruthy();

    fireEvent.click(screen.getByText(codingQuestion().questionText));
    const editor = screen.getByPlaceholderText("// Código base que verá el candidato (opcional)") as HTMLTextAreaElement;
    expect(editor.value).toBe(codingQuestion().codeSnippet);
    // getByDisplayValue normalizes whitespace unless an identity normalizer is supplied.
    expect(screen.getByDisplayValue(codingQuestion().codeSnippet, { normalizer: value => value })).toBe(editor);
    expect(screen.getByDisplayValue("9 1")).toBeTruthy();
    const revisedCode = `${codingQuestion().codeSnippet}\n# Revisado por el reclutador`;
    fireEvent.change(editor, { target: { value: revisedCode } });

    fireEvent.change(
      screen.getByPlaceholderText(
        "Ej: React Senior — Evaluación técnica"
      ),
      {
        target: { value: "Python Junior" },
      }
    );

    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          template: { id: "new-template" },
        })
      )
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar template" })
    );

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalled()
    );

    const saved = JSON.parse(
      mocks.fetch.mock.calls[1][1].body
    );

    // Verify the coding language is preserved.
    expect(saved.language).toBe("python");

    // Verify all generated coding data is preserved on save.
    expect(saved.questions[0]).toMatchObject({
      codeSnippet: revisedCode,
      language: "python",
      allowedLanguages: ["python"],
      testCases: codingQuestion().testCases,
    });
  });

  it("prevents adding a different generated coding language to an existing coding template", async () => {
    render(<Builder />);

    fireEvent.change(typeSelect(), {
      target: { value: "CODING" },
    });

    await generate([codingQuestion()]);

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar (1)" })
    );

    await generate([
      {
        ...codingQuestion("javascript"),
        questionText: "Pregunta JavaScript",
      },
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar (1)" })
    );

    expect(
      screen.getByText(/El lenguaje debe coincidir/)
    ).toBeTruthy();

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["CODING", "MIXED"])("locks the main language after adding coding questions in a %s template", async (type) => {
    render(<Builder />);
    fireEvent.change(typeSelect(), { target: { value: type } });
    if (type === "MIXED") {
      // Select coding in the existing generator's mixed-template flow.
      mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, questions: [codingQuestion()] })));
      fireEvent.click(screen.getByRole("button", { name: "Generar con AI" }));
      fireEvent.click(screen.getByRole("button", { name: /Código/ }));
      fireEvent.change(screen.getByRole("textbox", { name: "Describe qué quieres evaluar" }), { target: { value: "Algoritmos" } });
      fireEvent.click(screen.getByRole("button", { name: "Generar" }));
      await screen.findByRole("button", { name: "Agregar (1)" });
    } else {
      await generate([codingQuestion()]);
    }
    fireEvent.click(screen.getByRole("button", { name: "Agregar (1)" }));
    const language = screen.getByRole("combobox", { name: "Lenguaje del template" }) as HTMLSelectElement;
    expect(language.disabled).toBe(true);
    fireEvent.change(language, { target: { value: "javascript" } });
    expect(language.value).toBe("python");
    expect(screen.getByText(codingQuestion().questionText)).toBeTruthy();
    fireEvent.click(screen.getByText(codingQuestion().questionText));
    expect((screen.getByPlaceholderText("// Código base que verá el candidato (opcional)") as HTMLTextAreaElement).value).toBe(codingQuestion().codeSnippet);
  });

  async function loadTemplate(count: number) {
    mocks.editId = "template-a";
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      title: "Template existente", type: "MCQ", difficulty: "JUNIOR", language: "python",
      passingScore: 70, timeLimit: 30,
      questions: Array.from({ length: count }, (_, i) => ({
        id: `existing-${i}`, type: "MULTIPLE_CHOICE", questionText: `Existente ${i}`,
        options: [{ id: "a", text: "Sí", isCorrect: true }, { id: "b", text: "No", isCorrect: false }],
      })),
    })));
    render(<Builder />);
    await screen.findByText(`${count}/50 preguntas`);
  }

  it("rejects 48 + 5 atomically, retains selection, and accepts 48 + 2", async () => {
    await loadTemplate(48);
    const batch = Array.from({ length: 5 }, (_, i) => ({
      questionText: `Generada ${i}`, section: "General", difficulty: "JUNIOR", explanation: "Explicación",
      options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }, { text: "C", isCorrect: false }, { text: "D", isCorrect: false }],
    }));
    await generate(batch);
    fireEvent.click(screen.getByRole("button", { name: "Agregar (5)" }));
    expect(screen.getByText(/Puedes agregar 2 preguntas más/)).toBeTruthy();
    expect(screen.getByText("48/50 preguntas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agregar (5)" })).toBeTruthy();
    for (let i = 2; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: new RegExp(`Generada ${i}`) }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar (2)" }));
    expect(screen.getByText("50/50 preguntas")).toBeTruthy();
    expect(screen.getByText("Generada 0")).toBeTruthy();
    expect(screen.getByText("Generada 1")).toBeTruthy();
    expect(screen.queryByText("Generada 2")).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(2); // Load and generate, no implicit save.
  });

  it("does not offer further additions when the template already has 50 questions", async () => {
    await loadTemplate(50);
    expect(screen.queryByRole("button", { name: "Generar con AI" })).toBeNull();
    expect(screen.getByText("Límite de 50 preguntas alcanzado")).toBeTruthy();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
