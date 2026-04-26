"use client";

// components/dashboard/assessments/AssessmentPreviewModal.tsx
// Modal que simula la vista del candidato durante el assessment.
// Uso: <AssessmentPreviewModal form={form} questions={questions} onClose={() => setPreview(false)} />

import { useState, useEffect, useRef } from "react";
import {
  X, Clock, ChevronLeft, ChevronRight, Eye,
  Code2, CheckCircle2, AlertCircle, Monitor,
} from "lucide-react";

// ── Tipos (espejo de page.tsx) ──────────────────────────────────────────────

type Difficulty = "JUNIOR" | "MID" | "SENIOR";
type QuestionType = "MULTIPLE_CHOICE" | "CODING";
type MCQOption = { id: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  type: QuestionType;
  questionText: string;
  section: string;
  difficulty: Difficulty;
  explanation: string;
  options: MCQOption[];
  allowMultiple: boolean;
  codeSnippet: string;
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
};
type TemplateForm = {
  title: string;
  description: string;
  type: string;
  difficulty: Difficulty;
  language: string;
  passingScore: number;
  timeLimit: number;
  allowRetry: boolean;
  maxAttempts: number;
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  form: TemplateForm;
  questions: Question[];
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function AssessmentPreviewModal({ form, questions, onClose }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  // selectedAnswers: questionId → Set<optionId>
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Set<string>>>({});
  // codeAnswers: questionId → código escrito
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(form.timeLimit * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = questions.length;
  const current = questions[currentIdx];

  // Timer simulado
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!current) {
    return (
      <ModalShell onClose={onClose} form={form} timeLeft={timeLeft} currentIdx={0} total={0} setCurrentIdx={setCurrentIdx}>
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No hay preguntas para previsualizar.</p>
          <p className="text-xs mt-1 opacity-60">Agrega al menos una pregunta en el builder.</p>
        </div>
      </ModalShell>
    );
  }

  const isCoding = current.type === "CODING";
  const answered = selectedAnswers[current.id]?.size > 0 || (codeAnswers[current.id]?.trim().length ?? 0) > 0;
  const answeredCount = questions.filter(q =>
    q.type === "MULTIPLE_CHOICE"
      ? (selectedAnswers[q.id]?.size ?? 0) > 0
      : (codeAnswers[q.id]?.trim().length ?? 0) > 0
  ).length;

  function toggleOption(optId: string) {
    setSelectedAnswers(prev => {
      const set = new Set(prev[current.id] ?? []);
      if (current.allowMultiple) {
        set.has(optId) ? set.delete(optId) : set.add(optId);
      } else {
        set.clear();
        set.add(optId);
      }
      return { ...prev, [current.id]: set };
    });
  }

  const visibleTestCases = current.testCases.filter(tc => !tc.isHidden);
  const hiddenCount = current.testCases.filter(tc => tc.isHidden).length;

  return (
    <ModalShell
      onClose={onClose}
      form={form}
      timeLeft={timeLeft}
      currentIdx={currentIdx}
      total={total}
      setCurrentIdx={setCurrentIdx}
      answeredCount={answeredCount}
    >
      {/* ── Progress dots ── */}
      <div className="flex items-center gap-1.5 flex-wrap mb-6">
        {questions.map((q, i) => {
          const isAnswered = q.type === "MULTIPLE_CHOICE"
            ? (selectedAnswers[q.id]?.size ?? 0) > 0
            : (codeAnswers[q.id]?.trim().length ?? 0) > 0;
          const isCurrent = i === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              title={`Pregunta ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-200 ${
                isCurrent
                  ? "w-6 bg-violet-500"
                  : isAnswered
                  ? "w-2 bg-emerald-400"
                  : "w-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300"
              }`}
            />
          );
        })}
      </div>

      {/* ── Cabecera de pregunta ── */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`shrink-0 rounded-lg p-2 mt-0.5 ${
          isCoding
            ? "bg-violet-100 dark:bg-violet-900/40"
            : "bg-emerald-100 dark:bg-emerald-900/40"
        }`}>
          {isCoding
            ? <Code2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          }
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Pregunta {currentIdx + 1} de {total}
            </span>
            {current.section && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="text-[10px] text-zinc-400">{current.section}</span>
              </>
            )}
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              current.difficulty === "JUNIOR"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                : current.difficulty === "MID"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            }`}>
              {current.difficulty}
            </span>
          </div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
            {current.questionText || <span className="text-zinc-400 italic text-sm">Sin enunciado</span>}
          </p>
        </div>
      </div>

      {/* ── MCQ: Opciones ── */}
      {!isCoding && (
        <div className="space-y-2.5 mb-6">
          {current.allowMultiple && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Selecciona todas las respuestas correctas.
            </p>
          )}
          {current.options.map((opt, i) => {
            const isSelected = selectedAnswers[current.id]?.has(opt.id) ?? false;
            const label = String.fromCharCode(65 + i); // A, B, C, D...
            return (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
                  isSelected
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm shadow-violet-200 dark:shadow-violet-900/20"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                <span className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                  isSelected
                    ? "bg-violet-500 text-white"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}>
                  {label}
                </span>
                <span className={`text-sm ${
                  isSelected
                    ? "text-violet-900 dark:text-violet-100 font-medium"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}>
                  {opt.text || <span className="italic opacity-50">Opción sin texto</span>}
                </span>
                {isSelected && (
                  <span className="ml-auto shrink-0 text-violet-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── CODING: editor + test cases ── */}
      {isCoding && (
        <div className="space-y-4 mb-6">
          {/* Starter code / editor */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">
              Tu solución {form.language && <span className="normal-case text-zinc-400">({form.language})</span>}
            </label>
            <textarea
              value={codeAnswers[current.id] ?? (current.codeSnippet || "")}
              onChange={e => setCodeAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
              placeholder={`// Escribe tu solución aquí en ${form.language || "el lenguaje indicado"}...`}
              rows={10}
              spellCheck={false}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 text-green-400 font-mono px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y leading-relaxed"
            />
          </div>

          {/* Test cases visibles */}
          {visibleTestCases.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                Casos de prueba ({visibleTestCases.length} visibles{hiddenCount > 0 ? `, ${hiddenCount} ocultos` : ""})
              </p>
              <div className="space-y-2">
                {visibleTestCases.map((tc, i) => (
                  <div key={i} className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <p className="text-[9px] text-zinc-400 uppercase font-sans mb-1">Input</p>
                      <p className="text-zinc-700 dark:text-zinc-300 break-all">{tc.input || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-400 uppercase font-sans mb-1">Output esperado</p>
                      <p className="text-zinc-700 dark:text-zinc-300 break-all">{tc.expectedOutput || "—"}</p>
                    </div>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <p className="text-[10px] text-zinc-400 italic pl-1">
                    + {hiddenCount} caso{hiddenCount > 1 ? "s" : ""} oculto{hiddenCount > 1 ? "s" : ""} — solo el sistema los evalúa.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Navegación ── */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>

        <span className="text-xs text-zinc-400">
          {answeredCount}/{total} respondidas
        </span>

        {currentIdx < total - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => Math.min(total - 1, i + 1))}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition"
            onClick={() => alert("Vista previa — el candidato enviaría el examen aquí.")}
          >
            Enviar evaluación <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </ModalShell>
  );
}

// ── Shell del modal ──────────────────────────────────────────────────────────

function ModalShell({
  children, onClose, form, timeLeft, currentIdx, total, setCurrentIdx, answeredCount = 0,
}: {
  children: React.ReactNode;
  onClose: () => void;
  form: TemplateForm;
  timeLeft: number;
  currentIdx: number;
  total: number;
  setCurrentIdx: (n: number) => void;
  answeredCount?: number;
}) {
  const isWarning = timeLeft < 300; // últimos 5 min

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Contenedor principal */}
      <div className="relative w-full max-w-2xl my-auto">

        {/* Banner de aviso de preview */}
        <div className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 mb-2 text-sm font-semibold text-white shadow-lg">
          <Eye className="h-4 w-4 shrink-0" />
          Vista previa — así ve el candidato el examen
          <Monitor className="h-4 w-4 ml-1 opacity-70" />
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 hover:bg-amber-600 transition"
            title="Cerrar preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tarjeta principal */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">

          {/* Header — simula el header del assessment del candidato */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-xs font-black">
                T
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                  {form.title || "Sin título"}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {total} pregunta{total !== 1 ? "s" : ""} · Aprueba con {form.passingScore}%
                </p>
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums transition-colors ${
              isWarning
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}>
              <Clock className="h-3.5 w-3.5" />
              {fmtTime(timeLeft)}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6">
            {children}
          </div>
        </div>

        {/* Nota al pie */}
        <p className="text-center text-[11px] text-zinc-400 mt-3">
          Presiona <kbd className="rounded px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono text-[10px]">Esc</kbd> para cerrar · Las respuestas no se guardan en el preview
        </p>
      </div>
    </div>
  );
}