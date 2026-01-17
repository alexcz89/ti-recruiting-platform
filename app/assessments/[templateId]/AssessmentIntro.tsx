// app/assessments/[templateId]/AssessmentIntro.tsx
"use client";

import { Clock, FileText, Award, AlertCircle } from "lucide-react";

type Props = {
  template: any;
  onStart: () => void;
};

function formatMinutes(v: any) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null;
  if (n == null || n <= 0) return "—";
  return String(n);
}

function formatPercent(v: any) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null;
  if (n == null || n < 0) return "—";
  return `${n}%`;
}

export default function AssessmentIntro({ template, onStart }: Props) {
  const title = String(template?.title ?? "Evaluación");
  const description =
    typeof template?.description === "string" && template.description.trim()
      ? template.description
      : "Lee las instrucciones y cuando estés listo(a), comienza la evaluación.";

  const totalQuestions =
    typeof template?.totalQuestions === "number" && Number.isFinite(template.totalQuestions)
      ? template.totalQuestions
      : null;

  const sections = Array.isArray(template?.sections) ? (template.sections as any[]) : [];

  const allowRetry = Boolean(template?.allowRetry);
  const maxAttempts =
    typeof template?.maxAttempts === "number" && Number.isFinite(template.maxAttempts)
      ? template.maxAttempts
      : 1;

  const penalizeWrong = Boolean(template?.penalizeWrong);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-default mb-4">{title}</h1>
          <p className="text-lg text-muted">{description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-2xl border glass-card text-center">
            <FileText className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-default">{totalQuestions ?? "—"}</p>
            <p className="text-sm text-muted">Preguntas</p>
          </div>

          <div className="p-6 rounded-2xl border glass-card text-center">
            <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-default">{formatMinutes(template?.timeLimit)}</p>
            <p className="text-sm text-muted">Minutos</p>
          </div>

          <div className="p-6 rounded-2xl border glass-card text-center">
            <Award className="h-8 w-8 text-violet-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-default">
              {formatPercent(template?.passingScore)}
            </p>
            <p className="text-sm text-muted">Para aprobar</p>
          </div>
        </div>

        {/* Secciones */}
        <div className="mb-8 p-6 rounded-2xl border glass-card">
          <h2 className="text-lg font-semibold mb-4">📋 Secciones de la evaluación</h2>

          {sections.length === 0 ? (
            <p className="text-sm text-muted">Esta evaluación no tiene secciones configuradas.</p>
          ) : (
            <div className="space-y-3">
              {sections.map((section: any, idx: number) => {
                const name = String(section?.name ?? `Sección ${idx + 1}`);
                const questions =
                  typeof section?.questions === "number" && Number.isFinite(section.questions)
                    ? section.questions
                    : null;
                const weight =
                  typeof section?.weight === "number" && Number.isFinite(section.weight)
                    ? section.weight
                    : null;
                const timeLimit = formatMinutes(section?.timeLimit);

                return (
                  <div
                    key={`${name}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="font-medium text-default">{name}</p>
                      <p className="text-sm text-muted">
                        {questions ?? "—"} preguntas
                        {weight != null ? ` · ${weight}% del score` : ""}
                      </p>
                    </div>
                    <span className="text-sm text-muted">~{timeLimit} min</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Instrucciones */}
        <div className="mb-8 p-6 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Instrucciones importantes
              </h3>
              <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                <li>• Una vez iniciada, el tiempo corre automáticamente</li>
                <li>• Puedes navegar entre preguntas libremente</li>
                <li>• Tus respuestas se guardan automáticamente</li>
                <li>
                  •{" "}
                  {allowRetry ? `Puedes intentar hasta ${maxAttempts} veces` : "Solo tienes 1 intento"}
                </li>
                {penalizeWrong && <li>• Las respuestas incorrectas restan puntos (-0.25)</li>}
                <li>• No cambies de ventana durante la evaluación</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Botón de inicio */}
        <div className="text-center">
          <button onClick={onStart} className="btn btn-primary text-lg px-8 py-3">
            Comenzar evaluación →
          </button>
          <p className="mt-4 text-sm text-muted">Al hacer clic, el cronómetro comenzará inmediatamente</p>
        </div>
      </div>
    </main>
  );
}
