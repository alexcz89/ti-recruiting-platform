// app/assessments/attempts/[attemptId]/results/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, TrendingUp, Clock, Award, Info } from 'lucide-react';

export default function AssessmentResultsPage() {
  const params = useParams();
  const attemptId = params.attemptId as string;

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
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-12">
        {/* Header con resultado */}
        <div
          className={`
            text-center p-8 md:p-12 rounded-2xl border mb-8
            ${
              passed
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/20'
                : 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20'
            }
          `}
        >
          <div className="mb-4">
            {passed ? (
              <Award className="h-16 w-16 text-emerald-600 dark:text-emerald-400 mx-auto" />
            ) : (
              <TrendingUp className="h-16 w-16 text-amber-600 dark:text-amber-400 mx-auto" />
            )}
          </div>

          <h1 className="text-4xl font-bold mb-2">
            {passed ? '¡Felicidades! 🎉' : 'Evaluación completada'}
          </h1>

          <p className="text-xl mb-6">
            {passed
              ? `Aprobaste con ${attempt.totalScore}%`
              : `Obtuviste ${attempt.totalScore}% (necesitas ${template.passingScore}% para aprobar)`}
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900">
            <span className="text-6xl font-bold text-emerald-600">{attempt.totalScore}</span>
            <span className="text-2xl text-muted">/100</span>
          </div>

          {!canSeeSolutions && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm text-muted bg-white/60 dark:bg-zinc-950/40">
              <Info className="h-4 w-4" />
              <span>
                Por confidencialidad, aquí no se muestran respuestas correctas ni explicaciones.
              </span>
            </div>
          )}
        </div>

        {/* Stats generales */}
        {canSeeSolutions ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-6 rounded-2xl border glass-card text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">{correctAnswers ?? 0}</p>
              <p className="text-sm text-muted">Correctas</p>
            </div>

            <div className="p-6 rounded-2xl border glass-card text-center">
              <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">{incorrectAnswers ?? 0}</p>
              <p className="text-sm text-muted">Incorrectas</p>
            </div>

            <div className="p-6 rounded-2xl border glass-card text-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">{accuracy ?? 0}%</p>
              <p className="text-sm text-muted">Precisión</p>
            </div>

            <div className="p-6 rounded-2xl border glass-card text-center">
              <Clock className="h-8 w-8 text-violet-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">
                {Math.floor((attempt.timeSpent || 0) / 60)}
              </p>
              <p className="text-sm text-muted">Minutos</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-6 rounded-2xl border glass-card text-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">{answeredQuestions}</p>
              <p className="text-sm text-muted">Respondidas</p>
            </div>

            <div className="p-6 rounded-2xl border glass-card text-center">
              <Award className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">{attempt.totalScore}</p>
              <p className="text-sm text-muted">Score</p>
            </div>

            <div className="p-6 rounded-2xl border glass-card text-center">
              <Clock className="h-8 w-8 text-violet-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-default">
                {Math.floor((attempt.timeSpent || 0) / 60)}
              </p>
              <p className="text-sm text-muted">Minutos</p>
            </div>
          </div>
        )}

        {/* Scores por sección */}
        <div className="mb-8 p-6 rounded-2xl border glass-card">
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

        {/* Desglose de respuestas */}
        <div className="mb-8 p-6 rounded-2xl border glass-card">
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

        {/* Acciones */}
        <div className="text-center">
          <Link href="/dashboard" className="btn btn-primary">
            Volver al dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
