// components/dashboard/assessments/AIQuestionGenerator.tsx
"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, ChevronDown, Plus, AlertCircle, Wand2 } from "lucide-react";

type GeneratedMCQOption = { text: string; isCorrect: boolean };
type GeneratedTestCase = { input: string; expectedOutput: string; isHidden: boolean };

type GeneratedQuestion = {
  questionText: string;
  section: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  explanation: string;
  // MCQ
  options?: GeneratedMCQOption[];
  // CODING
  codeSnippet?: string;
  allowedLanguages?: string[];
  testCases?: GeneratedTestCase[];
};

type Props = {
  onAddQuestions: (questions: GeneratedQuestion[]) => void;
  currentLanguage?: string;
  currentDifficulty?: string;
  currentType?: "MCQ" | "CODING" | "MIXED";
};

const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  java: "Java", cpp: "C++", csharp: "C#", go: "Go", rust: "Rust",
  sql: "SQL", php: "PHP", ruby: "Ruby", swift: "Swift", kotlin: "Kotlin",
};

const EXAMPLE_PROMPTS: Record<string, string[]> = {
  MCQ: [
    "Preguntas sobre closures y hoisting en JavaScript",
    "Preguntas de SQL: JOINs, subconsultas y agregaciones",
    "Fundamentos de programación orientada a objetos en Python",
    "Preguntas sobre algoritmos de búsqueda y ordenamiento",
    "Conceptos de REST APIs y HTTP",
  ],
  CODING: [
    "Función que invierte una cadena de texto",
    "Encontrar el número mayor en una lista",
    "Verificar si un número es primo",
    "Contar palabras en un texto",
    "Calcular el factorial de un número",
  ],
};

export default function AIQuestionGenerator({
  onAddQuestions,
  currentLanguage = "",
  currentDifficulty = "MID",
  currentType = "MCQ",
}: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [questionType, setQuestionType] = useState<"MULTIPLE_CHOICE" | "CODING">(
    currentType === "CODING" ? "CODING" : "MULTIPLE_CHOICE"
  );
  const [language, setLanguage] = useState(currentLanguage || "python");
  const [difficulty, setDifficulty] = useState<"JUNIOR" | "MID" | "SENIOR">(
    (currentDifficulty as any) || "MID"
  );
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const isCoding = questionType === "CODING";
  const examples = isCoding ? EXAMPLE_PROMPTS.CODING : EXAMPLE_PROMPTS.MCQ;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Describe qué tipo de preguntas quieres generar");
      return;
    }
    setError("");
    setLoading(true);
    setPreview([]);
    setSelected(new Set());

    try {
      const res = await fetch("/api/ai/assessment-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, questionType, language, difficulty, count }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Error al generar preguntas");
        return;
      }
      setPreview(data.questions);
      setSelected(new Set(data.questions.map((_: any, i: number) => i)));
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const toAdd = preview.filter((_, i) => selected.has(i));
    if (toAdd.length === 0) return;
    onAddQuestions(toAdd);
    setPreview([]);
    setPrompt("");
    setSelected(new Set());
    setOpen(false);
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <>
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-all hover:border-violet-500 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-900/30"
      >
        <Sparkles className="h-4 w-4" />
        Generar con AI
      </button>

      {/* ── Panel / Modal ────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                  <Wand2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    Generador de preguntas con AI
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Describe lo que necesitas y el AI crea las preguntas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Tipo de pregunta */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "MULTIPLE_CHOICE", label: "Opción múltiple", icon: "✓" },
                  { value: "CODING", label: "Código", icon: "</>" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuestionType(opt.value as any)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                      questionType === opt.value
                        ? "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/30 dark:text-violet-300"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Config row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Lenguaje — solo para coding */}
                {isCoding && (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Lenguaje
                    </label>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {Object.entries(LANGUAGE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Dificultad */}
                <div className={isCoding ? "" : "col-span-2"}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Nivel
                  </label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="JUNIOR">Junior</option>
                    <option value="MID">Mid Level</option>
                    <option value="SENIOR">Senior</option>
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Cantidad
                  </label>
                  <select
                    value={count}
                    onChange={e => setCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} pregunta{n > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Describe qué quieres evaluar *
                </label>
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setError(""); }}
                  placeholder={isCoding
                    ? "Ej: Función que encuentre el segundo número más grande en una lista..."
                    : "Ej: Preguntas sobre manejo de errores y excepciones en Python..."
                  }
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
                {/* Ejemplos rápidos */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {examples.slice(0, 3).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setPrompt(ex)}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] text-zinc-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-700 dark:hover:text-violet-400 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/20">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Preview de preguntas generadas */}
              {preview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      {preview.length} pregunta{preview.length > 1 ? "s" : ""} generada{preview.length > 1 ? "s" : ""} — selecciona cuáles agregar
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(
                          selected.size === preview.length
                            ? new Set()
                            : new Set(preview.map((_, i) => i))
                        )
                      }
                      className="text-[10px] text-violet-600 hover:underline dark:text-violet-400"
                    >
                      {selected.size === preview.length ? "Deseleccionar todas" : "Seleccionar todas"}
                    </button>
                  </div>

                  {preview.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleSelect(i)}
                      className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                        selected.has(i)
                          ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/20"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Checkbox */}
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                          selected.has(i)
                            ? "border-violet-500 bg-violet-500"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}>
                          {selected.has(i) && (
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                              {q.section}
                            </span>
                            <span className="text-[10px] text-zinc-400">·</span>
                            <span className="text-[10px] text-zinc-400">{q.difficulty}</span>
                            {q.testCases && (
                              <>
                                <span className="text-[10px] text-zinc-400">·</span>
                                <span className="text-[10px] text-zinc-400">{q.testCases.length} test cases</span>
                              </>
                            )}
                            {q.options && (
                              <>
                                <span className="text-[10px] text-zinc-400">·</span>
                                <span className="text-[10px] text-zinc-400">{q.options.length} opciones</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2">
                            {q.questionText}
                          </p>
                          {q.options && (
                            <div className="mt-1.5 space-y-0.5">
                              {q.options.map((opt, j) => (
                                <p key={j} className={`text-[10px] flex items-center gap-1 ${opt.isCorrect ? "text-emerald-600 font-medium dark:text-emerald-400" : "text-zinc-400"}`}>
                                  {opt.isCorrect ? "✓" : "○"} {opt.text}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.codeSnippet && (
                            <pre className="mt-1.5 rounded bg-zinc-900 px-2 py-1.5 text-[10px] text-green-400 font-mono line-clamp-2 overflow-hidden">
                              {q.codeSnippet}
                            </pre>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] text-zinc-400">
                ✨ Powered by Claude AI · Revisa siempre las preguntas antes de publicar
              </p>
              <div className="flex gap-2">
                {preview.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generar
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Regenerar
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={selected.size === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar {selected.size > 0 ? `(${selected.size})` : ""}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}