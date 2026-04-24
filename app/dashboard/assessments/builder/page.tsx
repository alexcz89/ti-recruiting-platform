"use client";

// app/dashboard/assessments/builder/page.tsx
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Save,
  Code2, CheckCircle2, GripVertical, AlertCircle,
  Clock, BarChart3, BookOpen, ArrowLeft,
} from "lucide-react";

const MAX_QUESTIONS = 20;
const DIFFICULTIES = ["JUNIOR", "MID", "SENIOR"] as const;
const LANGUAGES = [
  { value: "", label: "Sin lenguaje (genérico)" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
];

type QuestionType = "MULTIPLE_CHOICE" | "CODING";
type Difficulty = "JUNIOR" | "MID" | "SENIOR";

type MCQOption = { id: string; text: string; isCorrect: boolean };

type Question = {
  id: string;
  type: QuestionType;
  questionText: string;
  section: string;
  difficulty: Difficulty;
  explanation: string;
  // MCQ
  options: MCQOption[];
  allowMultiple: boolean;
  // CODING
  codeSnippet: string; // starter code
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
};

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
    testCases: [{ input: "", expectedOutput: "", isHidden: false }],
  };
}

export default function AssessmentBuilderPage() {
  const router = useRouter();

  const [form, setForm] = useState<TemplateForm>({
    title: "", description: "",
    type: "MCQ", difficulty: "JUNIOR",
    language: "", passingScore: 70, timeLimit: 30,
    allowRetry: false,
    maxAttempts: 1,
  });

  const [questions, setQuestions] = useState<Question[]>([emptyMCQ()]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    questions[0]?.id ? { [questions[0].id]: true } : {}
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // ── form helpers ──
  const setField = (k: keyof TemplateForm, v: any) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleExpanded = (id: string) =>
    setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── question helpers ──
  const addQuestion = (type: QuestionType) => {
    if (questions.length >= MAX_QUESTIONS) return;
    const q = type === "MULTIPLE_CHOICE" ? emptyMCQ() : emptyCoding();
    setQuestions(qs => [...qs, q]);
    setExpanded(e => ({ ...e, [q.id]: true }));
  };

  const removeQuestion = (id: string) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
    setExpanded(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const updateQuestion = useCallback((id: string, patch: Partial<Question>) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q));
  }, []);

  // MCQ option helpers
  const updateOption = (qid: string, oid: string, patch: Partial<MCQOption>) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q;
      return { ...q, options: q.options.map(o => o.id === oid ? { ...o, ...patch } : o) };
    }));
  };

  const addOption = (qid: string) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.options.length >= 6) return q;
      return { ...q, options: [...q.options, { id: uid(), text: "", isCorrect: false }] };
    }));
  };

  const removeOption = (qid: string, oid: string) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.options.length <= 2) return q;
      return { ...q, options: q.options.filter(o => o.id !== oid) };
    }));
  };

  const setCorrect = (qid: string, oid: string, multi: boolean) => {
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
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.testCases.length >= 10) return q;
      return { ...q, testCases: [...q.testCases, { input: "", expectedOutput: "", isHidden: false }] };
    }));
  };

  const updateTestCase = (qid: string, idx: number, patch: Partial<{ input: string; expectedOutput: string; isHidden: boolean }>) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q;
      const tc = [...q.testCases];
      tc[idx] = { ...tc[idx], ...patch };
      return { ...q, testCases: tc };
    }));
  };

  const removeTestCase = (qid: string, idx: number) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid || q.testCases.length <= 1) return q;
      return { ...q, testCases: q.testCases.filter((_, i) => i !== idx) };
    }));
  };

  // ── validación ──
  function validate(): string[] {
    const errs: string[] = [];
    if (!form.title.trim()) errs.push("El título es requerido");
    if (form.passingScore < 1 || form.passingScore > 100) errs.push("El puntaje mínimo debe ser entre 1 y 100");
    if (form.timeLimit < 5 || form.timeLimit > 180) errs.push("El tiempo debe ser entre 5 y 180 minutos");
    if (!questions.length) errs.push("Agrega al menos una pregunta");

    questions.forEach((q, i) => {
      const n = i + 1;
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
    });
    return errs;
  }

  // ── submit ──
  async function handleSave() {
    const errs = validate();
    setErrors(errs);
    if (errs.length) return;

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/assessments/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, questions }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors([data.error || "Error al guardar"]); return; }
      router.push("/dashboard/assessments/templates?scope=custom");
    } catch {
      setErrors(["Error de conexión"]);
    } finally {
      setSaving(false);
    }
  }

  const canAddMore = questions.length < MAX_QUESTIONS;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex-1" />
          <span className="text-xs text-zinc-400">{questions.length}/{MAX_QUESTIONS} preguntas</span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Crear template de evaluación</h1>
          <p className="text-sm text-zinc-500 mt-1">Solo visible para tu empresa.</p>
        </div>

        {/* ── Errores ── */}
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-bold text-red-700 dark:text-red-300">Corrige los siguientes errores:</span>
            </div>
            <ul className="space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">• {e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Configuración general ── */}
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Configuración general</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Título */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Título *</label>
              <input
                value={form.title}
                onChange={e => setField("title", e.target.value)}
                placeholder="Ej: React Senior — Evaluación técnica"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Descripción */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setField("description", e.target.value)}
                placeholder="Describe qué evalúa este template..."
                rows={2}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Tipo *</label>
              <select
                value={form.type}
                onChange={e => setField("type", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="MCQ">Opción múltiple</option>
                <option value="CODING">Código</option>
                <option value="MIXED">Mixto (MCQ + Código)</option>
              </select>
            </div>

            {/* Dificultad */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nivel *</label>
              <select
                value={form.difficulty}
                onChange={e => setField("difficulty", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d === "JUNIOR" ? "Junior" : d === "MID" ? "Mid Level" : "Senior"}</option>)}
              </select>
            </div>

            {/* Lenguaje */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Lenguaje</label>
              <select
                value={form.language}
                onChange={e => setField("language", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {/* Puntaje mínimo */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                <BarChart3 className="inline h-3.5 w-3.5 mr-1" />
                Puntaje mínimo para aprobar *
              </label>
              <div className="relative">
                <input
                  type="number" min={1} max={100}
                  value={form.passingScore}
                  onChange={e => setField("passingScore", Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
              </div>
            </div>

            {/* Tiempo */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                <Clock className="inline h-3.5 w-3.5 mr-1" />
                Tiempo límite *
              </label>
              <div className="relative">
                <input
                  type="number" min={5} max={180}
                  value={form.timeLimit}
                  onChange={e => setField("timeLimit", Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 pr-12 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">min</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Entre 5 y 180 minutos</p>
            </div>

            {/* Re-intentos toggle */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Permitir re-intentos</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">El candidato puede volver a tomar la evaluación si no aprueba</p>
                </div>
                <button
                  type="button"
                  onClick={() => setField("allowRetry", !form.allowRetry)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    form.allowRetry ? "bg-violet-600" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    form.allowRetry ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </div>

            {/* Max intentos — solo si allowRetry está activo */}
            {form.allowRetry && (
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Número máximo de intentos
                </label>
                <input
                  type="number" min={2} max={10}
                  value={form.maxAttempts}
                  onChange={e => setField("maxAttempts", Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Entre 2 y 10 intentos</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Preguntas ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Preguntas ({questions.length}/{MAX_QUESTIONS})
            </h2>
          </div>

          {questions.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-8 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No hay preguntas. Agrega una manualmente o usa el generador AI.
              </p>
            </div>
          )}

          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              q={q}
              idx={idx}
              expanded={!!expanded[q.id]}
              onToggle={() => toggleExpanded(q.id)}
              onRemove={() => removeQuestion(q.id)}
              onUpdate={(patch) => updateQuestion(q.id, patch)}
              onUpdateOption={(oid, patch) => updateOption(q.id, oid, patch)}
              onAddOption={() => addOption(q.id)}
              onRemoveOption={(oid) => removeOption(q.id, oid)}
              onSetCorrect={(oid) => setCorrect(q.id, oid, q.allowMultiple)}
              onAddTestCase={() => addTestCase(q.id)}
              onUpdateTestCase={(i, patch) => updateTestCase(q.id, i, patch)}
              onRemoveTestCase={(i) => removeTestCase(q.id, i)}
            />
          ))}

          {/* Botones agregar pregunta */}
          {canAddMore && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => addQuestion("MULTIPLE_CHOICE")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Agregar opción múltiple
              </button>
              <button
                onClick={() => addQuestion("CODING")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 px-4 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <Code2 className="h-4 w-4 shrink-0" />
                Agregar pregunta de código
              </button>
            </div>
          )}
          {!canAddMore && (
            <p className="text-xs text-zinc-400 text-center py-2">
              Límite de {MAX_QUESTIONS} preguntas alcanzado
            </p>
          )}
        </div>

        {/* ── Guardar ── */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuestionCard ──
type QCardProps = {
  q: Question; idx: number; expanded: boolean;
  onToggle: () => void; onRemove: () => void;
  onUpdate: (p: Partial<Question>) => void;
  onUpdateOption: (oid: string, p: Partial<MCQOption>) => void;
  onAddOption: () => void; onRemoveOption: (oid: string) => void;
  onSetCorrect: (oid: string) => void;
  onAddTestCase: () => void;
  onUpdateTestCase: (i: number, p: any) => void;
  onRemoveTestCase: (i: number) => void;
};

function QuestionCard({ q, idx, expanded, onToggle, onRemove, onUpdate, onUpdateOption, onAddOption, onRemoveOption, onSetCorrect, onAddTestCase, onUpdateTestCase, onRemoveTestCase }: QCardProps) {
  const isCoding = q.type === "CODING";

  return (
    <div className={`rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden transition-all
      ${isCoding ? "border-violet-200 dark:border-violet-800/40" : "border-zinc-200 dark:border-zinc-800"}`}
    >
      {/* Header de la pregunta */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-zinc-300 dark:text-zinc-600 shrink-0" />

        <div className={`shrink-0 rounded-lg p-1.5
          ${isCoding ? "bg-violet-100 dark:bg-violet-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"}`}
        >
          {isCoding
            ? <Code2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          }
        </div>

        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0">#{idx + 1}</span>

        <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">
          {q.questionText.trim() || <span className="text-zinc-400 italic">Sin enunciado</span>}
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </div>
      </div>

      {/* Body expandido */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-zinc-100 dark:border-zinc-800">

          {/* Metadatos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1">Sección</label>
              <input
                value={q.section}
                onChange={e => onUpdate({ section: e.target.value })}
                placeholder="General"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1">Nivel</label>
              <select
                value={q.difficulty}
                onChange={e => onUpdate({ difficulty: e.target.value as Difficulty })}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Enunciado */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1">Enunciado *</label>
            <textarea
              value={q.questionText}
              onChange={e => onUpdate({ questionText: e.target.value })}
              placeholder="Escribe la pregunta o el problema a resolver..."
              rows={3}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          {/* ── MCQ: Opciones ── */}
          {!isCoding && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase">Opciones *</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.allowMultiple}
                      onChange={e => onUpdate({ allowMultiple: e.target.checked })}
                      className="rounded"
                    />
                    Múltiple respuesta
                  </label>
                  {q.options.length < 6 && (
                    <button onClick={onAddOption} className="text-xs text-violet-600 hover:underline">+ Opción</button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {q.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onSetCorrect(opt.id)}
                      title={opt.isCorrect ? "Respuesta correcta" : "Marcar como correcta"}
                      className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition
                        ${opt.isCorrect
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-zinc-300 dark:border-zinc-600 hover:border-emerald-400"
                        }`}
                    >
                      {opt.isCorrect && <span className="text-white text-[10px] font-black">✓</span>}
                    </button>
                    <input
                      value={opt.text}
                      onChange={e => onUpdateOption(opt.id, { text: e.target.value })}
                      placeholder={`Opción ${q.options.indexOf(opt) + 1}`}
                      className={`flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:bg-zinc-800 dark:text-zinc-100
                        ${opt.isCorrect
                          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                        }`}
                    />
                    {q.options.length > 2 && (
                      <button onClick={() => onRemoveOption(opt.id)} className="shrink-0 text-zinc-300 hover:text-red-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CODING: Starter code + Test cases ── */}
          {isCoding && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1">Código base (opcional)</label>
                <textarea
                  value={q.codeSnippet}
                  onChange={e => onUpdate({ codeSnippet: e.target.value })}
                  placeholder="function solution(input) {\n  // código aquí\n}"
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-950 text-green-400 font-mono px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase">Casos de prueba *</label>
                  {q.testCases.length < 10 && (
                    <button onClick={onAddTestCase} className="text-xs text-violet-600 hover:underline">+ Caso</button>
                  )}
                </div>
                <div className="space-y-3">
                  {q.testCases.map((tc, i) => (
                    <div key={i} className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Caso {i + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tc.isHidden}
                              onChange={e => onUpdateTestCase(i, { isHidden: e.target.checked })}
                              className="rounded"
                            />
                            Oculto
                          </label>
                          {q.testCases.length > 1 && (
                            <button onClick={() => onRemoveTestCase(i)} className="text-zinc-300 hover:text-red-400 transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] text-zinc-400 mb-1">Input</p>
                          <input
                            value={tc.input}
                            onChange={e => onUpdateTestCase(i, { input: e.target.value })}
                            placeholder="Ej: [1, 2, 3]"
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 mb-1">Output esperado</p>
                          <input
                            value={tc.expectedOutput}
                            onChange={e => onUpdateTestCase(i, { expectedOutput: e.target.value })}
                            placeholder="Ej: 6"
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Explicación */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1">Explicación (visible después)</label>
            <textarea
              value={q.explanation}
              onChange={e => onUpdate({ explanation: e.target.value })}
              placeholder="Explica la respuesta correcta..."
              rows={2}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}