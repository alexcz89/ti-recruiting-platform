// app/dashboard/jobs/[id]/assessments/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import AssignAssessmentForm from "./AssignAssessmentForm";

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
          difficulty: true,
          totalQuestions: true,
          timeLimit: true,
          passingScore: true,
        },
      },
    },
  });

  const count = existingAssessments.length;

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

        {/* ✅ Estado actual: lista / empty-state */}
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
              Selecciona un assessment abajo y presiona <span className="font-medium">“Asignar assessment”</span>.
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Assessment</th>
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

        <AssignAssessmentForm jobId={job.id} existingAssessments={existingAssessments as any} />
      </div>
    </main>
  );
}
