"use client";

import { Plus, Trash2, ChevronDown } from "lucide-react";
import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

export type BuilderOption = { id: string; text: string; isCorrect: boolean };
export type BuilderTestCase = { input: string; expectedOutput: string; isHidden: boolean };
export type BuilderQuestion = {
  id: string;
  type: "MULTIPLE_CHOICE" | "CODING";
  questionText: string;
  section: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  explanation: string;
  options: BuilderOption[];
  allowMultiple: boolean;
  codeSnippet: string;
  language?: string;
  allowedLanguages?: string[];
  testCases: BuilderTestCase[];
};

export const builderInputClass = "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:disabled:bg-zinc-800";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-ring disabled:opacity-40 dark:text-teal-300 dark:hover:bg-teal-950";
const deleteButton = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-50 hover:text-red-700 focus-ring dark:text-zinc-300 dark:hover:bg-red-950 dark:hover:text-red-300";

type Props = {
  q: BuilderQuestion;
  issues: string[];
  onUpdate: (patch: Partial<BuilderQuestion>) => void;
  onUpdateOption: (id: string, patch: Partial<BuilderOption>) => void;
  onAddOption: () => void;
  onRemoveOption: (id: string) => void;
  onSetCorrect: (id: string) => void;
  onAddTestCase: () => void;
  onUpdateTestCase: (index: number, patch: Partial<BuilderTestCase>) => void;
  onRemoveTestCase: (index: number) => void;
};

function GrowingTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    let width = element.clientWidth;
    const resize = () => {
      if (!active) return;
      element.style.height = "auto";
      element.style.height = element.scrollHeight + 2 + "px";
    };
    resize();
    void document.fonts?.ready.then(resize);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; resize(); }
    });
    observer?.observe(element);
    return () => { active = false; observer?.disconnect(); };
  }, [props.value, props.rows]);
  return <textarea {...props} ref={ref} style={{ ...props.style, overflowY: "hidden" }} />;
}

