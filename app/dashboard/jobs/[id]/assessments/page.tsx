// app/dashboard/jobs/[id]/assessments/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
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
  const companyId = await getSessionCompanyId().catch(() => null);

  // ✅ DEBUG: confirma qué DB está usando Next (sanitizado)
  console.log("[ENV DATABASE_URL]", (process.env.DATABASE_URL || "").replace(/:\/\/.*@/, "://***@"));

  console.log("[DASH JOB ASSESSMENTS PAGE] hit", {
    jobId: params.id,
    userId: user?.id,
    role: user?.role,
    sessionUserCompanyId: user?.companyId ?? null,
    getSessionCompanyId: companyId,
  });

  if (!companyId) {
    console.log("[DASH JOB ASSESSMENTS PAGE] no companyId -> redirect");
    redirect("/dashboard/overview");
  }

  // ✅ DEBUG: trae el job sin filtro para validar existencia y companyId real
  const rawJob = await prisma.job.findUnique({
    where: { id: params.id },
    select: { id: true, companyId: true, title: true },
  });

  console.log("[DASH JOB ASSESSMENTS DEBUG]", {
    paramsJobId: params.id,
    sessionUserId: user?.id ?? null,
    sessionUserCompanyId: user?.companyId ?? null,
    getSessionCompanyId: companyId,
    rawJobExists: !!rawJob,
    rawJobCompanyId: rawJob?.companyId ?? null,
    rawJobTitle: rawJob?.title ?? null,
  });

  // ✅ Multiempresa: job debe ser de la empresa del usuario
  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: {
      id: true,
      title: true,
      location: true,
      company: { select: { name: true } },
    },
  });

  if (!job) {
    console.log("[DASH JOB ASSESSMENTS PAGE] job not found OR not in company", {
      requestedJobId: params.id,
      sessionCompanyId: companyId,
      jobExists: !!rawJob,
      jobCompanyId: rawJob?.companyId ?? null,
      jobTitle: rawJob?.title ?? null,
    });

    notFound();
  }

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

  console.log("[DASH JOB ASSESSMENTS PAGE] loaded", {
    jobId: job.id,
    existingAssessmentsCount: existingAssessments.length,
  });

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

        <AssignAssessmentForm
          jobId={job.id}
          existingAssessments={existingAssessments as any}
        />
      </div>
    </main>
  );
}
