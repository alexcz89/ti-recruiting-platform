// app/assessments/[templateId]/AssessmentIntro.tsx
"use client";

import React from "react";
import { Clock, FileText, Award, ShieldCheck, BookOpen } from "lucide-react";
import type { AssessmentState } from "@/lib/assessments/expiration";

type Props = {
  template: any;
  onStart: () => void;
  accessState?: AssessmentState | null;
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

/**
 * Older templates use { name }, while NFQ imports use { title }.
 * Only surface actual subject names: never invent section labels, counts or times.
 */
function assessmentTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const topics: string[] = [];

  for (const section of raw) {
    const candidates = typeof section === "string"
      ? [section]
      : section && typeof section === "object"
        ? [
            (section as Record<string, unknown>).title,
            (section as Record<string, unknown>).name,
          ]
        : [];

    const topic = candidates.find(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )?.trim();

    if (!topic || /^(?:secci[oó]n|section)\s*\d+$/i.test(topic) || /^general$/i.test(topic)) continue;

    const key = topic.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(topic);
  }

  return topics;
}

export default function AssessmentIntro({ template, onStart, accessState }: Props) {
  const title = String(template?.title ?? "Evaluación");
  const description =
    typeof template?.description === "string" && template.description.trim()
      ? template.description
      : "Lee las instrucciones y cuando estés listo(a), comienza la evaluación.";

  const totalQuestions =
    typeof template?.totalQuestions === "number" && Number.isFinite(template.totalQuestions)
      ? template.totalQuestions
      : null;

  const topics = assessmentTopics(template?.sections);

  const allowRetry = Boolean(template?.allowRetry);
  const maxAttempts =
    typeof template?.maxAttempts === "number" && Number.isFinite(template.maxAttempts)
      ? template.maxAttempts
      : 1;

  const penalizeWrong = Boolean(template?.penalizeWrong);
  const isUnavailable = accessState === "EXPIRED" || accessState === "CANCELLED";
  const actionLabel = accessState === "IN_PROGRESS"
    ? "Continuar evaluación"
    : "Comenzar evaluación";

return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-4">
      <header className="mb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Antes de comenzar</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p>
      </header>
      <dl className="mb-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {[
          { label: "Preguntas", value: totalQuestions ?? "—", Icon: FileText },
          { label: "Minutos", value: formatMinutes(template?.timeLimit), Icon: Clock },
          { label: "Para aprobar", value: formatPercent(template?.passingScore), Icon: Award },
        ].map(({ label, value, Icon }) => <div key={label} className="flex flex-col items-center p-3 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
          <Icon className="mb-1 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300 sm:mb-0" aria-hidden="true" />
          <div><dt className="text-xs text-zinc-600 dark:text-zinc-300">{label}</dt><dd className="mt-1 text-xl font-semibold sm:text-2xl">{value}</dd></div>
        </div>)}
      </dl>
      {topics.length > 0 && <section className="mb-4" aria-label="Temas que se evaluarán">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4" aria-hidden="true" />Temas que se evaluarán</h2>
        <ul className="flex flex-wrap gap-2">{topics.map(topic => <li key={topic.toLocaleLowerCase()} className="max-w-full break-words rounded-lg bg-zinc-100 px-3 py-1.5 text-sm dark:bg-zinc-800">{topic}</li>)}</ul>
      </section>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="assessment-instructions" className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 id="assessment-instructions" className="mb-3 text-base font-semibold">Instrucciones</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <li>El tiempo corre automáticamente al iniciar. Puedes navegar entre preguntas libremente.</li>
            <li>Tus respuestas se guardan automáticamente.</li>
            <li>{allowRetry ? `Puedes intentar hasta ${maxAttempts} veces.` : "Solo tienes 1 intento."}</li>
            {penalizeWrong && <li>Las respuestas incorrectas restan puntos (-0.25).</li>}
          </ul>
        </section>
        <section aria-labelledby="assessment-integrity" className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 id="assessment-integrity" className="mb-3 flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />Evaluación con monitoreo de integridad</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <li>Se registran los cambios de pestaña y las pérdidas de foco de la ventana.</li>
            <li>Se detectan intentos de copiar y pegar texto, y se registra el tiempo por pregunta.</li>
            <li>El reclutador recibe un reporte de estas señales de actividad.</li>
            <li>El uso de IA, buscadores u otras herramientas externas está prohibido y puede resultar en descalificación.</li>
          </ul>
        </section>
      </div>
      <div className="mt-5">
        {isUnavailable ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900" role="status">
          <p className="font-semibold">{accessState === "CANCELLED" ? "Invitación cancelada" : "Invitación expirada"}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Si aún deseas completarla, pide al reclutador que te envíe un nuevo link.</p>
        </div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{accessState === "IN_PROGRESS" ? "El tiempo disponible de tu intento se mantiene al continuar." : "El cronómetro inicia únicamente cuando presionas Comenzar evaluación."}</p>
          <button type="button" onClick={onStart} className="btn btn-primary bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-800 min-h-11 w-full px-6 py-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:focus-visible:outline-teal-300 sm:w-auto">{actionLabel}</button>
        </div>}
      </div>
    </main>
  );
}
