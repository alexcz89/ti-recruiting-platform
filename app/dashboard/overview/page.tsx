// app/dashboard/overview/page.tsx
import { prisma } from "@/lib/server/prisma";
import Link from "next/link";
import Image from "next/image";
import { fromNow } from "@/lib/dates";
import SetupChecklist from "../components/SetupChecklist";
import BannerEmailUnverified from "../components/BannerEmailUnverified";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import type { ApplicationEventType } from "@prisma/client";
import QuickActionButtons from "./QuickActionButtons";
import { type BillingPlan } from "@/lib/ai/matchScore";
import { buildRecruiterMatchJob, computeRecruiterMatch, getRecruiterMatchAccessIds, recruiterMatchCandidateSelect, recruiterMatchJobSelect } from "@/lib/ai/recruiter-match";
import { isCanonicalHiringProcessRecruiterReadsEnabled } from "@/lib/hiring-process/feature-flags";
import { getRecruitingPresentation } from "@/lib/hiring-process/recruiting-presentation";
import { countPendingRecruiterGroupedRows } from "@/lib/hiring-process/recruiter-pending";

const nf = (n: number) => new Intl.NumberFormat("es-MX").format(n);
const pct = (n: number) => `${Math.round(n)}%`;
const d3 = 3 * 24 * 60 * 60 * 1000;
const d7 = 7 * 24 * 60 * 60 * 1000;
const d15 = 15 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const companyId = user?.companyId as string | undefined;
  const canonicalRecruiterReadsEnabled =
    isCanonicalHiringProcessRecruiterReadsEnabled();

  if (!companyId) {
    return (
      <main className="w-full">
        <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-10">
          <EmptyState
            title="Sin empresa asociada"
            body="No hay empresa vinculada a tu sesión. Pide al administrador que asigne tu usuario a una empresa."
            ctaHref="/"
            ctaLabel="Volver al inicio"
          />
        </div>
      </main>
    );
  }

  const dbUser = user?.id
    ? await prisma.user.findUnique({
        where: { id: user.id as string },
        select: {
          id: true,
          name: true,
          emailVerified: true,
        },
      })
    : null;

  const [profile, company] = await Promise.all([
    dbUser?.id
      ? prisma.recruiterProfile.findUnique({
          where: { userId: dbUser.id },
          select: {
            status: true,
            phone: true,
          },
        })
      : Promise.resolve(null),
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        size: true,
        logoUrl: true,
        website: true,
        billingPlan: true,
      },
    }),
  ]);

  const matchNow = new Date();
  const matchPlan = (company?.billingPlan ?? "FREE") as BillingPlan;
  const [totalJobs, appsTotal, apps7d, attemptsToReview, staleInvites] = await Promise.all([
    prisma.job.count({ where: { companyId } }),
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({
      where: {
        job: { companyId },
        createdAt: { gte: new Date(Date.now() - d7) },
      },
    }),
    // Evaluaciones completadas que ningún recruiter ha abierto (SUBMITTED → EVALUATED al verlas)
    prisma.assessmentAttempt.count({
      where: {
        status: "SUBMITTED",
        OR: [
          { invite: { job: { companyId } } },
          { application: { job: { companyId } } },
        ],
      },
    }),
    // Invitaciones enviadas hace más de 3 días que el candidato no ha abierto
    prisma.assessmentInvite.count({
      where: {
        status: "SENT",
        createdAt: { lt: new Date(Date.now() - d3) },
        job: { companyId },
      },
    }),
  ]);

  // Batch all independent queries in parallel
  const [
    jobsWithoutApps,
    funnelRaw,
    topJobsRaw,
    recent,
    recentActivity,
  ] = await Promise.all([
    // Open jobs older than 15 days with no applications.
    prisma.job.count({
      where: {
        companyId,
        createdAt: { lt: new Date(Date.now() - d15) },
        status: "OPEN",
        applications: { none: {} },
      },
    }),
    // Minimal grouped state tuple; the centralized reader resolves canonical
    // authority and legacy fallback without loading full application rows.
    prisma.application.groupBy({
      by: ["jobId", "stage", "disposition", "status", "recruiterInterest", "stateVersion", "hiredAt", "rejectedAt", "rejectionEmailSent"],
      where: { job: { companyId } },
      _count: { _all: true },
    }),
    // Top jobs by application count
    prisma.job.findMany({
      where: { companyId },
      orderBy: { applications: { _count: "desc" } },
      take: 5,
      select: {
        id: true,
        ...recruiterMatchJobSelect,
        title: true,
        status: true,
        createdAt: true,
        _count: { select: { applications: true } },
        skills: true,
        requiredSkills: {
          select: {
            must: true,
            weight: true,
            term: { select: { id: true, label: true, aliases: true } },
          },
        },
        applications: {
          take: 50,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            createdAt: true,
            candidate: {
              select: recruiterMatchCandidateSelect(matchNow),
            },
          },
        },
      },
    }),
    // Recent applications
    prisma.application.findMany({
      where: { job: { companyId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: { select: { name: true } },
          },
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    // Validate both tenant paths, including historical event relationships.
    prisma.applicationEvent.findMany({
      where: {
        companyId,
        application: { job: { companyId } },
        visibility: { in: ["INTERNAL", "BOTH"] },
        type: { not: "LEGACY_STATE_IMPORTED" },
      },
      orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        type: true,
        happenedAt: true,
        application: { select: {
          id: true,
          job: { select: { id: true, title: true } },
          candidate: { select: { name: true } },
        } },
      },
    }),
  ]);

  const appsPending = countPendingRecruiterGroupedRows(funnelRaw, canonicalRecruiterReadsEnabled);
  // Reuse the same complete grouped data, never the sampled AI Match cohort.
  const groupsByJob = new Map<string, typeof funnelRaw>();
  for (const group of funnelRaw) {
    const groups = groupsByJob.get(group.jobId) ?? [];
    groups.push(group);
    groupsByJob.set(group.jobId, groups);
  }
  const recentWithReadModel = recent.map((application) => ({
    ...application,
    _presentation: getRecruitingPresentation(application, canonicalRecruiterReadsEnabled),
  }));

  // Process top jobs with match scores
  const topJobs = topJobsRaw.map((job) => {
    const context = buildRecruiterMatchJob(job);
    // The oldest 50 prefix includes the entire Starter allowance of ten.
    const access = getRecruiterMatchAccessIds(job.applications, matchPlan);
    const scores = context.hasMatchSignals ? job.applications.filter((app) => access.has(app.id))
      .map((app) => computeRecruiterMatch(job, app.candidate, matchNow).finalScore) : [];
    const avgMatch = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return {
      id: job.id,
      title: job.title,
      status: job.status,
      appCount: job._count.applications,
      pendingCount: countPendingRecruiterGroupedRows(groupsByJob.get(job.id) ?? [], canonicalRecruiterReadsEnabled),
      hasSkills: context.jobSkills.length > 0,
      avgMatch,
      createdAt: job.createdAt,
    };
  });

  const emailUnverified = !dbUser?.emailVerified;

  const globalAvgMatch =
    topJobs.filter((j) => j.avgMatch !== null).length > 0
      ? topJobs
          .filter((j) => j.avgMatch !== null)
          .reduce((a, j) => a + (j.avgMatch ?? 0), 0) /
        topJobs.filter((j) => j.avgMatch !== null).length
      : null;

  const hasJobs = totalJobs > 0 || topJobs.length > 0;
  const tasks = [
    { count: appsPending, label: appsPending === 1 ? "candidato por revisar" : "candidatos por revisar", href: "/dashboard/candidates/pending", cta: "Revisar" },
    { count: attemptsToReview, label: attemptsToReview === 1 ? "evaluación sin revisar" : "evaluaciones sin revisar", href: "/dashboard/assessments?state=COMPLETED&sort=recent", cta: "Ver resultados" },
    { count: staleInvites, label: staleInvites === 1 ? "invitación sin respuesta (3+ días)" : "invitaciones sin respuesta (3+ días)", href: "/dashboard/assessments?state=PENDING", cta: "Dar seguimiento" },
    { count: jobsWithoutApps, label: jobsWithoutApps === 1 ? "vacante sin postulaciones desde hace más de 15 días" : "vacantes sin postulaciones desde hace más de 15 días", href: "/dashboard/jobs", cta: "Ajustar" },
  ].filter(task => task.count > 0);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 text-zinc-900 dark:text-zinc-100 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
          {company && <p className="mt-1 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            {company.logoUrl && <Image src={company.logoUrl} alt="" width={20} height={20} className="h-5 w-5 rounded object-contain" />}
            <span className="break-words">{company.name}</span>
          </p>}
        </div>
      </div>

      {emailUnverified && <BannerEmailUnverified />}

      {!hasJobs ? (
        <EmptyState title="Aún no tienes vacantes" body="Publica tu primera vacante para recibir postulaciones y gestionar tu proceso de selección." ctaHref="/dashboard/jobs/new" ctaLabel="Publicar vacante" />
      ) : (
        <div className={recentActivity.length > 0 ? "grid min-w-0 gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]" : "grid min-w-0 gap-6"}>
          <section aria-labelledby="pending-title" className="min-w-0 max-w-2xl">
            <h2 id="pending-title" className={headingClass}>Tu trabajo pendiente</h2>
            {tasks.length > 0 ? <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {tasks.map(task => <li key={task.href + task.cta}>
                <Link href={task.href} className="-mx-2 flex min-h-11 items-center justify-between gap-4 rounded-md px-2 py-2 text-sm !text-zinc-900 outline-none hover:bg-zinc-50 hover:no-underline focus-visible:ring-2 focus-visible:ring-emerald-600 dark:!text-zinc-100 dark:hover:bg-zinc-900">
                  <span className="min-w-0"><span className="mr-1 font-semibold tabular-nums">{nf(task.count)}</span> {task.label}</span>
                  <span className="shrink-0 font-medium text-emerald-700 dark:text-emerald-300">{task.cta}</span>
                </Link>
              </li>)}
            </ul> : <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">
              {appsTotal === 0 ? "Todavía no recibes postulaciones. Comparte tus vacantes para comenzar a recibir candidatos." : "No hay pendientes en las categorías de este resumen."}
            </p>}

            {recentWithReadModel.length > 0 && <details id="postulaciones-recientes" className="mt-2 border-t border-zinc-200 dark:border-zinc-800">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900">Postulaciones recientes</summary>
              <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">{nf(apps7d)} nuevas en los últimos 7 días · Últimas {nf(recentWithReadModel.length)} postulaciones</p>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {recentWithReadModel.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/dashboard/jobs/${r.job.id}/applications`} className="min-w-0 flex-1 rounded text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    <span className="block break-words font-medium">{r.candidate?.name || "Candidato sin nombre"}</span>
                    <span className="mt-1 block break-words text-xs text-zinc-600 dark:text-zinc-400">{r.job.title} · {fromNow(r.createdAt)}</span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700">{r._presentation.label}</span>
                    {r._presentation.column === "APPLIED" && <div className="[&_button]:h-11 [&_button]:w-11"><QuickActionButtons applicationId={r.id} stateVersion={r.stateVersion} /></div>}
                  </div>
                </li>)}
              </ul>
              <Link href="/dashboard/candidates/pending" className={actionClass}>Ver candidatos por revisar</Link>
            </details>}
          </section>

          <section aria-labelledby="jobs-title" className={`min-w-0 border-t border-zinc-200 pt-4 dark:border-zinc-800 ${recentActivity.length > 0 ? "lg:col-span-2" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="jobs-title" className={headingClass}>Mis vacantes</h2>
              <Link href="/dashboard/jobs" className={actionClass}>Ver todas</Link>
            </div>
            <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">Hasta cinco vacantes, ordenadas por número de postulaciones.</p>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {topJobs.map(job => <li key={job.id} className="grid min-w-0 gap-2 py-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center xl:gap-6">
                <div className="min-w-0">
                  <Link href={`/dashboard/jobs/${job.id}/applications`} className="rounded text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-600"><span className="break-words">{job.title}</span></Link>
                  <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">{job.status === "OPEN" ? "Abierta" : job.status === "PAUSED" ? "En pausa" : "Cerrada"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm tabular-nums">
                  <span>{nf(job.appCount)} {job.appCount === 1 ? "candidato" : "candidatos"}</span>
                  <span>{nf(job.pendingCount)} por revisar</span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {job.avgMatch !== null ? <>AI Match {pct(job.avgMatch)}</> : matchPlan === "FREE" && job.hasSkills ? "AI Match bloqueado" : "AI Match sin datos"}
                  </span>
                </div>
                <Link href={`/dashboard/jobs/${job.id}`} aria-label={`Ver proceso de ${job.title}`} className={actionClass}>Ver proceso</Link>
              </li>)}
            </ul>
            {globalAvgMatch !== null && <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">AI Match · {pct(globalAvgMatch)} de promedio visible en este resumen. Solo incluye postulaciones con acceso según tu plan.</p>}
          </section>

          {recentActivity.length > 0 && <section aria-labelledby="activity-title" className="min-w-0 border-t border-zinc-200 pt-4 dark:border-zinc-800 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h2 id="activity-title" className={headingClass}>Actividad reciente</h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recentActivity.map(event => <li key={event.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p>{eventLabels[event.type]}</p>
                  <Link href={`/dashboard/jobs/${event.application.job.id}/applications`} className="mt-1 inline-block break-words rounded text-zinc-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-400">{event.application.candidate.name ?? "Candidato sin nombre"} · {event.application.job.title}</Link>
                </div>
                <time dateTime={event.happenedAt.toISOString()} className="text-xs text-zinc-600 dark:text-zinc-400">{fromNow(event.happenedAt)}</time>
              </li>)}
            </ul>
          </section>}
        </div>
      )}

      <SetupChecklist compact user={{ name: dbUser?.name ?? user?.name ?? null, emailVerified: dbUser?.emailVerified ?? null }} profile={profile} company={company} />
    </main>
  );
}

const actionClass = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium text-emerald-700 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:text-emerald-300 dark:hover:bg-emerald-950 dark:focus-visible:ring-offset-zinc-900";
const headingClass = "text-base font-semibold tracking-tight";
const eventLabels: Record<ApplicationEventType, string> = {
  APPLICATION_CREATED: "Nueva postulación",
  APPLICATION_STAGE_CHANGED: "Etapa actualizada",
  APPLICATION_DISPOSITION_CHANGED: "Estado del proceso actualizado",
  CANDIDATE_REJECTED: "Candidatura descartada",
  CANDIDATE_WITHDREW: "Candidatura retirada",
  CANDIDATE_HIRED: "Candidato contratado",
  PROCESS_CANCELLED: "Proceso cancelado",
  LEGACY_STATE_IMPORTED: "Estado histórico importado",
};

function EmptyState({ title, body, ctaHref, ctaLabel }: { title: string; body?: string; ctaHref?: string; ctaLabel?: string }) {
  return <section className="rounded-xl border border-zinc-200 bg-white px-5 py-8 dark:border-zinc-800 dark:bg-zinc-900 sm:py-12">
    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
    {body && <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>}
    {ctaHref && ctaLabel && <Link href={ctaHref} className="btn btn-primary mt-5 min-h-11 bg-emerald-700 !text-white hover:bg-emerald-800">{ctaLabel}</Link>}
  </section>;
}
