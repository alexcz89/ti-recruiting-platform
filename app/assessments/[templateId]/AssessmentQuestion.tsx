// app/assessments/[templateId]/AssessmentQuestion.tsx
'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load CodeEditor para mejor performance
const CodeEditor = dynamic(() => import('@/components/assessments/CodeEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[700px] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 rounded-2xl border border-slate-800/50">
      <div className="text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 animate-ping">
            <Loader2 className="h-12 w-12 text-violet-500/30 mx-auto" />
          </div>
          <Loader2 className="relative h-12 w-12 animate-spin text-violet-500 mx-auto" />
        </div>
        <p className="text-sm font-medium text-slate-300">Cargando editor de código...</p>
        <p className="text-xs text-slate-500 mt-1">Preparando el entorno</p>
      </div>
    </div>
  ),
});

type Option = {
  id?: string;
  value?: string;
  text?: string;
};

type TestCase = {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
};

type Question = {
  id: string;
  section: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string;
  options: Option[];
  allowMultiple: boolean;
  // 🆕 Campos para CODING
  type?: 'MULTIPLE_CHOICE' | 'OPEN_ENDED' | 'CODING';
  language?: string;
  allowedLanguages?: string[];
  starterCode?: string;
  testCases?: TestCase[];
  points?: number;
};

type Props = {
  question: Question;
  selectedOptions: string[];
  onAnswer: (options: string[]) => void;
  disabled?: boolean;
  // 🆕 Props adicionales para CODING
  attemptId?: string;
  onCodeSubmit?: (code: string, language: string) => void;
};

function keyOfOption(o: any) {
  return String(o?.id ?? o?.value ?? JSON.stringify(o));
}

export default function AssessmentQuestion({
  question,
  selectedOptions,
  onAnswer,
  disabled = false,
  attemptId,
  onCodeSubmit,
}: Props) {
  // 🆕 Si es pregunta de CODING, renderizar CodeEditor
  if (question.type === 'CODING') {
    if (!attemptId) {
      return (
        <div className="p-6 md:p-8 rounded-2xl border border-red-500/30 bg-red-500/5">
          <p className="text-red-600 font-semibold">❌ Error: attemptId no disponible para pregunta de código</p>
          <p className="text-sm text-red-500 mt-2">Por favor, recarga la página o contacta soporte.</p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl overflow-hidden h-[700px]">
        <CodeEditor
          questionId={question.id}
          attemptId={attemptId}
          questionText={question.questionText}
          initialCode={question.starterCode || ''}
          language={question.language || 'javascript'}
          allowedLanguages={question.allowedLanguages || ['javascript']}
          testCases={question.testCases || []}
          points={question.points || 10}
          onSubmit={onCodeSubmit}
          readOnly={disabled}
        />
      </div>
    );
  }

  // Código existente para MULTIPLE_CHOICE
  const handleSelect = (optionKey: string) => {
    if (disabled) return;

    if (question.allowMultiple) {
      if (selectedOptions.includes(optionKey)) {
        onAnswer(selectedOptions.filter((k) => k !== optionKey));
      } else {
        onAnswer([...selectedOptions, optionKey]);
      }
    } else {
      onAnswer([optionKey]);
    }
  };

  return (
    <div className="p-6 md:p-8 rounded-2xl border glass-card">
      {/* Badge de sección */}
      <div className="flex items-center gap-2 mb-4">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {question.section}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {question.difficulty}
        </span>
      </div>

      {/* Pregunta */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-default mb-4 whitespace-pre-wrap">
          {question.questionText}
        </h2>

        {question.codeSnippet && (
          <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-950 text-zinc-100 text-sm overflow-x-auto mb-4">
            <code>{question.codeSnippet}</code>
          </pre>
        )}
      </div>

      {/* Opciones */}
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const optionKey = keyOfOption(option);
          const isSelected = selectedOptions.includes(optionKey);

          const label = option?.id ?? option?.value ?? String(idx + 1);
          const text = option?.text ?? String(optionKey);

          return (
            <button
              type="button"
              key={optionKey}
              onClick={() => handleSelect(optionKey)}
              disabled={disabled}
              className={`
                w-full text-left p-4 rounded-xl border-2 transition-all
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {question.allowMultiple ? (
                    <div
                      className={`
                        h-5 w-5 rounded border-2 flex items-center justify-center
                        ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }
                      `}
                    >
                      {isSelected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`
                        h-5 w-5 rounded-full border-2 flex items-center justify-center
                        ${isSelected ? 'border-emerald-600' : 'border-zinc-300 dark:border-zinc-600'}
                      `}
                    >
                      {isSelected && <div className="h-3 w-3 rounded-full bg-emerald-600" />}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <span className="font-semibold text-default mr-2">{label})</span>
                  <span className="text-default">{text}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {question.allowMultiple && (
        <p className="mt-4 text-sm text-muted">💡 Puedes seleccionar múltiples opciones</p>
      )}
    </div>
  );
}