// app/assessments/[templateId]/AssessmentQuestion.tsx
'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Lazy load CodeEditor para mejor performance
const CodeEditor = dynamic(() => import('@/components/assessments/CodeEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[700px] items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-slate-800/50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-zinc-950">
      <div className="text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 animate-ping">
            <Loader2 className="mx-auto h-12 w-12 text-violet-500/30" />
          </div>
          <Loader2 className="relative mx-auto h-12 w-12 animate-spin text-violet-500" />
        </div>
        <p className="text-sm font-medium text-zinc-700 dark:text-slate-300">
          Cargando editor de código...
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
          Preparando el entorno
        </p>
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

type QuestionType = 'MULTIPLE_CHOICE' | 'OPEN_ENDED' | 'CODING';

type Question = {
  id: string;
  section: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string;
  options: Option[];
  allowMultiple: boolean;
  type?: QuestionType;
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
  attemptId?: string;
  onCodeSubmit?: (code: string, language: string) => void;
};

function keyOfOption(option: Option): string {
  return String(option.id ?? option.value ?? JSON.stringify(option));
}

function normalizeOptions(options?: Option[]): Option[] {
  return Array.isArray(options) ? options : [];
}

// Componente para renderizar markdown con estilos consistentes
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 text-xl font-bold text-zinc-900 dark:text-slate-100">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 text-lg font-bold text-zinc-900 dark:text-slate-100">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 text-base font-semibold text-zinc-900 dark:text-slate-100">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 leading-relaxed text-zinc-800 dark:text-slate-200">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-900 dark:text-slate-100">{children}</strong>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-lg bg-zinc-100 p-4 text-sm font-mono text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-mono text-violet-700 dark:bg-zinc-800 dark:text-violet-400">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5 text-zinc-800 dark:text-slate-200">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-zinc-800 dark:text-slate-200">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-4 border-violet-400 pl-4 italic text-zinc-600 dark:text-slate-400">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function AssessmentQuestion({
  question,
  selectedOptions,
  onAnswer,
  disabled = false,
  attemptId,
  onCodeSubmit,
}: Props) {
  const options = normalizeOptions(question.options);

  if (question.type === 'CODING') {
    if (!attemptId) {
      return (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-6 md:p-8 dark:border-red-500/30 dark:bg-red-500/5">
          <p className="font-semibold text-red-700 dark:text-red-400">
            Error: attemptId no disponible para pregunta de código
          </p>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">
            Recarga la página. Si el problema persiste, revisa la ruta o el parámetro del intento.
          </p>
        </div>
      );
    }

    return (
      <div className="h-[700px] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-slate-800/50 dark:bg-transparent">
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

  const handleSelect = (optionKey: string) => {
    if (disabled) return;

    if (question.allowMultiple) {
      if (selectedOptions.includes(optionKey)) {
        onAnswer(selectedOptions.filter((key) => key !== optionKey));
      } else {
        onAnswer([...selectedOptions, optionKey]);
      }
      return;
    }

    onAnswer([optionKey]);
  };

  return (
    <div className="glass-card rounded-2xl border p-6 md:p-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {question.section}
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {question.difficulty}
        </span>
      </div>

      {/* ✅ Markdown rendering para MCQ */}
      <div className="mb-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <MarkdownContent content={question.questionText} />
        </div>

        {question.codeSnippet && (
          <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-sm text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <code>{question.codeSnippet}</code>
          </pre>
        )}
      </div>

      <div className="space-y-3">
        {options.map((option, idx) => {
          const optionKey = keyOfOption(option);
          const isSelected = selectedOptions.includes(optionKey);
          const label = String.fromCharCode(65 + idx);
          const text = option.text ?? optionKey;

          return (
            <button
              type="button"
              key={optionKey}
              onClick={() => handleSelect(optionKey)}
              disabled={disabled}
              className={[
                'w-full rounded-xl border-2 p-4 text-left transition-all',
                disabled ? 'cursor-not-allowed opacity-60' : '',
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-zinc-200 hover:border-emerald-300 dark:border-zinc-800 dark:hover:border-emerald-700',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {question.allowMultiple ? (
                    <div
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded border-2',
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600'
                          : 'border-zinc-300 dark:border-zinc-600',
                      ].join(' ')}
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
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full border-2',
                        isSelected ? 'border-emerald-600' : 'border-zinc-300 dark:border-zinc-600',
                      ].join(' ')}
                    >
                      {isSelected && <div className="h-3 w-3 rounded-full bg-emerald-600" />}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <span className="text-default mr-2 font-semibold">{label})</span>
                  <span className="text-default">{text}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {question.allowMultiple && (
        <p className="text-muted mt-4 text-sm">Puedes seleccionar múltiples opciones.</p>
      )}
    </div>
  );
}