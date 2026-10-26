"use client";

// app/dashboard/assessments/builder/page.tsx
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import AIQuestionGenerator, { type GeneratedQuestion } from "@/components/dashboard/assessments/AIQuestionGenerator";
import AssessmentPreviewModal from "@/components/dashboard/assessments/AssessmentPreviewModal";
import BuilderQuestionEditor, { builderInputClass, type BuilderQuestion as Question, type BuilderOption as MCQOption } from "@/components/dashboard/assessments/BuilderQuestionEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRouter, useSearchParams } from "next/navigation";
import { isCodingLanguage } from "@/lib/code-execution/languages";
import { getTemplateCodingLanguageError, parseQuestionLanguages } from "@/lib/assessments/template-coding-language";
import {
  Plus, Trash2, Save, AlertCircle,
  ArrowLeft, Eye, Settings2, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight,
} from "lucide-react";

const MAX_QUESTIONS = 50;
const DIFFICULTIES = ["JUNIOR", "MID", "SENIOR"] as const;
const LANGUAGES = [
  { value: "", label: "Sin lenguaje (genérico)" },
  // ── Más populares en reclutamiento TI ──
  { value: "javascript", label: "JavaScript (Node.js)" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "sql", label: "SQL (SQLite)" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "scala", label: "Scala" },
  { value: "r", label: "R" },
  // ── Scripting y shell ──
  { value: "bash", label: "Bash" },
  { value: "perl", label: "Perl" },
  { value: "lua", label: "Lua" },
  // ── Funcionales y académicos ──
  { value: "haskell", label: "Haskell" },
  { value: "elixir", label: "Elixir" },
  { value: "erlang", label: "Erlang" },
  { value: "clojure", label: "Clojure" },
  { value: "fsharp", label: "F#" },
  { value: "ocaml", label: "OCaml" },
  { value: "commonlisp", label: "Common Lisp" },
  // ── Otros ──
  { value: "objectivec", label: "Objective-C" },
  { value: "pascal", label: "Pascal" },
  { value: "prolog", label: "Prolog" },
  { value: "cobol", label: "COBOL" },
  { value: "fortran", label: "Fortran" },
  { value: "d", label: "D" },
  { value: "groovy", label: "Groovy" },
  { value: "nim", label: "Nim" },
  { value: "octave", label: "Octave" },
  { value: "vbnet", label: "Visual Basic .NET" },
  { value: "assembly", label: "Assembly (NASM)" },
  { value: "basic", label: "Basic" },
  { value: "javafx", label: "JavaFX" },
];

type QuestionType = "MULTIPLE_CHOICE" | "CODING";
type Difficulty = "JUNIOR" | "MID" | "SENIOR";

type TemplateForm = {
  title: string;
  description: string;
  type: "MCQ" | "CODING" | "MIXED";
  difficulty: Difficulty;
  language: string;
  passingScore: number;
  timeLimit: number;
  allowRetry: boolean;
  maxAttempts: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyMCQ(): Question {
  return {
    id: uid(), type: "MULTIPLE_CHOICE",
    questionText: "", section: "General", difficulty: "JUNIOR",
    explanation: "",
    options: [
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
    ],
    allowMultiple: false,
    codeSnippet: "", testCases: [],
  };
}

function emptyCoding(): Question {
  return {
    id: uid(), type: "CODING",
    questionText: "", section: "General", difficulty: "JUNIOR",
    explanation: "",
    options: [], allowMultiple: false,
    codeSnippet: "",
    testCases: [
      { input: "", expectedOutput: "", isHidden: false },
      { input: "", expectedOutput: "", isHidden: false },
      { input: "", expectedOutput: "", isHidden: true },
      { input: "", expectedOutput: "", isHidden: true },
    ],
  };
}

// Suspense wrapper — requerido por Next.js 14 cuando se usa useSearchParams()
export default function AssessmentBuilderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500">Cargando...</p>
        </div>
      </div>
    }>
      <BuilderInner />
    </Suspense>
  );
}

function BuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit"); // null = create, string = edit mode

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<TemplateForm>({
    title: "", description: "",
    type: "MCQ", difficulty: "JUNIOR",
    language: "", passingScore: 70, timeLimit: 30,
    allowRetry: false,
    maxAttempts: 1,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showAddActions, setShowAddActions] = useState(true);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [query, setQuery] = useState("");
  const [navigationPage, setNavigationPage] = useState(0);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // ── hydrate from existing template when ?edit=ID ──
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    fetch(`/api/dashboard/assessments/templates/${editId}`)
      .then(r => r.json())
      .then(data => {
        if (!data || data.error) {
          setErrors([data?.error || "No se pudo cargar el template"]);
          return;
        }
        // Populate form fields
        setForm({
          title: data.title ?? "",
          description: data.description ?? "",
          type: data.type ?? "MCQ",
          difficulty: data.difficulty ?? "JUNIOR",
          language: data.language ?? "",
          passingScore: data.passingScore ?? 70,
          timeLimit: data.timeLimit ?? 30,
          allowRetry: data.allowRetry ?? false,
          maxAttempts: data.maxAttempts ?? 1,
        });
        // Map DB questions → local Question shape
        const mapped: Question[] = (data.questions ?? []).map((q: any) => ({
          id: q.id,
          type: q.type === "CODING" ? "CODING" : "MULTIPLE_CHOICE",
          questionText: q.questionText ?? "",
          section: q.section ?? "General",
          difficulty: q.difficulty ?? "JUNIOR",
          explanation: q.explanation ?? "",
          options: Array.isArray(q.options)
            ? q.options.map((o: any) => ({ id: o.id ?? uid(), text: o.text ?? "", isCorrect: Boolean(o.isCorrect) }))
            : [],
          allowMultiple: Boolean(q.allowMultiple),
          codeSnippet: q.codeSnippet ?? q.starterCode ?? "",
          language: q.language ?? undefined,
          allowedLanguages: parseQuestionLanguages(q.allowedLanguages) ?? undefined,
          testCases: (q.testCases ?? []).map((tc: any) => ({
            input: tc.input ?? "",
            expectedOutput: tc.expectedOutput ?? "",
            isHidden: Boolean(tc.isHidden),
          })),
        }));
        setQuestions(mapped);
        setActiveId(mapped[0]?.id ?? null);
        setShowSettings(false);
        setShowAddActions(false);
      })
      .catch(() => setErrors(["Error de conexión al cargar el template"]))
      .finally(() => setLoading(false));
  }, [editId]);

  const markDirty = () => { dirtyRef.current = true; setDirty(true); };

  // Saving remains explicit. Guard reload/close and ordinary same-tab links.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      if (!window.confirm("Tienes cambios sin guardar. ¿Quieres salir y descartarlos?")) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        dirtyRef.current = false;
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, []);

  useEffect(() => {
    if (!focusTarget) return;
    const target = document.getElementById(focusTarget);
    target?.focus();
    target?.scrollIntoView?.({ block: "center" });
    setFocusTarget(null);
  }, [focusTarget, activeId, showSettings]);

  const leaveBuilder = () => {
    if (dirtyRef.current && !window.confirm("Tienes cambios sin guardar. ¿Quieres salir y descartarlos?")) return;
    dirtyRef.current = false;
    router.back();
  };

  const selectQuestion = (id: string) => {
    setActiveId(id);
    setShowSettings(false);
  };

  const moveQuestion = (direction: -1 | 1) => {
    const index = questions.findIndex(question => question.id === activeId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= questions.length) return;
    const reordered = [...questions];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    setQuestions(reordered);
    setNavigationPage(Math.floor(destination / 10));
    markDirty();
  };

  // ── form helpers ──
  const setField = (k: keyof TemplateForm, v: any) => {
    if (k === "type" && questions.some(q => (v === "MCQ" && q.type === "CODING") || (v === "CODING" && q.type === "MULTIPLE_CHOICE"))) {
      if (!window.confirm("Cambiar el tipo quitará las preguntas incompatibles del borrador. ¿Quieres continuar?")) return;
    }
    if (k === "language") {
      const languageError = getTemplateCodingLanguageError(v, questions, {
        language: form.language,
        questions: questions.filter(q => q.type === "CODING"),
      });
      if (languageError) { setErrors([languageError]); return; }
    }
    markDirty();
    setForm(f => ({ ...f, [k]: v }));
    if (k === "type") {
      if (v === "MCQ") setQuestions(qs => qs.filter(q => q.type === "MULTIPLE_CHOICE"));
      else if (v === "CODING") setQuestions(qs => qs.filter(q => q.type === "CODING"));
    }
  };

  // ── question helpers ──
  const addQuestionsFromAI = (generated: GeneratedQuestion[]) => {
    const remaining = MAX_QUESTIONS - questions.length;
    if (generated.length > remaining) {
      return `Puedes agregar ${Math.max(remaining, 0)} preguntas más (máximo ${MAX_QUESTIONS}). Ajusta tu selección.`;
    }
    const codingLanguage = generated.find(q => q.testCases)?.allowedLanguages?.[0];
    // Persistence uses the template language for every coding question.
    if (codingLanguage && codingLanguage !== form.language && questions.some(q => q.type === "CODING")) {
      return false;
    }
    if (codingLanguage) setForm(prev => ({ ...prev, language: codingLanguage }));
    const additions = generated.map(q => {
      const isCoding = Array.isArray(q.testCases);
      const uid = () => Math.random().toString(36).slice(2);
      const base = {
        id: uid(),
        type: isCoding ? "CODING" as const : "MULTIPLE_CHOICE" as const,
        questionText: q.questionText ?? "",
        section: q.section ?? "General",
        difficulty: (q.difficulty ?? "MID") as any,
        explanation: q.explanation ?? "",
        options: (isCoding ? [] : (q.options ?? []).map((o: any) => ({ id: uid(), text: o.text ?? "", isCorrect: Boolean(o.isCorrect) }))) as { id: string; text: string; isCorrect: boolean }[],
        allowMultiple: false,
        codeSnippet: isCoding ? (q.codeSnippet ?? "") : "",
        language: isCoding ? codingLanguage : undefined,
        allowedLanguages: isCoding ? q.allowedLanguages : undefined,
        testCases: (isCoding ? (q.testCases ?? []).map((tc: any) => ({ input: tc.input ?? "", expectedOutput: tc.expectedOutput ?? "", isHidden: Boolean(tc.isHidden) })) : []) as { input: string; expectedOutput: string; isHidden: boolean }[],
      };
      return base;
    });
    setQuestions(prev => [...prev, ...additions]);
    setActiveId(additions[0]?.id ?? activeId);
    setShowSettings(false);
    setShowAddActions(false);
    setQuery("");
    setNavigationPage(Math.floor(questions.length / 10));
    markDirty();
    return true;
  };

  const addQuestion = (type: QuestionType) => {
    if (questions.length >= MAX_QUESTIONS) return;
    const q = type === "MULTIPLE_CHOICE" ? emptyMCQ() : {
      ...emptyCoding(), language: form.language || undefined,
      allowedLanguages: form.language ? [form.language] : undefined,
    };
    setQuestions(qs => [...qs, q]);
    setActiveId(q.id);
    setShowSettings(false);
    setShowAddActions(false);
    setQuery("");
    setNavigationPage(Math.floor(questions.length / 10));
    markDirty();
  };

  const removeQuestion = (id: string) => {
    if (!window.confirm("¿Eliminar esta pregunta del borrador? El cambio se aplicará al guardar.")) return;
    const index = questions.findIndex(q => q.id === id);
    const remaining = questions.filter(q => q.id !== id);
    setQuestions(remaining);
    if (activeId === id) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    markDirty();
  };

  const updateQuestion = useCallback((id: string, patch: Partial<Question>) => {
    dirtyRef.current = true;
    setDirty(true);
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q));
  }, []);

  // MCQ option helpers
  const updateOption = (qid: string, oid: string, patch: Partial<MCQOption>) => {
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q;
      return { ...q, options: q.options.map(o => o.id === oid ? { ...o, ...patch } : o) };
    }));
  };

  const addOption = (qid: string) => {
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.options.length >= 6) return q;
      return { ...q, options: [...q.options, { id: uid(), text: "", isCorrect: false }] };
    }));
  };

  const removeOption = (qid: string, oid: string) => {
    const option = questions.find(q => q.id === qid)?.options.find(o => o.id === oid);
    if (option?.text.trim() && !window.confirm("¿Eliminar esta opción del borrador?")) return;
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.options.length <= 2) return q;
      return { ...q, options: q.options.filter(o => o.id !== oid) };
    }));
  };

  const setCorrect = (qid: string, oid: string, multi: boolean) => {
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q;
      const options = q.options.map(o =>
        multi ? (o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o)
              : { ...o, isCorrect: o.id === oid }
      );
      return { ...q, options };
    }));
  };

  // Test case helpers
  const addTestCase = (qid: string) => {
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.testCases.length >= 10) return q;
      return { ...q, testCases: [...q.testCases, { input: "", expectedOutput: "", isHidden: false }] };
    }));
  };

  const updateTestCase = (qid: string, idx: number, patch: Partial<{ input: string; expectedOutput: string; isHidden: boolean }>) => {
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q;
      const tc = [...q.testCases];
      tc[idx] = { ...tc[idx], ...patch };
      return { ...q, testCases: tc };
    }));
  };

  const removeTestCase = (qid: string, idx: number) => {
    const testCase = questions.find(q => q.id === qid)?.testCases[idx];
    if ((testCase?.input || testCase?.expectedOutput) && !window.confirm("¿Eliminar este caso de prueba del borrador?")) return;
    markDirty();
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.testCases.length <= 1) return q;
      return { ...q, testCases: q.testCases.filter((_, i) => i !== idx) };
    }));
  };

  // ── validación ──
  function questionIssues(q: Question, n: number): string[] {
    const errs: string[] = [];
    if (!q.questionText.trim()) errs.push(`Pregunta ${n}: falta el enunciado`);
    if (q.type === "MULTIPLE_CHOICE") {
      if (!q.options.some(o => o.isCorrect)) errs.push(`Pregunta ${n}: marca al menos una respuesta correcta`);
      if (q.options.some(o => !o.text.trim())) errs.push(`Pregunta ${n}: todas las opciones deben tener texto`);
    }
    if (q.type === "CODING") {
      if (!q.testCases.length) errs.push(`Pregunta ${n}: agrega al menos un caso de prueba`);
      if (q.testCases.some(tc => !tc.input.trim() || !tc.expectedOutput.trim()))
        errs.push(`Pregunta ${n}: completa todos los casos de prueba`);
    }
    return errs;
  }


  function validate(): string[] {
    const errs: string[] = [];
    if (!form.title.trim()) errs.push("El título es requerido");
    if (form.passingScore < 1 || form.passingScore > 100) errs.push("El puntaje mínimo debe ser entre 1 y 100");
    if (form.timeLimit < 5 || form.timeLimit > 180) errs.push("El tiempo debe ser entre 5 y 180 minutos");
    if (!questions.length) errs.push("Agrega al menos una pregunta");
    if (questions.length > MAX_QUESTIONS) errs.push(`Máximo ${MAX_QUESTIONS} preguntas`);
    const languageError = getTemplateCodingLanguageError(form.language, questions);
    if (languageError) errs.push(languageError);

    questions.forEach((q, i) => errs.push(...questionIssues(q, i + 1)));
    return errs;
  }

  // ── submit: POST (create) or PUT (edit) ──
  async function handleSave() {
    const errs = validate();
    setErrors([]);
    setValidationAttempted(true);
    if (errs.length) {
      revealIssue(errs[0]);
      return;
    }

    setSaving(true);
    try {
      const url = editId
        ? `/api/dashboard/assessments/templates/${editId}`
        : "/api/dashboard/assessments/templates";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, questions }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors([data.error || "Error al guardar"]); return; }
      dirtyRef.current = false;
      setDirty(false);
      router.refresh(); // Invalida el router cache de Next.js para que el server component se re-fetche
      router.push("/dashboard/assessments/templates?scope=custom");
    } catch {
      setErrors(["Error de conexión"]);
    } finally {
      setSaving(false);
    }
  }

  const canAddMore = questions.length < MAX_QUESTIONS;


  const activeQuestion = questions.find(q => q.id === activeId) ?? questions[0] ?? null;
  const activeIndex = activeQuestion ? questions.indexOf(activeQuestion) : -1;
  const filteredQuestions = questions.filter(q => (q.questionText + " " + q.type).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const page = Math.min(navigationPage, Math.max(0, Math.ceil(filteredQuestions.length / 10) - 1));
  const pageQuestions = filteredQuestions.slice(page * 10, page * 10 + 10);
  const displayedErrors = Array.from(new Set([...errors, ...(validationAttempted ? validate() : [])]));

  function revealIssue(message: string) {
    const questionNumber = message.match(/^Pregunta (\d+):/);
    const question = questionNumber ? questions[Number(questionNumber[1]) - 1] : null;
    if (question) {
      selectQuestion(question.id);
      setQuery("");
      setNavigationPage(Math.floor(questions.indexOf(question) / 10));
      setFocusTarget("question-statement");
    } else if (!questions.length && message.includes("pregunta")) {
      setShowSettings(false);
      setFocusTarget("add-questions");
    } else {
      setShowSettings(true);
      setFocusTarget(message.includes("puntaje") ? "minimum-score" : message.includes("tiempo") ? "time-limit" : /lenguaje/i.test(message) ? "template-language" : "assessment-title");
    }
  }

  useEffect(() => {
    if (!questions.some(q => q.id === activeId)) setActiveId(questions[0]?.id ?? null);
  }, [questions, activeId]);

  if (loading) {
    return <div role="status" aria-busy="true" className="mx-auto max-w-7xl space-y-6 p-6">
      <span className="sr-only">Cargando evaluación…</span>
      <Skeleton className="h-16 motion-reduce:animate-none" />
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]"><Skeleton className="h-80 motion-reduce:animate-none" /><Skeleton className="h-96 motion-reduce:animate-none" /></div>
    </div>;
  }

  const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 focus-ring disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-14 z-20 border-b border-zinc-200 bg-white md:top-16 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button type="button" onClick={leaveBuilder} disabled={saving} aria-label="Volver" className={actionClass + " w-11 shrink-0 px-0"}><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold" title={form.title || undefined}>{form.title || (editId ? "Editar evaluación" : "Nueva evaluación")}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">{form.type}</span><span>{questions.length}/{MAX_QUESTIONS} preguntas</span>
                <span aria-live="polite">{dirty ? "Cambios sin guardar" : "Guardado manual"}</span>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button type="button" aria-expanded={showSettings} aria-controls="builder-settings" onClick={() => setShowSettings(value => !value)} disabled={saving} className={actionClass}><Settings2 className="h-4 w-4" />Configuración</button>
            {questions.length > 0 && <button type="button" onClick={() => setShowPreview(true)} disabled={saving} className={actionClass}><Eye className="h-4 w-4" /><span className="hidden sm:inline">Vista previa</span><span className="sr-only sm:hidden">Vista previa</span></button>}
            <button type="button" aria-label={saving ? "Guardando..." : editId ? "Actualizar template" : "Guardar template"} onClick={handleSave} disabled={saving} className="ml-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 focus-ring disabled:cursor-not-allowed disabled:opacity-50 sm:ml-0 dark:bg-teal-600 dark:text-zinc-950 dark:hover:bg-teal-500">
              <Save className="h-4 w-4" /><span className="sm:hidden">{saving ? "Guardando..." : "Guardar"}</span><span className="hidden sm:inline">{saving ? "Guardando..." : editId ? "Actualizar template" : "Guardar template"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 lg:px-6">
        {displayedErrors.length > 0 && <section role="alert" aria-label="Errores de validación" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertCircle className="h-4 w-4" />Corrige los siguientes errores:</h2>
          <ul className="space-y-1">{displayedErrors.map(error => <li key={error}><button type="button" onClick={() => revealIssue(error)} className="min-h-9 rounded px-1 text-left text-sm underline decoration-red-300 underline-offset-4 focus-ring dark:decoration-red-700">{error}</button></li>)}</ul>
        </section>}

        <fieldset disabled={saving} className="min-w-0 space-y-6">
          <section id="builder-settings" hidden={!showSettings} aria-labelledby="settings-heading" className="scroll-mt-56 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 id="settings-heading" className="text-lg font-semibold">Configuración general</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Define la evaluación. Tus cambios se guardan sólo al confirmar.</p></div>
              <button type="button" onClick={() => setShowSettings(false)} className={actionClass}>Cerrar configuración</button>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="min-w-0 text-sm font-medium sm:col-span-2 xl:col-span-2">Título *
                <input id="assessment-title" value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Ej: React Senior — Evaluación técnica" className={builderInputClass + " mt-2 scroll-mt-56"} />
              </label>
              <label className="min-w-0 text-sm font-medium">Tipo *
                <select value={form.type} onChange={e => setField("type", e.target.value)} className={builderInputClass + " mt-2"}>
                  <option value="MCQ">Opción múltiple</option><option value="CODING">Código</option><option value="MIXED">Mixto (MCQ + Código)</option>
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium sm:col-span-2 xl:col-span-3">Descripción
                <textarea value={form.description} onChange={e => setField("description", e.target.value)} placeholder="Describe qué evalúa este template..." rows={2} className={builderInputClass + " mt-2 resize-y"} />
              </label>
              <label className="min-w-0 text-sm font-medium">Nivel *
                <select value={form.difficulty} onChange={e => setField("difficulty", e.target.value)} className={builderInputClass + " mt-2"}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d === "JUNIOR" ? "Junior" : d === "MID" ? "Mid Level" : "Senior"}</option>)}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium">Lenguaje
                <select id="template-language" aria-label="Lenguaje del template" value={form.language} disabled={questions.some(q => q.type === "CODING") && isCodingLanguage(form.language)} onChange={e => setField("language", e.target.value)} className={builderInputClass + " mt-2 scroll-mt-56"}>
                  {LANGUAGES.filter(l => (form.type !== "CODING" && !questions.some(q => q.type === "CODING")) || l.value === "" || isCodingLanguage(l.value)).map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                {questions.some(q => q.type === "CODING") && isCodingLanguage(form.language) && <span className="mt-2 block text-sm font-normal text-zinc-600 dark:text-zinc-400">Fijo mientras haya preguntas de código.</span>}
                {form.type === "CODING" && !form.language && <span className="mt-2 block text-sm font-normal text-amber-800 dark:text-amber-300">Selecciona un lenguaje compatible con Judge0.</span>}
              </label>
              <label className="min-w-0 text-sm font-medium">Puntaje mínimo para aprobar *
                <div className="mt-2 flex items-center gap-2"><input id="minimum-score" type="number" min={1} max={100} value={form.passingScore} onChange={e => setField("passingScore", Number(e.target.value))} className={builderInputClass + " scroll-mt-56"} /><span aria-hidden="true">%</span></div>
              </label>
              <label className="min-w-0 text-sm font-medium">Tiempo límite *
                <div className="mt-2 flex items-center gap-2"><input id="time-limit" type="number" min={5} max={180} value={form.timeLimit} onChange={e => setField("timeLimit", Number(e.target.value))} className={builderInputClass + " scroll-mt-56"} /><span aria-hidden="true">min</span></div>
                <span className="mt-2 block text-sm font-normal text-zinc-600 dark:text-zinc-400">Entre 5 y 180 minutos.</span>
              </label>
              <div className="flex flex-col justify-center">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.allowRetry} onChange={e => setField("allowRetry", e.target.checked)} className="h-4 w-4 accent-teal-700" />Permitir re-intentos</label>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Puede repetir si no aprueba.</p>
              </div>
              {form.allowRetry && <label className="min-w-0 text-sm font-medium">Número máximo de intentos
                <input type="number" min={2} max={10} value={form.maxAttempts} onChange={e => setField("maxAttempts", Number(e.target.value))} className={builderInputClass + " mt-2"} />
              </label>}
            </div>
          </section>

          <div className="grid min-w-0 items-start gap-6 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside aria-label="Navegación de preguntas" className="min-w-0 md:sticky md:top-40">
              <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-base font-semibold">Preguntas</h2><span className="text-sm text-zinc-600 dark:text-zinc-400">{questions.length} en total</span></div>
              {questions.length > 0 && <>
                <label className="block text-sm font-medium md:hidden">Pregunta a editar
                  <select value={activeQuestion?.id ?? ""} onChange={e => { setQuery(""); setNavigationPage(Math.floor(questions.findIndex(q => q.id === e.target.value) / 10)); selectQuestion(e.target.value); }} className={builderInputClass + " mt-2"}>
                    {questions.map((q, index) => <option key={q.id} value={q.id}>{index + 1}. {q.type === "CODING" ? "Código" : "MCQ"} — {q.questionText.trim() || "Sin enunciado"}{validationAttempted && questionIssues(q, index + 1).length ? " — Revisar" : ""}</option>)}
                  </select>
                </label>
                <div className="hidden md:block">
                  <label className="relative mb-3 block"><span className="sr-only">Buscar pregunta</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                    <input type="search" value={query} onChange={e => { setQuery(e.target.value); setNavigationPage(0); }} placeholder="Buscar pregunta" className={builderInputClass + " pl-9 text-sm"} />
                  </label>
                  <nav aria-label="Lista de preguntas">
                    <ol className="space-y-1">{pageQuestions.map(q => {
                      const index = questions.indexOf(q);
                      const invalid = validationAttempted && questionIssues(q, index + 1).length > 0;
                      const selected = q.id === activeQuestion?.id;
                      return <li key={q.id}><button type="button" aria-current={selected ? "true" : undefined} onClick={() => selectQuestion(q.id)} title={q.questionText || "Sin enunciado"} className={"flex min-h-16 w-full min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-left focus-ring " + (selected ? "bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-100" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900")}>
                        <span className={"mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold " + (selected ? "bg-teal-700 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200")}>{index + 1}</span>
                        <span className="min-w-0 flex-1"><span className="mb-1 flex items-center justify-between gap-1 text-xs font-medium">{q.type === "CODING" ? "CODING" : "MCQ"}{invalid && <span className="flex items-center gap-1 text-red-800 dark:text-red-300"><AlertCircle className="h-3 w-3" />Revisar</span>}</span><span className="block truncate text-sm">{q.questionText.trim() || "Sin enunciado"}</span></span>
                      </button></li>;
                    })}</ol>
                  </nav>
                  {filteredQuestions.length === 0 && <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">No hay coincidencias.</p>}
                  {filteredQuestions.length > 10 && <div className="mt-3 flex items-center justify-between gap-2">
                    <button type="button" aria-label="Preguntas anteriores" disabled={page === 0} onClick={() => setNavigationPage(page - 1)} className={actionClass + " w-11 px-0"}><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{page * 10 + 1}–{Math.min((page + 1) * 10, filteredQuestions.length)} de {filteredQuestions.length}</span>
                    <button type="button" aria-label="Preguntas siguientes" disabled={(page + 1) * 10 >= filteredQuestions.length} onClick={() => setNavigationPage(page + 1)} className={actionClass + " w-11 px-0"}><ChevronRight className="h-4 w-4" /></button>
                  </div>}
                </div>
              </>}

              <div id="add-questions" tabIndex={-1} className="mt-5 space-y-2 border-t border-zinc-200 pt-4 focus:outline-none dark:border-zinc-800">
                <button type="button" aria-expanded={showAddActions} aria-controls="add-question-actions" onClick={() => setShowAddActions(value => !value)} className={actionClass + " w-full md:hidden"}><Plus className="h-4 w-4" />Añadir pregunta</button>
                <div id="add-question-actions" className={(showAddActions ? "" : "hidden ") + "space-y-2 md:block"}>
                {canAddMore ? <>
                  {form.type !== "CODING" && <button type="button" onClick={() => addQuestion("MULTIPLE_CHOICE")} className={actionClass + " w-full justify-start"}><Plus className="h-4 w-4" />Agregar opción múltiple</button>}
                  {form.type !== "MCQ" && <button type="button" onClick={() => addQuestion("CODING")} className={actionClass + " w-full justify-start"}><Plus className="h-4 w-4" />Agregar pregunta de código</button>}
                  <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:border [&>button]:border-solid [&>button]:border-teal-300 [&>button]:text-teal-900 dark:[&>button]:text-teal-200">
                    <AIQuestionGenerator key={form.type + "-" + form.language + "-" + form.difficulty} onAddQuestions={addQuestionsFromAI} currentLanguage={form.language} currentDifficulty={form.difficulty} currentType={form.type} />
                  </div>
                </> : <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">Límite de {MAX_QUESTIONS} preguntas alcanzado</p>}
                </div>
              </div>
            </aside>

            <section aria-label="Editor de pregunta" className="min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {activeQuestion ? <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800">
                  <div><h2 className="text-lg font-semibold">Pregunta {activeIndex + 1} <span className="ml-2 text-sm font-normal text-zinc-600 dark:text-zinc-400">de {questions.length}</span></h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{activeQuestion.type === "CODING" ? "Ejercicio de código" : "Opción múltiple"} · {activeQuestion.difficulty}</p></div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveQuestion(-1)} disabled={activeIndex === 0} aria-label="Subir pregunta" className={actionClass + " w-11 px-0"}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveQuestion(1)} disabled={activeIndex === questions.length - 1} aria-label="Bajar pregunta" className={actionClass + " w-11 px-0"}><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => removeQuestion(activeQuestion.id)} aria-label="Eliminar pregunta" className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-50 hover:text-red-700 focus-ring dark:text-zinc-300 dark:hover:bg-red-950 dark:hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="min-w-0 p-4 sm:p-6"><BuilderQuestionEditor key={activeQuestion.id} q={activeQuestion} issues={validationAttempted ? questionIssues(activeQuestion, activeIndex + 1) : []}
                  onUpdate={patch => updateQuestion(activeQuestion.id, patch)} onUpdateOption={(id, patch) => updateOption(activeQuestion.id, id, patch)}
                  onAddOption={() => addOption(activeQuestion.id)} onRemoveOption={id => removeOption(activeQuestion.id, id)} onSetCorrect={id => setCorrect(activeQuestion.id, id, activeQuestion.allowMultiple)}
                  onAddTestCase={() => addTestCase(activeQuestion.id)} onUpdateTestCase={(index, patch) => updateTestCase(activeQuestion.id, index, patch)} onRemoveTestCase={index => removeTestCase(activeQuestion.id, index)}
                /></div>
              </> : <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><Plus className="h-6 w-6" /></div>
                <h2 className="text-xl font-semibold">Tu evaluación empieza con una pregunta</h2>
                <p className="mt-3 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-400">Agrega una pregunta manualmente o genera un borrador con IA. Podrás revisarlo y editarlo antes de guardar.</p>
                <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">Sólo visible para tu empresa.</p>
              </div>}
            </section>
          </div>
        </fieldset>
      </div>

      {showPreview && <AssessmentPreviewModal form={form} questions={questions} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
