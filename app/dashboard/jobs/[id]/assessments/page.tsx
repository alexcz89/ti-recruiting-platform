// app/dashboard/jobs/[id]/assessments/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import AssignAssessmentForm from "./AssignAssessmentForm";
// ✅ NUEVO: Info de créditos
import { getCreditBalance } from '@/lib/assessments/credits';
import { formatCredits } from '@/lib/assessments/pricing';

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: { id: string } };

export default async function JobAssessmentsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/signin?callbackUrl=/dashboard/jobs/${params.id}/assessments`);
  }

  const user = session.user as any;
  const role = (user?.role as string | undefined) ?? undefined;
  const userId = (user?.id as string | undefined) ?? undefined;

  if (!userId) redirect("/signin");

  const isAdmin = role === "ADMIN";
  const isRecruiter = role === "RECRUITER";

  // Solo admin o recruiter
  if (!isAdmin && !isRecruiter) notFound();

  // companyId real del scope multi-empresa
  const scopedCompanyId =
    (await getSessionCompanyId().catch(() => null)) ??
    (user?.companyId as string | undefined) ??
    null;

  // Admin: ve cualquier job
  // Recruiter: SIEMPRE scope por companyId (si no hay companyId, no debe entrar)
  const job = isAdmin
    ? await prisma.job.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          title: true,
          location: true,
          companyId: true, // ✅ NUEVO: Necesario para créditos
          company: { select: { name: true } },
        },
      })
    : scopedCompanyId
      ? await prisma.job.findFirst({
          where: { id: params.id, companyId: scopedCompanyId },
          select: {
            id: true,
            title: true,
            location: true,
            companyId: true, // ✅ NUEVO: Necesario para créditos
            company: { select: { name: true } },
          },
        })
      : null;

  if (!job) notFound();

  const existingAssessments = await prisma.jobAssessment.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: "asc" },
    include: {
      template: {
        select: {
          id: true,
          title: true,
          type: true, // ✅ NUEVO: Para calcular costos
          difficulty: true,
          totalQuestions: true,
          timeLimit: true,
          passingScore: true,
        },
      },
    },
  });

  const count = existingAssessments.length;

  // ✅ NUEVO: Obtener balance de créditos de la empresa
  const creditBalance = await getCreditBalance(job.companyId);
  const availableCredits = creditBalance?.available || 0;
  const reservedCredits = creditBalance?.reserved || 0;
  const effectiveBalance = creditBalance?.effectiveBalance || 0;
  const hasLowCredits = effectiveBalance < 5;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Assessments de la vacante
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              {job.title}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {job.company?.name ?? "—"}
              {job.location ? ` · ${job.location}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/jobs/${job.id}/applications`}
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
            >
              Ver postulaciones
            </Link>

            <Link
              href={`/jobs/${job.id}`}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
            >
              Ver vacante pública
            </Link>

            <Link
              href={`/dashboard/jobs/${job.id}`}
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
            >
              Volver
            </Link>
          </div>
        </header>

        {/* ✅ NUEVO: Balance de Créditos */}
        <section className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50/50 to-purple-50/50 p-4 shadow-sm dark:border-violet-800/70 dark:from-violet-900/10 dark:to-purple-900/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                Balance de Créditos
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Los créditos se consumen cuando los candidatos completan las evaluaciones
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {formatCredits(availableCredits)}
                </p>
                <p className="text-xs text-zinc-500">disponibles</p>
              </div>
              {reservedCredits > 0 && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {formatCredits(reservedCredits)}
                  </p>
                  <p className="text-xs text-zinc-500">reservados</p>
                </div>
              )}
              <Link
                href="/dashboard/billing/credits"
                className="rounded-full border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
              >
                Ver historial →
              </Link>
            </div>
          </div>

          {/* ✅ Warning si hay pocos créditos */}
          {hasLowCredits && (
            <div className="mt-3 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-xs">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">Créditos Bajos</p>
                  <p className="text-amber-800 dark:text-amber-200 mt-0.5">
                    Tienes menos de 5 créditos disponibles. Los nuevos candidatos no recibirán evaluaciones automáticamente.{" "}
                    <Link href="/dashboard/billing/credits" className="underline font-medium">
                      Comprar más créditos
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ✅ Info de cómo funcionan */}
        <section className="rounded-2xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-800/70 dark:bg-blue-900/10">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                ¿Cómo funcionan las evaluaciones automáticas?
              </p>
              <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-xs">
                <li>• Cuando un candidato aplica, se le envía automáticamente la evaluación por correo</li>
                <li>• Se reservan 0.5 créditos al enviar y se cobra el resto cuando completa</li>
                <li>• Si no completa en 7 días, se reembolsan los créditos reservados</li>
                <li>• Los resultados aparecen automáticamente en el dashboard</li>
                <li>• El costo varía según el tipo (MCQ: 1.0, Coding: 2.5-4.0 créditos)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Estado actual: lista / empty-state */}
        <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Assessments asignados
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {count === 0
                  ? "Aún no has asignado assessments a esta vacante."
                  : "Estos son los assessments configurados para esta vacante."}
              </p>
            </div>

            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {count} {count === 1 ? "asignado" : "asignados"}
            </span>
          </div>

          {count === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
              Selecciona un assessment abajo y presiona <span className="font-medium">&quot;Asignar assessment&quot;</span>.
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Assessment</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Reglas</th>
                    <th className="px-3 py-2 font-medium">Tiempo</th>
                    <th className="px-3 py-2 font-medium">Preguntas</th>
                    <th className="px-3 py-2 font-medium">Passing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950/20">
                  {existingAssessments.map((a: any) => (
                    <tr key={a.id} className="text-zinc-800 dark:text-zinc-100">
                      <td className="px-3 py-2">
                        <div className="font-medium">{a.template?.title ?? "—"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {a.template?.difficulty ? String(a.template.difficulty) : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs">
                          {a.template?.type === "CODING" ? "💻" : "📝"}
                          {a.template?.type ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm">
                          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                            {a.isRequired ? "Obligatorio" : "Opcional"}
                          </span>
                          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                            Min score: {typeof a.minScore === "number" ? a.minScore : "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {typeof a.template?.timeLimit === "number" ? `${a.template.timeLimit} min` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {typeof a.template?.totalQuestions === "number" ? a.template.totalQuestions : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {typeof a.template?.passingScore === "number" ? `${a.template.passingScore}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ✅ MODIFICADO: Pasar créditos al formulario */}
        <AssignAssessmentForm 
          jobId={job.id} 
          existingAssessments={existingAssessments as any}
          availableCredits={availableCredits}
        />
      </div>
    </main>
  );
}