// app/assessments/[templateId]/AssessmentQuestion.tsx
'use client';

type Option = {
  id: string;
  text: string;
};

type Question = {
  id: string;
  section: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string;
  options: Option[];
  allowMultiple: boolean;
};

type Props = {
  question: Question;
  selectedOptions: string[];
  onAnswer: (options: string[]) => void;
};

export default function AssessmentQuestion({ question, selectedOptions, onAnswer }: Props) {
  const handleSelect = (optionId: string) => {
    if (question.allowMultiple) {
      // Checkbox: toggle
      if (selectedOptions.includes(optionId)) {
        onAnswer(selectedOptions.filter((id) => id !== optionId));
      } else {
        onAnswer([...selectedOptions, optionId]);
      }
    } else {
      // Radio: solo una
      onAnswer([optionId]);
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

        {/* Code snippet si existe */}
        {question.codeSnippet && (
          <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-950 text-zinc-100 text-sm overflow-x-auto mb-4">
            <code>{question.codeSnippet}</code>
          </pre>
        )}
      </div>

      {/* Opciones */}
      <div className="space-y-3">
        {question.options.map((option) => {
          const isSelected = selectedOptions.includes(option.id);

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={`
                w-full text-left p-4 rounded-xl border-2 transition-all
                ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                }
              `}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox/Radio */}
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
                        ${
                          isSelected
                            ? 'border-emerald-600'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="h-3 w-3 rounded-full bg-emerald-600" />
                      )}
                    </div>
                  )}
                </div>

                {/* Texto de opción */}
                <div className="flex-1">
                  <span className="font-semibold text-default mr-2">{option.id})</span>
                  <span className="text-default">{option.text}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ayuda */}
      {question.allowMultiple && (
        <p className="mt-4 text-sm text-muted">
          💡 Puedes seleccionar múltiples opciones
        </p>
      )}
    </div>
  );
}