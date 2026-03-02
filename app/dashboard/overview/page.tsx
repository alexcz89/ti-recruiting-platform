// app/dashboard/overview/page.tsx
import { prisma } from '@/lib/server/prisma';
import Link from "next/link";
import Image from "next/image";
import { fromNow } from "@/lib/dates";
import SetupChecklist from "../components/SetupChecklist";
import BannerEmailUnverified from "../components/BannerEmailUnverified";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import clsx from "clsx";
import { AlertCircle, CheckCircle2, XCircle, Clock, TrendingUp, Bell } from "lucide-react";
import QuickActionButtons from "./QuickActionButtons";

const nf = (n: number) => new Intl.NumberFormat("es-MX").format(n);
const d7 = 7 * 24 * 60 * 60 * 1000;
const d15 = 15 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const companyId = user?.companyId as string | undefined;

  if (!companyId) {
    return (
      <main className="w-full">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 py-10">
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
        select: { id: true, name: true, emailVerified: true },
      })
    : null;

  const [profile, company] = await Promise.all([
    dbUser?.id
      ? prisma.recruiterProfile.findUnique({
          where: { userId: dbUser.id },
          select: { status: true, phone: true, website: true },
        })
      : Promise.resolve(null),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, size: true, logoUrl: true },
    }),
  ]);

  const [openJobs, appsTotal, apps7d, appsPending] = await Promise.all([
    prisma.job.count({ where: { companyId } }),
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({
      where: { job: { companyId }, createdAt: { gte: new Date(Date.now() - d7) } },
    }),
    prisma.application.count({
      where: { job: { companyId }, status: "SUBMITTED" },
    }),
  ]);

  const jobsWithoutApps = await prisma.job.count({
    where: {
      companyId,
      createdAt: { lt: new Date(Date.now() - d15) },
      applications: { none: {} },
    },
  });

  const hasPendingTasks = appsPending > 0 || jobsWithoutApps > 0;

  const recent = await prisma.application.findMany({
    where: { job: { companyId } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      job: { select: { id: true, title: true, company: { select: { name: true } } } },
      candidate: { select: { id: true, name: true, email: true } },
    },
  });

  const recentActivity = await prisma.application.findMany({
    where: { job: { companyId } },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true, status: true, createdAt: true, updatedAt: true,
      job: { select: { title: true } },
      candidate: { select: { name: true } },
    },
  });

  const emailUnverified = !dbUser?.emailVerified;

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-3 sm:px-6 lg:px-10 py-3 sm:py-4 space-y-4 sm:space-y-6">

        {/* ── Header ── */}
        <div className="sticky top-12 z-30">
          <header className="rounded-2xl border glass-card p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              {/* Título + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-bold leading-tight text-default">
                  Panel
                </h1>

                {company && (
                  <span className="inline-flex items-center gap-1.5 badge">
                    {company.logoUrl && (
                      <Image
                        src={company.logoUrl}
                        alt={company.name}
                        width={16}
                        height={16}
                        className="h-4 w-4 rounded-sm object-contain"
                      />
                    )}
                    <span className="text-default truncate max-w-[120px] sm:max-w-none">
                      {company.name}
                    </span>
                  </span>
                )}

                {appsPending > 0 && (
                  <Link
                    href="/dashboard/jobs?filter=pending"
                    className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-500/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                    title={`${appsPending} candidato${appsPending !== 1 ? "s" : ""} por revisar`}
                  >
                    <Bell className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {appsPending}
                    </span>
                  </Link>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2 flex-wrap">
                <Link href="/dashboard/jobs/new" className="btn btn-primary text-sm">
                  + Publicar vacante
                </Link>
                <Link href="/dashboard/jobs" className="btn-ghost text-sm hidden sm:inline-flex">
                  Administrar vacantes
                </Link>
                <Link href="/dashboard/billing" className="btn-ghost text-sm hidden md:inline-flex">
                  Facturación y plan
                </Link>
              </div>
            </div>
          </header>
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

        {/* ── Tareas pendientes ── */}
        {hasPendingTasks && (
          <section className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20 p-3 sm:p-4 md:p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  Tareas pendientes
                </h2>
                <ul className="space-y-2">
                  {appsPending > 0 && (
                    <li className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <Clock className="h-4 w-4 shrink-0" />
                      <Link href="/dashboard/jobs?filter=pending" className="hover:underline">
                        <span className="font-semibold">{appsPending}</span> candidato
                        {appsPending !== 1 ? "s" : ""} por revisar
                      </Link>
                    </li>
                  )}
                  {jobsWithoutApps > 0 && (
                    <li className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <XCircle className="h-4 w-4 shrink-0" />
                      <Link href="/dashboard/jobs?filter=no-applications" className="hover:underline">
                        <span className="font-semibold">{jobsWithoutApps}</span> vacante
                        {jobsWithoutApps !== 1 ? "s" : ""} sin postulaciones (más de 15 días)
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── KPIs — 2x2 en mobile, 4 en fila en lg ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 sm:gap-6">
          <KpiCard label="Vacantes abiertas" value={nf(openJobs)} tone="emerald" />
          <KpiCard label="Postulaciones" value={nf(appsTotal)} tone="blue" />
          <KpiCard label="Últimos 7 días" value={nf(apps7d)} tone="violet" />
          <KpiCard
            label="Por revisar"
            value={nf(appsPending)}
            tone={appsPending > 0 ? "amber" : "zinc"}
            badge={appsPending > 0 ? "Prioritario" : undefined}
          />
        </section>

        {/* ── Grids de postulaciones + actividad ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

          {/* Postulaciones recientes */}
          <div className="lg:col-span-7 rounded-2xl border glass-card p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="font-semibold text-sm sm:text-base text-default">
                Postulaciones recientes
              </h2>
              <Link href="/dashboard/jobs" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
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
                    className="rounded-xl border border-zinc-100/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 p-2.5 sm:p-3 hover:border-blue-200 hover:bg-blue-50/60 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/jobs/${r.job.id}/applications`} className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-default truncate">
                          {r.candidate?.name || "Candidato sin nombre"}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {r.job?.title ?? "Vacante eliminada"} · {fromNow(r.createdAt)}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
                          {r.candidate?.email || "—"}
                        </p>
                      </Link>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {r.status === "SUBMITTED" && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-500/40 whitespace-nowrap">
                            Nuevo
                          </span>
                        )}
                        {r.status === "REVIEWING" && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-500/40 whitespace-nowrap">
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

          {/* Actividad reciente */}
          <div className="lg:col-span-5 rounded-2xl border glass-card p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="font-semibold text-sm sm:text-base text-default">
                Actividad reciente
              </h2>
            </div>

            {recentActivity.length === 0 ? (
              <EmptyState title="Sin actividad reciente" />
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => {
                  const isNew = activity.createdAt.getTime() === activity.updatedAt.getTime();
                  const icon = isNew
                    ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    : <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />;

                  return (
                    <div key={activity.id} className="flex items-start gap-3 text-sm text-muted">
                      <div className="shrink-0 mt-0.5">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400">{fromNow(activity.updatedAt)}</p>
                        <p className="text-sm text-default mt-0.5">
                          {isNew ? (
                            <>Nueva postulación para <span className="font-medium">{activity.job.title}</span></>
                          ) : (
                            <>
                              Actualización en <span className="font-medium">{activity.job.title}</span>
                              {activity.status !== "SUBMITTED" && (
                                <span className="text-xs text-muted ml-1">({activity.status.toLowerCase()})</span>
                              )}
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

/* ================= UI helpers ================= */
function KpiCard({
  label, value, tone = "zinc", badge,
}: {
  label: string;
  value: string | number;
  tone?: "zinc" | "emerald" | "amber" | "blue" | "violet";
  badge?: string;
}) {
  const tones: Record<string, { card: string; accent: string }> = {
    zinc:   { card: "glass-card", accent: "bg-zinc-100 dark:bg-zinc-800" },
    emerald:{ card: "glass-card border-emerald-300/50 dark:border-emerald-400/20 bg-emerald-50/60 dark:bg-emerald-900/20", accent: "bg-emerald-100 dark:bg-emerald-800" },
    amber:  { card: "glass-card border-amber-300/50 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-900/20",   accent: "bg-amber-100 dark:bg-amber-800" },
    blue:   { card: "glass-card border-blue-300/50 dark:border-blue-400/20 bg-blue-50/60 dark:bg-blue-900/20",     accent: "bg-blue-100 dark:bg-blue-800" },
    violet: { card: "glass-card border-violet-300/50 dark:border-violet-400/20 bg-violet-50/60 dark:bg-violet-900/20", accent: "bg-violet-100 dark:bg-violet-800" },
  };
  const t = tones[tone] ?? tones.zinc;

  return (
    <div className={clsx("rounded-xl border shadow-sm hover:shadow-md transition p-3", t.card)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={clsx("h-5 w-5 rounded-md shrink-0", t.accent)} />
        {badge && (
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-muted leading-tight">
        {label}
      </p>
      <p className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-default">{value}</p>
    </div>
  );
}

function EmptyState({
  title, body, ctaHref, ctaLabel,
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed text-center glass-card p-5 sm:p-8">
      <p className="text-sm sm:text-base font-medium text-default">{title}</p>
      {body && <p className="mt-1 text-xs sm:text-sm text-muted">{body}</p>}
      {ctaHref && ctaLabel && (
        <div className="mt-4">
          <Link href={ctaHref} className="btn-ghost text-sm">{ctaLabel}</Link>
        </div>
      )}
    </div>
  );
}