export default function BuilderQuestionEditor({ q, issues, onUpdate, onUpdateOption, onAddOption, onRemoveOption, onSetCorrect, onAddTestCase, onUpdateTestCase, onRemoveTestCase }: Props) {
  const isCoding = q.type === "CODING";
  return (
    <div className="space-y-8">
      {issues.length > 0 && (
        <ul id="question-errors" className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {issues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      <div>
        <label htmlFor="question-statement" className="mb-2 block text-sm font-semibold">Enunciado *</label>
        <GrowingTextarea id="question-statement" value={q.questionText} onChange={e => onUpdate({ questionText: e.target.value })}
          placeholder="Escribe la pregunta o el problema a resolver..." rows={5}
          aria-invalid={issues.length > 0 && !q.questionText.trim()}
          aria-describedby={issues.length ? "question-errors" : undefined}
          className={builderInputClass + " min-h-36 resize-y scroll-mt-56 leading-relaxed"} />
      </div>

      {!isCoding && (
        <fieldset>
          <legend className="text-base font-semibold">Opciones de respuesta</legend>
          <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={q.allowMultiple} onChange={e => {
                if (!e.target.checked && q.options.filter(option => option.isCorrect).length > 1) {
                  if (!window.confirm("Al cambiar a respuesta única se conservará sólo la primera respuesta correcta. ¿Quieres continuar?")) return;
                  const first = q.options.find(option => option.isCorrect)?.id;
                  onUpdate({ allowMultiple: false, options: q.options.map(option => ({ ...option, isCorrect: option.id === first })) });
                } else onUpdate({ allowMultiple: e.target.checked });
              }} className="h-4 w-4 accent-teal-700" />
              Múltiple respuesta
            </label>
            {q.options.length < 6 && <button type="button" onClick={onAddOption} className={secondaryButton}><Plus className="h-4 w-4" />Opción</button>}
          </div>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{q.allowMultiple ? "Marca todas las respuestas correctas." : "Marca una respuesta correcta."}</p>
          <div className="space-y-2" role={q.allowMultiple ? "group" : "radiogroup"} aria-label="Respuestas correctas">
            {q.options.map((option, index) => (
              <div key={option.id} className={"flex min-w-0 items-start gap-2 rounded-lg p-1 " + (option.isCorrect ? "bg-teal-50 dark:bg-teal-950" : "")}>
                <label className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center" title={option.isCorrect ? "Respuesta correcta" : "Marcar como correcta"}>
                  <input type={q.allowMultiple ? "checkbox" : "radio"} name={"correct-" + q.id} checked={option.isCorrect} onChange={() => onSetCorrect(option.id)}
                    aria-label={"Opción " + (index + 1) + (option.isCorrect ? ": correcta" : ": marcar como correcta")} className="peer sr-only" />
                  <span className={"flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-600 " + (option.isCorrect ? "border-teal-700 bg-teal-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800")}>{String.fromCharCode(65 + index)}</span>
                </label>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Opción {index + 1}</span>
                  <GrowingTextarea value={option.text} onChange={e => onUpdateOption(option.id, { text: e.target.value })} placeholder={"Opción " + (index + 1)} rows={2} className={builderInputClass + " resize-y"} />
                </label>
                {q.options.length > 2 && <button type="button" onClick={() => onRemoveOption(option.id)} aria-label={"Eliminar opción " + (index + 1)} className={deleteButton}><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {isCoding && <>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="question-code" className="text-base font-semibold">Código inicial <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">(opcional)</span></label>
            {q.language && <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{q.language}</span>}
          </div>
          <p id="code-help" className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Se precarga en el editor del candidato. Deja la lógica por implementar.</p>
          <textarea id="question-code" value={q.codeSnippet} onChange={e => onUpdate({ codeSnippet: e.target.value })}
            placeholder="// Código base que verá el candidato (opcional)" aria-describedby="code-help" spellCheck={false} autoCapitalize="off" autoCorrect="off"
            rows={16} wrap="off" className="w-full min-w-0 min-h-[22rem] resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-4 font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 [tab-size:4]" />
        </div>
        <section aria-labelledby="test-cases-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="test-cases-heading" className="text-base font-semibold">Casos de prueba</h3>
            {q.testCases.length < 10 && <button type="button" onClick={onAddTestCase} className={secondaryButton}><Plus className="h-4 w-4" />Caso</button>}
          </div>
          <p className="mb-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Conserva los saltos de línea y los valores exactos. Los casos ocultos se usan para evaluar, pero no se muestran al candidato.</p>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {q.testCases.map((testCase, index) => (
              <fieldset key={index} className="min-w-0 py-4">
                <legend className="sr-only">Caso {index + 1}</legend>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Caso {index + 1} <span className="ml-2 font-normal text-zinc-600 dark:text-zinc-400">{testCase.isHidden ? "Oculto" : "Público"}</span></span>
                  <div className="flex items-center gap-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={testCase.isHidden} onChange={e => onUpdateTestCase(index, { isHidden: e.target.checked })} aria-label={"Caso " + (index + 1) + ": oculto"} className="h-4 w-4 accent-teal-700" />Oculto
                    </label>
                    {q.testCases.length > 1 && <button type="button" onClick={() => onRemoveTestCase(index)} aria-label={"Eliminar caso " + (index + 1)} className={deleteButton}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-sm"><span className="mb-2 block font-medium">Input <span className="sr-only">del caso {index + 1}</span></span>
                    <GrowingTextarea value={testCase.input} onChange={e => onUpdateTestCase(index, { input: e.target.value })} placeholder="Entrada exacta" rows={3} spellCheck={false} className={builderInputClass + " resize-y font-mono text-sm"} />
                  </label>
                  <label className="min-w-0 text-sm"><span className="mb-2 block font-medium">Output esperado <span className="sr-only">del caso {index + 1}</span></span>
                    <GrowingTextarea value={testCase.expectedOutput} onChange={e => onUpdateTestCase(index, { expectedOutput: e.target.value })} placeholder="Salida exacta" rows={3} spellCheck={false} className={builderInputClass + " resize-y font-mono text-sm"} />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      </>}

      <details className="group border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-semibold focus-ring [&::-webkit-details-marker]:hidden">
          Sección y explicación<ChevronDown className="h-4 w-4 group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium">Sección
            <input value={q.section} onChange={e => onUpdate({ section: e.target.value })} placeholder="General" className={builderInputClass + " mt-2"} />
          </label>
          <label className="block text-sm font-medium">Explicación
            <GrowingTextarea value={q.explanation} onChange={e => onUpdate({ explanation: e.target.value })} placeholder="Explica la respuesta correcta..." rows={4} className={builderInputClass + " mt-2 resize-y"} />
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Material de revisión del reclutador. No incluyas soluciones en el enunciado ni en el código inicial.</p>
        </div>
      </details>
    </div>
  );
}
