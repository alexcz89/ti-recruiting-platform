// app/jobs/[id]/AssessmentRequirement.tsx
'use client';

import Link from 'next/link';
import { FileText, Clock, Award, CheckCircle2 } from 'lucide-react';

type Props = {
  assessment: {
    id: string;
    isRequired: boolean;
    minScore: number | null;
    template: {
      id: string;
      title: string;
      difficulty: string;
      totalQuestions: number;
      timeLimit: number;
      passingScore: number;
    };
  };
  userAttempt?: {
    id: string;
    status: string;
    totalScore: number | null;
    passed: boolean | null;
  } | null;
};

export default function AssessmentRequirement({ assessment, userAttempt }: Props) {
  const { template, isRequired, minScore } = assessment;

  const isCompleted =
    userAttempt?.status === 'SUBMITTED' || userAttempt?.status === 'EVALUATED';

  const hasPassed = !!userAttempt?.passed;

  // ✅ minScore puede ser 0 y cuenta como válido
  const meetsMinScore =
    minScore != null ? (userAttempt?.totalScore || 0) >= minScore : true;

  const requiredPercent = (minScore ?? template.passingScore);

  return (
    <div
      className={`
        p-6 rounded-2xl border
        ${
          isCompleted && hasPassed && meetsMinScore
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/20'
            : 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20'
        }
      `}
    >
      <div className="flex items-start gap-4">
        <div
          className={`
            shrink-0 p-3 rounded-xl
            ${isCompleted && hasPassed && meetsMinScore ? 'bg-emerald-600' : 'bg-amber-600'}
          `}
        >
          <FileText className="h-6 w-6 text-white" />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg text-default">
                {isRequired ? 'Evaluación técnica requerida' : 'Evaluación técnica opcional'}
              </h3>
              <p className="text-sm text-muted mt-1">{template.title}</p>
            </div>

            {isCompleted && (
              <div className="shrink-0">
                {hasPassed && meetsMinScore ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Completado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm font-medium">
                    No aprobado
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>{template.totalQuestions} preguntas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{template.timeLimit} minutos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              <span>{requiredPercent}% mínimo</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-xs font-medium capitalize">
              {template.difficulty}
            </span>
          </div>

          {isCompleted && userAttempt ? (
            <div className="mt-4 p-4 rounded-xl bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-default">Tu resultado</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {userAttempt.totalScore ?? 0}%
                  </p>
                </div>
                <Link
                  href={`/assessments/attempts/${userAttempt.id}/results`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Ver detalles →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Link
                href={`/assessments/${template.id}`}
                className="btn btn-primary w-full sm:w-auto"
              >
                {isRequired ? 'Comenzar evaluación →' : 'Tomar evaluación (opcional) →'}
              </Link>
              {isRequired && (
                <p className="mt-2 text-xs text-muted">
                  * Debes completar esta evaluación para aplicar a la vacante
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
