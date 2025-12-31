// app/mis-evaluaciones/page.tsx
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session';
import Link from 'next/link';
import { FileText, Clock, Award, CheckCircle2, Play } from 'lucide-react';
import { fromNow } from '@/lib/dates';

export const metadata = { title: 'Mis Evaluaciones' };

export default async function MyAssessmentsPage() {
  const userId = await getSessionUserId().catch(() => null);

  if (!userId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-10">
          <p>Debes iniciar sesión para ver tus evaluaciones</p>
        </div>
      </main>
    );
  }

  // Obtener intentos del usuario
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { candidateId: userId },
    include: {
      template: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          totalQuestions: true,
          timeLimit: true,
          passingScore: true,
        },
      },
      application: {
        select: {
          job: {
            select: {
              title: true,
              company: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Obtener templates disponibles que el usuario no ha tomado
  const completedTemplateIds = attempts.map((a) => a.templateId);
  const availableTemplates = await prisma.assessmentTemplate.findMany({
    where: {
      isActive: true,
      id: { notIn: completedTemplateIds },
    },
    select: {
      id: true,
      title: true,
      description: true,
      difficulty: true,
      totalQuestions: true,
      timeLimit: true,
      passingScore: true,
    },
  });

  const completedAttempts = attempts.filter(
    (a) => a.status === 'SUBMITTED' || a.status === 'EVALUATED'
  );
  const inProgressAttempts = attempts.filter((a) => a.status === 'IN_PROGRESS');

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-default">Mis Evaluaciones</h1>
          <p className="text-sm text-muted mt-1">
            Gestiona tus assessments técnicos y ve tus resultados
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Total completadas"
            value={completedAttempts.length}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Aprobadas"
            value={completedAttempts.filter((a) => a.passed).length}
            icon={<Award className="h-5 w-5 text-emerald-600" />}
            accent="emerald"
          />
          <StatCard
            label="En progreso"
            value={inProgressAttempts.length}
            icon={<Play className="h-5 w-5 text-blue-600" />}
            accent="blue"
          />
        </div>

        {/* Evaluaciones en progreso */}
        {inProgressAttempts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-default mb-4">
              ⏳ En progreso
            </h2>
            <div className="space-y-3">
              {inProgressAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="p-6 rounded-2xl border border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-900/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-default">
                        {attempt.template.title}
                      </h3>
                      {attempt.application && (
                        <p className="text-sm text-muted mt-1">
                          Para: {attempt.application.job.title} •{' '}
                          {attempt.application.job.company.name}
                        </p>
                      )}
                      <p className="text-sm text-muted mt-2">
                        Iniciada {fromNow(attempt.startedAt!)}
                      </p>
                    </div>
                    <Link
                      href={`/assessments/${attempt.templateId}`}
                      className="btn btn-primary"
                    >
                      Continuar →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evaluaciones completadas */}
        {completedAttempts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-default mb-4">
              ✅ Completadas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className={`
                    p-6 rounded-2xl border glass-card
                    ${
                      attempt.passed
                        ? 'border-emerald-200 dark:border-emerald-500/30'
                        : ''
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-default">
                        {attempt.template.title}
                      </h3>
                      <p className="text-xs text-muted mt-1 capitalize">
                        {attempt.template.difficulty}
                      </p>
                    </div>
                    {attempt.passed ? (
                      <span className="shrink-0 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-medium">
                        Aprobado
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs font-medium">
                        No aprobado
                      </span>
                    )}
                  </div>

                  {attempt.application && (
                    <p className="text-sm text-muted mb-3">
                      {attempt.application.job.title}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-emerald-600">
                        {attempt.totalScore}%
                      </p>
                      <p className="text-xs text-muted">
                        {fromNow(attempt.submittedAt!)}
                      </p>
                    </div>
                    <Link
                      href={`/assessments/attempts/${attempt.id}/results`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Ver detalles →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evaluaciones disponibles */}
        {availableTemplates.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-default mb-4">
              📚 Evaluaciones disponibles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-6 rounded-2xl border glass-card"
                >
                  <h3 className="font-semibold text-lg text-default mb-2">
                    {template.title}
                  </h3>
                  <p className="text-sm text-muted mb-4">{template.description}</p>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted mb-4">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {template.totalQuestions} preguntas
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {template.timeLimit} min
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-xs font-medium capitalize">
                      {template.difficulty}
                    </span>
                  </div>

                  <Link
                    href={`/assessments/${template.id}`}
                    className="btn btn-primary w-full"
                  >
                    Comenzar evaluación →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {attempts.length === 0 && availableTemplates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-zinc-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-default">
              No hay evaluaciones disponibles
            </p>
            <p className="text-sm text-muted mt-1">
              Las evaluaciones aparecerán aquí cuando apliques a vacantes
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: 'emerald' | 'blue';
}) {
  return (
    <div className="p-6 rounded-2xl border glass-card">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p
        className={`text-3xl font-bold ${
          accent === 'emerald'
            ? 'text-emerald-600'
            : accent === 'blue'
            ? 'text-blue-600'
            : 'text-default'
        }`}
      >
        {value}
      </p>
    </div>
  );
}