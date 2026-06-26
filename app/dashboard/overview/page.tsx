// app/dashboard/overview/page.tsx
import { prisma } from "@/lib/server/prisma";
import Link from "next/link";
import Image from "next/image";
import { fromNow } from "@/lib/dates";
import SetupChecklist from "../components/SetupChecklist";
import BannerEmailUnverified from "../components/BannerEmailUnverified";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import clsx from "clsx";
import {
  CheckCircle2,
  TrendingUp,
  Bell,
  Users,
  Sparkles,
  ArrowRight,
  Inbox,
  Briefcase,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  REVIEWING: "En revisión",
  INTERVIEW: "A entrevista",
  OFFER: "Con oferta",
  HIRED: "Contratado",
  REJECTED: "Rechazado",
};
import QuickActionButtons from "./QuickActionButtons";
import {
  buildCandidateSkillInputs,
  buildJobSkillInputs,
  computeMatchScore,
  type JobSkillInput,
} from "@/lib/ai/matchScore";

const nf = (n: number) => new Intl.NumberFormat("es-MX").format(n);
const pct = (n: number) => `${Math.round(n)}%`;
const d7 = 7 * 24 * 60 * 60 * 1000;
const d15 = 15 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const companyId = user?.companyId as string | undefined;

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
      },
    }),
  ]);

  const [openJobs, appsTotal, apps7d, appsPending] = await Promise.all([
    prisma.job.count({ where: { companyId } }),
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({
      where: {
        job: { companyId },
        createdAt: { gte: new Date(Date.now() - d7) },
      },
    }),
    prisma.application.count({
      where: {
        job: { companyId },
        recruiterInterest: { notIn: ["MAYBE", "ACCEPTED", "REJECTED"] },
      },
    }),
  ]);

  const pendingShare = appsTotal > 0 ? Math.round((appsPending / appsTotal) * 100) : 0;

  // Batch all independent queries in parallel
  const [
    jobsWithoutApps,
    funnelRaw,
    topJobsRaw,
    recent,
    recentActivity,
  ] = await Promise.all([
    // Count jobs without applications in last 15 days
    prisma.job.count({
      where: {
        companyId,
        createdAt: { lt: new Date(Date.now() - d15) },
        applications: { none: {} },
      },
    }),
    // Funnel data by recruiter interest
    prisma.application.groupBy({
      by: ["recruiterInterest"],
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
          select: {
            candidate: {
              select: {
                candidateSkills: {
                  select: {
                    level: true,
                    term: { select: { id: true, label: true, aliases: true } },
                  },
                },
              },
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
    // Recent activity
    prisma.application.findMany({
      where: { job: { companyId } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        job: { select: { title: true } },
        candidate: { select: { name: true } },
      },
    }),
  ]);

  // Process funnel data
  const funnel = {
    REVIEW: 0,
    MAYBE: 0,
    ACCEPTED: 0,
    REJECTED: 0,
  };

  for (const row of funnelRaw) {
    const k = (row.recruiterInterest ?? "REVIEW") as keyof typeof funnel;
    if (k in funnel) funnel[k] = row._count._all;
    else funnel.REVIEW += row._count._all;
  }

  const funnelTotal = Object.values(funnel).reduce((a, b) => a + b, 0);

  // Process top jobs with match scores
  const topJobs = topJobsRaw.map((job) => {
    const jobSkills: JobSkillInput[] = buildJobSkillInputs(
      job.requiredSkills,
      job.skills
    );

    let avgMatch: number | null = null;

    if (jobSkills.length > 0 && job.applications.length > 0) {
      const scores = job.applications.map((app) => {
        const candidateSkills = buildCandidateSkillInputs(
          app.candidate?.candidateSkills ?? []
        );

        return computeMatchScore(jobSkills, candidateSkills).score;
      });

      avgMatch = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    return {
      id: job.id,
      title: job.title,
      status: job.status,
      appCount: job._count.applications,
      hasSkills: jobSkills.length > 0,
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

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] space-y-5 px-3 py-3 sm:space-y-8 sm:px-6 sm:py-5 lg:px-10">
        <div className="flex flex-wrap items-center gap-2.5 pb-1">
          <h1 className="text-2xl font-bold leading-tight text-default sm:text-3xl">
            Panel
          </h1>

          {company && (
            <span className="badge inline-flex items-center gap-1.5">
              {company.logoUrl && (
                <Image
                  src={company.logoUrl}
                  alt={company.name}
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-sm object-contain"
                />
              )}
              <span className="max-w-[140px] truncate text-default sm:max-w-none">
                {company.name}
              </span>
            </span>
          )}

          {appsPending > 0 && (
            <Link
              href="/dashboard/candidates/pending"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 transition hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-900/40 dark:hover:bg-amber-900/60"
            >
              <Bell className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {appsPending} sin revisar
              </span>
            </Link>
          )}
        </div>

        {emailUnverified && <BannerEmailUnverified />}

        <SetupChecklist
          user={{
            name: dbUser?.name ?? (user?.name as string) ?? null,
            emailVerified: dbUser?.emailVerified ?? null,
          }}
          profile={profile}
          company={company}
        />
        {/* KPI Cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            icon={Inbox}
            eyebrow="Accion requerida"
            label="Candidatos por revisar"
            value={nf(appsPending)}
            tone={appsPending > 0 ? "amber" : "emerald"}
            badge={appsPending > 0 ? "Prioritario" : "Al dia"}
            description={
              appsPending > 0
                ? `${pendingShare}% del pipeline necesita una decision`
                : "No tienes candidatos pendientes"
            }
            metricLabel="Pendientes"
            metricValue={appsPending > 0 ? "Revisar hoy" : "Al dia"}
            linkHref={appsPending > 0 ? "/dashboard/candidates/pending" : undefined}
            linkLabel={appsPending > 0 ? "Revisar candidatos" : undefined}
            featured={appsPending > 0}
          />
          <KpiCard
            icon={Briefcase}
            eyebrow="Oferta activa"
            label="Vacantes abiertas"
            value={nf(openJobs)}
            tone="teal"
            description={
              jobsWithoutApps > 0
                ? `${jobsWithoutApps} sin postulaciones despues de 15 dias`
                : "Todas tus vacantes tienen movimiento"
            }
            metricLabel="Riesgo"
            metricValue={jobsWithoutApps > 0 ? `${jobsWithoutApps} ajustar` : "Sin alertas"}
            linkHref="/dashboard/jobs"
            linkLabel="Ver vacantes"
          />
          <KpiCard
            icon={Users}
            eyebrow="Pipeline total"
            label="Postulaciones"
            value={nf(appsTotal)}
            tone="blue"
            description={`${nf(funnel.ACCEPTED)} aceptados - ${nf(funnel.MAYBE)} en duda`}
            metricLabel="Conversion"
            metricValue={appsTotal > 0 ? `${pct((funnel.ACCEPTED / appsTotal) * 100)} aceptados` : "Sin datos"}
            linkHref="/dashboard/jobs"
            linkLabel="Abrir pipeline"
          />
          <KpiCard
            icon={CalendarDays}
            eyebrow="Ultimos 7 dias"
            label="Nuevas entradas"
            value={nf(apps7d)}
            tone="zinc"
            description={
              apps7d > 0
                ? "Nueva actividad de candidatos esta semana"
                : "Sin postulaciones nuevas esta semana"
            }
            metricLabel="Ritmo"
            metricValue={apps7d > 0 ? `${nf(apps7d)} nuevas` : "Bajo"}
            linkHref="/dashboard/jobs"
            linkLabel="Ver recientes"
          />
        </section>

        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-500" />
                <h2 className="text-sm font-semibold text-default sm:text-base">
                  Pipeline de candidatos
                </h2>
              </div>
              <span className="text-xs text-zinc-400">
                {nf(funnelTotal)} total
              </span>
            </div>

            {funnelTotal === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Sin candidatos aún.
              </p>
            ) : (
              <div className="space-y-3">
                {(
                  [
                    {
                      key: "REVIEW",
                      label: "Sin revisar",
                      color: "bg-amber-400",
                      textColor: "text-amber-700 dark:text-amber-300",
                    },
                    {
                      key: "MAYBE",
                      label: "En duda",
                      color: "bg-sky-400",
                      textColor: "text-sky-700 dark:text-sky-300",
                    },
                    {
                      key: "ACCEPTED",
                      label: "Aceptados",
                      color: "bg-emerald-500",
                      textColor: "text-emerald-700 dark:text-emerald-300",
                    },
                    {
                      key: "REJECTED",
                      label: "Rechazados",
                      color: "bg-red-400",
                      textColor: "text-red-700 dark:text-red-300",
                    },
                  ] as const
                ).map(({ key, label, color, textColor }) => {
                  const count = funnel[key];
                  const width = funnelTotal > 0 ? (count / funnelTotal) * 100 : 0;

                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">
                          {label}
                        </span>
                        <span className={clsx("font-semibold", textColor)}>
                          {nf(count)}{" "}
                          <span className="font-normal text-zinc-400">
                            ({pct(width)})
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={clsx(
                            "h-2 rounded-full transition-all duration-500",
                            color
                          )}
                          style={{
                            width: `${Math.max(width, count > 0 ? 2 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {funnelTotal > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <Link
                  href="/dashboard/candidates/pending"
                  className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                >
                  Ver sin revisar →
                </Link>
              </div>
            )}
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-default sm:text-base">
                  AI Match por vacante
                </h2>
              </div>
              {globalAvgMatch !== null && (
                <span className="text-xs text-zinc-400">
                  Promedio global:{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {pct(globalAvgMatch)}
                  </span>
                </span>
              )}
            </div>

            {topJobs.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Sin vacantes aún.
              </p>
            ) : (
              <div className="space-y-3">
                {topJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}/applications`}
                    className="block rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-700/40 dark:hover:bg-emerald-950/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-default">
                          {job.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {nf(job.appCount)} candidato
                          {job.appCount !== 1 ? "s" : ""}
                          {!job.hasSkills && (
                            <span className="ml-1 text-zinc-300 dark:text-zinc-600">
                              · sin skills definidas
                            </span>
                          )}
                        </p>
                      </div>
                      {job.avgMatch !== null ? (
                        <div className="shrink-0 text-right">
                          <span
                            className={clsx(
                              "text-base font-black leading-none",
                              job.avgMatch >= 70
                                ? "text-emerald-600 dark:text-emerald-400"
                                : job.avgMatch >= 40
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-500 dark:text-red-400"
                            )}
                          >
                            {pct(job.avgMatch)}
                          </span>
                          <p className="text-[10px] text-zinc-400">promedio</p>
                        </div>
                      ) : (
                        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
                          {job.appCount === 0 ? "Sin candidatos" : "Sin skills"}
                        </span>
                      )}
                    </div>

                    {job.avgMatch !== null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-700/40">
                        <div
                          className={clsx(
                            "h-1.5 rounded-full transition-all",
                            job.avgMatch >= 70
                              ? "bg-emerald-500"
                              : job.avgMatch >= 40
                              ? "bg-amber-400"
                              : "bg-red-400"
                          )}
                          style={{ width: `${job.avgMatch}%` }}
                        />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12">
          <div className="glass-card rounded-2xl p-3 sm:p-4 md:p-5 lg:col-span-7">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <h2 className="text-sm font-semibold text-default sm:text-base">
                Postulaciones recientes
              </h2>
              <Link
                href="/dashboard/candidates/pending"
                className="whitespace-nowrap text-xs text-teal-600 hover:underline dark:text-teal-400 sm:text-sm"
              >
                Ver todas →
              </Link>
            </div>

            {recent.length === 0 ? (
              <EmptyState
                title="Sin postulaciones"
                body="Cuando lleguen postulaciones las verás aquí."
              />
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-zinc-100/80 bg-zinc-50/60 p-2.5 transition hover:border-blue-200 hover:bg-blue-50/60 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/40 sm:p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/dashboard/jobs/${r.job.id}/applications`}
                        className="min-w-0 flex-1"
                      >
                        <p className="truncate text-sm font-medium text-default">
                          {r.candidate?.name || "Candidato sin nombre"}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {r.job?.title ?? "Vacante eliminada"} ·{" "}
                          {fromNow(r.createdAt)}
                        </p>
                        <p className="hidden truncate text-[11px] text-zinc-400 sm:block">
                          {r.candidate?.email || "—"}
                        </p>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {r.status === "SUBMITTED" && (
                          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100 sm:text-[11px]">
                            Nuevo
                          </span>
                        )}
                        {r.status === "REVIEWING" && (
                          <span className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/30 dark:text-blue-100 sm:text-[11px]">
                            En revisión
                          </span>
                        )}
                        {r.status === "SUBMITTED" && (
                          <QuickActionButtons applicationId={r.id} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-xl p-3 sm:p-4 md:p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <h2 className="text-sm font-semibold text-default sm:text-base">
                Actividad reciente
              </h2>
            </div>

            {recentActivity.length === 0 ? (
              <EmptyState title="Sin actividad reciente" />
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => {
                  const isNew =
                    activity.createdAt.getTime() === activity.updatedAt.getTime();

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 text-sm text-muted"
                    >
                      <div className="mt-0.5 shrink-0">
                        {isNew ? (
                          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-400">
                          {fromNow(activity.updatedAt)}
                        </p>
                        <p className="mt-0.5 text-sm text-default">
                          {isNew ? (
                            <>
                              Nueva postulación —{" "}
                              <span className="font-medium">
                                {activity.job.title}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium">
                                {activity.candidate?.name ?? "Candidato"}
                              </span>
                              {" — "}
                              {STATUS_LABELS[activity.status] ?? "Actualización"}{" en "}
                              <span className="font-medium">
                                {activity.job.title}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  icon: Icon,
  eyebrow,
  label,
  value,
  tone = "zinc",
  badge,
  description,
  metricLabel,
  metricValue,
  linkHref,
  linkLabel,
  featured = false,
}: {
  icon: LucideIcon;
  eyebrow: string;
  label: string;
  value: string | number;
  tone?: "zinc" | "emerald" | "amber" | "blue" | "teal";
  badge?: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  linkHref?: string;
  linkLabel?: string;
  featured?: boolean;
}) {
  const tones: Record<
    string,
    {
      card: string;
      iconBg: string;
      iconColor: string;
      badge: string;
      value: string;
      bar: string;
      link: string;
    }
  > = {
    zinc: {
      card: "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
      iconBg: "bg-zinc-100 dark:bg-zinc-800",
      iconColor: "text-zinc-500 dark:text-zinc-400",
      badge: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      value: "text-zinc-950 dark:text-zinc-50",
      bar: "from-zinc-300 to-zinc-500 dark:from-zinc-600 dark:to-zinc-400",
      link: "text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
    },
    teal: {
      card: "bg-teal-50/60 dark:bg-teal-900/15 border-teal-200 dark:border-teal-800/50",
      iconBg: "bg-teal-100 dark:bg-teal-900/40",
      iconColor: "text-teal-600 dark:text-teal-400",
      badge: "border-teal-200 bg-teal-100 text-teal-700 dark:border-teal-500/40 dark:bg-teal-900/40 dark:text-teal-300",
      value: "text-teal-950 dark:text-teal-100",
      bar: "from-teal-300 to-teal-600",
      link: "text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100",
    },
    emerald: {
      card: "bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      badge: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/40 dark:text-emerald-300",
      value: "text-emerald-950 dark:text-emerald-100",
      bar: "from-emerald-300 to-emerald-600",
      link: "text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100",
    },
    amber: {
      card: "bg-amber-50/70 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/60",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      badge: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-300",
      value: "text-amber-950 dark:text-amber-100",
      bar: "from-amber-300 to-orange-500",
      link: "text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100",
    },
    blue: {
      card: "bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/50",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      badge: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/40 dark:text-blue-300",
      value: "text-blue-950 dark:text-blue-100",
      bar: "from-blue-300 to-blue-600",
      link: "text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100",
    },
  };

  const t = tones[tone] ?? tones.zinc;

  return (
    <div
      className={clsx(
        "relative flex min-h-[168px] flex-col overflow-hidden rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        t.card,
        featured && "ring-1 ring-amber-300/60 dark:ring-amber-500/30"
      )}
    >
      <div className={clsx("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", t.iconBg)}>
            <Icon className={clsx("h-4 w-4", t.iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
              {eyebrow}
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              {label}
            </h3>
          </div>
        </div>

        {badge && (
          <span className={clsx("shrink-0 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold", t.badge)}>
            {badge}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className={clsx("font-display text-4xl font-black leading-none tracking-tight", t.value)}>
          {value}
        </p>
        <div className="rounded-xl border border-white/60 bg-white/65 px-2.5 py-1.5 text-right shadow-sm dark:border-white/10 dark:bg-zinc-950/35">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {metricLabel}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            {metricValue}
          </p>
        </div>
      </div>

      <p className="mt-3 min-h-[34px] text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>

      <div className="mt-auto pt-3">
        {linkHref && linkLabel ? (
          <Link
            href={linkHref}
            className={clsx("inline-flex items-center gap-1.5 text-xs font-bold transition hover:underline", t.link)}
          >
            {linkLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Sin acciones pendientes
          </span>
        )}
      </div>
    </div>
  );
}
function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="glass-card rounded-xl border border-dashed p-5 text-center sm:p-8">
      <p className="text-sm font-medium text-default sm:text-base">{title}</p>
      {body && <p className="mt-1 text-xs text-muted sm:text-sm">{body}</p>}
      {ctaHref && ctaLabel && (
        <div className="mt-4">
          <Link href={ctaHref} className="btn-ghost text-sm">
            {ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
