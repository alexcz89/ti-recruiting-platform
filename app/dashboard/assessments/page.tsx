// app/dashboard/assessments/page.tsx
import { prisma } from '@/lib/prisma';
import { getSessionCompanyId } from '@/lib/session';
import Link from 'next/link';
import { fromNow } from '@/lib/dates';
import { CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react';

export const metadata = { title: 'Evaluaciones | Panel' };

export default async function AssessmentsPage() {
  const companyId = await getSessionCompanyId().catch(() => null);

  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-10">
          <p>No hay empresa asociada</p>
        </div>
      </main>
    );
  }

  // Obtener todos los intentos de candidatos para vacantes de esta empresa
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      application: {
        job: {
          companyId,
        },
      },
      status: {
        in: ['SUBMITTED', 'EVALUATED'],
      },
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      template: {
        select: {
          title: true,
          difficulty: true,
          passingScore: true,
        },
      },
      application: {
        select: {
          job: {
            select: {
              title: true,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
    take: 50,
  });

  // Estadísticas
  const totalAttempts = attempts.length;
  const passedCount = attempts.filter((a) => a.passed).length;
  const avgScore =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / attempts.length
        )
      : 0;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
            Panel de reclutador
          </p>
          <h1 className="text-3xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
            Evaluaciones
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Resultados de assessments técnicos de tus candidatos
          </p>
        </div>

        {/* Métricas */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total evaluaciones" value={totalAttempts} />
          <MetricCard
            label="Aprobadas"
            value={passedCount}
            accent="emerald"
          />
          <MetricCard
            label="Score promedio"
            value={`${avgScore}%`}
            accent="blue"
          />
          <MetricCard
            label="Tasa de aprobación"
            value={
              totalAttempts > 0
                ? `${Math.round((passedCount / totalAttempts) * 100)}%`
                : '0%'
            }
            accent="violet"
          />
        </section>

        {/* Tabla de intentos */}
        {attempts.length === 0 ? (
          <div className="rounded-2xl border border-dashed glass-card p-8 text-center">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
              No hay evaluaciones completadas
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Cuando los candidatos completen assessments, aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border glass-card p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead className="bg-gray-50/90 dark:bg-zinc-900/70 text-left text-zinc-600 dark:text-zinc-300 sticky top-0">
                  <tr>
                    <th className="py-3.5 px-4">Candidato</th>
                    <th className="py-3.5 px-4">Assessment</th>
                    <th className="py-3.5 px-4">Vacante</th>
                    <th className="py-3.5 px-4 text-center">Score</th>
                    <th className="py-3.5 px-4 text-center">Resultado</th>
                    <th className="py-3.5 px-4">Fecha</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {attempts.map((attempt) => (
                    <tr
                      key={attempt.id}
                      className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/70"
                    >
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {attempt.candidate.name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {attempt.candidate.email}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {attempt.template.title}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                            {attempt.template.difficulty}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="text-zinc-800 dark:text-zinc-100">
                          {attempt.application?.job.title || '—'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex min-w-[3rem] justify-center rounded-full border bg-gray-50 px-3 py-1 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                          {attempt.totalScore}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {attempt.passed ? (
                          <span className="inline-flex items-center gap-1 rounded-full border bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/60 dark:text-emerald-100">
                            <CheckCircle2 className="h-3 w-3" />
                            Aprobado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border bg-red-50 px-3 py-1 text-xs font-medium text-red-700 border-red-200 dark:bg-red-500/15 dark:border-red-500/60 dark:text-red-100">
                            <XCircle className="h-3 w-3" />
                            No aprobado
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-800 dark:text-zinc-100">
                        {fromNow(attempt.submittedAt || attempt.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/assessments/attempts/${attempt.id}/results`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Ver detalles →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'blue' | 'violet';
}) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500/30 dark:text-emerald-300',
    blue: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500/30 dark:text-blue-300',
    violet: 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/20 dark:border-violet-500/30 dark:text-violet-300',
  };

  return (
    <div className="rounded-2xl border glass-card p-4 md:p-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl md:text-3xl font-semibold ${
          accent ? colors[accent] : 'text-zinc-900 dark:text-zinc-50'
        }`}
      >
        {value}
      </p>
    </div>
  );
}