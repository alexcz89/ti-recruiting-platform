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
      <div className="mx-auto max-w-[760px] px-4 py-6 md:px-8 md:py-8">

        {/* Title + CTA in a compact top row on desktop */}
        <div className="mb-5 flex flex-col items-center gap-3 text-center md:flex-row md:items-start md:justify-between md:text-left">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-default md:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-muted md:text-base">{description}</p>
          </div>
          <div className="flex flex-col items-center gap-1 md:items-end">
            <button onClick={onStart} className="btn btn-primary px-7 py-3 text-base md:text-lg whitespace-nowrap">
              Comenzar evaluación →
            </button>
            <p className="text-xs text-muted">El cronómetro inicia al hacer clic</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-4 rounded-xl border glass-card text-center">
            <FileText className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-default">{totalQuestions ?? "—"}</p>
            <p className="text-xs text-muted">Preguntas</p>
          </div>
          <div className="p-4 rounded-xl border glass-card text-center">
            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-default">{formatMinutes(template?.timeLimit)}</p>
            <p className="text-xs text-muted">Minutos</p>
          </div>
          <div className="p-4 rounded-xl border glass-card text-center">
            <Award className="h-6 w-6 text-teal-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-default">{formatPercent(template?.passingScore)}</p>
            <p className="text-xs text-muted">Para aprobar</p>
          </div>
        </div>

        {/* Secciones (collapsed if empty) */}
        {sections.length > 0 && (
          <div className="mb-5 p-4 rounded-xl border glass-card">
            <h2 className="text-sm font-semibold mb-3">📋 Secciones</h2>
            <div className="space-y-2">
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
                    className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-default">{name}</p>
                      <p className="text-xs text-muted">
                        {questions ?? "—"} preguntas{weight != null ? ` · ${weight}%` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted">~{timeLimit} min</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instrucciones compactas */}
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1.5">
                Instrucciones
              </h3>
              <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
                <li>• El tiempo corre automáticamente al iniciar</li>
                <li>• Puedes navegar entre preguntas libremente</li>
                <li>• Tus respuestas se guardan automáticamente</li>
                <li>• {allowRetry ? `Puedes intentar hasta ${maxAttempts} veces` : "Solo tienes 1 intento"}</li>
                {penalizeWrong && <li>• Las respuestas incorrectas restan puntos (-0.25)</li>}
                <li>• No cambies de ventana durante la evaluación</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Aviso anti-AI / integridad ──────────────────────────────────── */}
        <div className="mt-4 p-4 rounded-xl border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-2.5">
            <span className="text-lg shrink-0 mt-0.5">🛡️</span>
            <div>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1.5">
                Evaluación con monitoreo de integridad
              </h3>
              <ul className="space-y-1 text-xs text-red-800 dark:text-red-300">
                <li>• <strong>Se registra cada cambio de pestaña</strong> o pérdida de foco de la ventana</li>
                <li>• Se detectan intentos de copiar y pegar texto</li>
                <li>• El tiempo por pregunta queda registrado</li>
                <li>• El reclutador recibe un reporte completo de actividad sospechosa</li>
                <li>• <strong>El uso de IA, buscadores u otras herramientas externas está prohibido</strong> y puede resultar en descalificación</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Mobile CTA (visible only on mobile since top one is hidden there) */}
        <div className="mt-5 text-center md:hidden">
          <button onClick={onStart} className="btn btn-primary w-full py-3 text-base">
            Comenzar evaluación →
          </button>
          <p className="mt-2 text-xs text-muted">El cronómetro inicia al hacer clic</p>
        </div>
      </div>
    </main>
  );
}
