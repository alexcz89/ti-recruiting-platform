// app/assessments/attempts/[attemptId]/results/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Award,
  Info,
  Linkedin,
  ExternalLink,
  CalendarClock,
  ShieldAlert,
} from 'lucide-react';

export default function AssessmentResultsPage() {
  const params = useParams();
  const attemptId = params.attemptId as string;
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const dashboardHref = role === 'CANDIDATE' ? '/profile/summary' : '/dashboard/overview';
  const dashboardLabel = role === 'CANDIDATE' ? 'Ver mis postulaciones' : 'Volver al dashboard';

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    async function loadResults() {
      try {
        const res = await fetch(`/api/assessments/attempts/${attemptId}/results`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Error al cargar resultados');
        const data = await res.json();
        setResult(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [attemptId]);

  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  useEffect(() => {
    if (!result?.attempt?.applicationId) return;
    fetch(`/api/candidate/assessment-invites?applicationId=${result.attempt.applicationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data?.invites)) {
          // Solo los pendientes (no el actual)
          const pending = data.invites.filter(
            (inv: any) => inv.templateId !== result?.template?.id && inv.status === 'SENT'
          );
          setPendingInvites(pending);
        }
      })
      .catch(() => {});
  }, [result]);

  const canSeeSolutions = useMemo(() => {
    if (!result) return false;
    const stats = result?.stats;
    const answers = Array.isArray(result?.answers) ? result.answers : [];
    const hasIsCorrect = answers.some((a: any) => typeof a?.isCorrect === 'boolean');
    const hasCorrectAnswers = typeof stats?.correctAnswers === 'number';
    const hasAccuracy = typeof stats?.accuracy === 'number';
    // basta con que venga alguno de los campos “sensibles”
    return hasIsCorrect || hasCorrectAnswers || hasAccuracy;
  }, [result]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-muted">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Error al cargar resultados</p>
      </div>
    );
  }

  const { attempt, template, answers, stats } = result;

  const passed = Boolean(attempt?.passed);
  const integrityInvalidated = Boolean(attempt?.integrityInvalidated);
  const credential = result?.credential;
  const retry = result?.retry;
  const retryDateLabel = retry?.availableAt
    ? new Date(retry.availableAt).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const sectionScores = (attempt?.sectionScores || {}) as Record<string, number>;

  const totalQuestions = Number(stats?.totalQuestions ?? 0);
  const answeredQuestions = Number(stats?.answeredQuestions ?? 0);

  const correctAnswers = canSeeSolutions ? Number(stats?.correctAnswers ?? 0) : null;
  const incorrectAnswers =
    canSeeSolutions && typeof correctAnswers === 'number'
      ? Math.max(0, totalQuestions - correctAnswers)
      : null;

  const accuracy = canSeeSolutions ? Number(stats?.accuracy ?? 0) : null;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] px-4 lg:px-8 py-4">
        {/* Header con resultado */}
        <div
          className={`
            rounded-2xl border p-4 text-center md:p-6 mb-4
            ${
              passed
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/20'
                : integrityInvalidated
                  ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-900/20'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20'
            }
          `}
        >
          <div className="mb-2">
            {passed ? (
              <Award className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            ) : integrityInvalidated ? (
              <ShieldAlert className="mx-auto h-10 w-10 text-red-600 dark:text-red-400" />
            ) : (
              <TrendingUp className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          <h1 className="mb-1 text-2xl font-bold">
            {passed
              ? '¡Felicidades!'
              : integrityInvalidated
                ? 'Resultado invalidado'
                : 'Evaluación completada'}
          </h1>

          <p className="mb-3 text-base">
            {passed
              ? `Aprobaste con ${attempt.totalScore}%`
              : integrityInvalidated
                ? 'Se detectaron señales críticas de incumplimiento de las reglas de integridad. No se emitió una credencial.'
                : `Obtuviste ${attempt.totalScore}% (necesitas ${template.passingScore}% para aprobar)`}
          </p>

          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 dark:bg-zinc-900">
            <span
              className={`text-4xl font-bold ${
                passed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : integrityInvalidated
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {attempt.totalScore}
            </span>
            <span className="text-lg text-muted">/100</span>
          </div>

          {passed && credential && (
            <div className="mx-auto mt-5 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-white/80 p-4 text-left dark:border-emerald-500/30 dark:bg-zinc-950/50 sm:flex-row">
              <div>
                <p className="font-semibold text-zinc-950 dark:text-white">
                  Badge verificado obtenido
                </p>
                <p className="text-sm text-muted">
                  {credential.skill} · Nivel {credential.level}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <a
                  href={credential.linkedInUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004182]"
                >
                  <Linkedin className="h-4 w-4" />
                  Añadir a LinkedIn
                </a>
                <a
                  href={credential.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver credencial
                </a>
              </div>
            </div>
          )}

          {!canSeeSolutions && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border bg-white/60 px-4 py-2 text-sm text-muted dark:bg-zinc-950/40">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                Por confidencialidad, no se muestran respuestas correctas ni explicaciones.
              </span>
            </div>
          )}
        </div>

        {!passed && retry && (
          <div
            className={`mb-4 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              integrityInvalidated
                ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-900/20'
                : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <CalendarClock
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  integrityInvalidated
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              />
              <div>
                <h2 className="font-semibold text-zinc-950 dark:text-white">
                  {integrityInvalidated
                    ? 'Tendrás una nueva oportunidad'
                    : 'Puedes volver a intentarlo'}
                </h2>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {retry.availableNow
                    ? 'Ya puedes presentar nuevamente esta certificación.'
                    : `Podrás presentar nuevamente esta certificación el ${retryDateLabel} (en ${retry.daysRemaining} días).`}
                </p>
              </div>
            </div>
            {retry.availableNow && (
              <Link
                href={`/certificaciones?exam=${encodeURIComponent(template.id)}`}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Presentar de nuevo
              </Link>
            )}
          </div>
        )}

        {/* Stats generales */}
        {canSeeSolutions ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl border glass-card text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">{correctAnswers ?? 0}</p>
              <p className="text-sm text-muted">Correctas</p>
            </div>

            <div className="p-3 rounded-xl border glass-card text-center">
              <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">{incorrectAnswers ?? 0}</p>
              <p className="text-sm text-muted">Incorrectas</p>
            </div>

            <div className="p-3 rounded-xl border glass-card text-center">
              <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">{accuracy ?? 0}%</p>
              <p className="text-sm text-muted">Precisión</p>
            </div>

            <div className="p-3 rounded-xl border glass-card text-center">
              <Clock className="h-6 w-6 text-teal-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">
                {Math.floor((attempt.timeSpent || 0) / 60)}
              </p>
              <p className="text-sm text-muted">Minutos</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl border glass-card text-center">
              <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">{answeredQuestions}</p>
              <p className="text-sm text-muted">Respondidas</p>
            </div>

            <div className="p-3 rounded-xl border glass-card text-center">
              <Award className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">{attempt.totalScore}</p>
              <p className="text-sm text-muted">Score</p>
            </div>

            <div className="p-3 rounded-xl border glass-card text-center">
              <Clock className="h-6 w-6 text-teal-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-default">
                {Math.floor((attempt.timeSpent || 0) / 60)}
              </p>
              <p className="text-sm text-muted">Minutos</p>
            </div>
          </div>
        )}

        {/* Scores por sección */}
        <div className="mb-4 p-4 rounded-xl border glass-card">
          <h2 className="text-lg font-semibold mb-4">📊 Resultados por sección</h2>
          <div className="space-y-4">
            {Object.entries(sectionScores).map(([section, score]) => (
              <div key={section}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-default">{section}</span>
                  <span className="text-sm font-semibold text-default">{score}%</span>
                </div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      score >= 70 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(sectionScores).length === 0 && (
              <p className="text-sm text-muted">Sin desglose por sección.</p>
            )}
          </div>
        </div>

        {!result.summaryOnly && (
          <>
        {/* Desglose de respuestas */}
        <div className="mb-4 p-4 rounded-xl border glass-card">
          <h2 className="text-lg font-semibold mb-4">📝 Desglose de respuestas</h2>
          <div className="space-y-6">
            {(Array.isArray(answers) ? answers : []).map((answer: any, idx: number) => {
              const showCorrectness = canSeeSolutions && typeof answer?.isCorrect === 'boolean';

              return (
                <div
                  key={answer.questionId}
                  className={`
                    p-4 rounded-xl border-2
                    ${
                      showCorrectness
                        ? answer.isCorrect
                          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-900/10'
                          : 'border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-900/10'
                        : 'border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/20'
                    }
                  `}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {showCorrectness ? (
                      answer.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      )
                    ) : (
                      <Info className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800">
                          {answer.section}
                        </span>
                        <span className="text-xs text-muted">Pregunta {idx + 1}</span>
                      </div>
                      <p className="font-medium text-default whitespace-pre-wrap">{answer.questionText}</p>
                    </div>
                  </div>

                  {answer.codeSnippet && (
                    <pre className="p-3 rounded bg-zinc-900 dark:bg-zinc-950 text-zinc-100 text-xs overflow-x-auto mb-3">
                      <code>{answer.codeSnippet}</code>
                    </pre>
                  )}

                  <div className="ml-8 space-y-2">
                    {(Array.isArray(answer.options) ? (answer.options as any[]) : []).map((option) => {
                      const isSelected = Array.isArray(answer.selectedOptions)
                        ? answer.selectedOptions.includes(option.id)
                        : false;

                      const optIsCorrect = showCorrectness ? Boolean(option?.isCorrect) : false;

                      return (
                        <div
                          key={option.id}
                          className={`
                            p-2 rounded text-sm
                            ${
                              showCorrectness
                                ? isSelected && optIsCorrect
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 font-medium'
                                  : isSelected && !optIsCorrect
                                  ? 'bg-red-100 dark:bg-red-900/40 font-medium'
                                  : optIsCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                  : ''
                                : isSelected
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 font-medium'
                                : 'bg-zinc-50 dark:bg-zinc-900/20'
                            }
                          `}
                        >
                          <span className="font-semibold mr-2">{option.id})</span>
                          <span>{option.text}</span>

                          {isSelected && (
                            <span className="ml-2 text-xs">
                              {showCorrectness ? (optIsCorrect ? '✓ Tu respuesta' : '✗ Tu respuesta') : '✓ Tu respuesta'}
                            </span>
                          )}

                          {showCorrectness && !isSelected && optIsCorrect && (
                            <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">
                              ✓ Correcta
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* explicación solo si puede ver soluciones */}
                  {canSeeSolutions && answer.explanation && (
                    <div className="ml-8 mt-3 p-3 rounded bg-blue-50 dark:bg-blue-900/20 text-sm">
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">💡 Explicación:</p>
                      <p className="text-blue-800 dark:text-blue-200">{answer.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {!Array.isArray(answers) || answers.length === 0 ? (
              <p className="text-sm text-muted">No hay respuestas para mostrar.</p>
            ) : null}
          </div>
        </div>

          </>
        )}

        {/* Acciones */}
        <div className="flex flex-col items-center gap-3">
          {/* Si hay otras evaluaciones pendientes de esta misma aplicación */}
          {pendingInvites.map((inv: any) => (
            <Link
              key={inv.id}
              href={`/assessments/${encodeURIComponent(inv.templateId)}?token=${encodeURIComponent(inv.token)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors shadow-sm"
            >
              <span>Iniciar siguiente evaluación: {inv.templateTitle ?? inv.templateId}</span>
              <span>→</span>
            </Link>
          ))}
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            {dashboardLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}