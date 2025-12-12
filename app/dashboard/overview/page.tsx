// app/dashboard/overview/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { fromNow } from "@/lib/dates";
import SetupChecklist from "../components/SetupChecklist";
import BannerEmailUnverified from "../components/BannerEmailUnverified";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clsx from "clsx";
import { Eye, Users, Pencil } from "lucide-react";

const nf = (n: number) => new Intl.NumberFormat("es-MX").format(n);
const d7 = 7 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  // 🔐 Tomamos todo desde la sesión de next-auth
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const companyId = user?.companyId as string | undefined;

  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-10">
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

  // Usuario en BD (para emailVerified, etc.)
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

  // KPIs
  const [openJobs, appsTotal, apps7d, candidates] = await Promise.all([
    prisma.job.count({ where: { companyId } }),
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({
      where: { job: { companyId }, createdAt: { gte: new Date(Date.now() - d7) } },
    }),
    prisma.user.count({ where: { role: "CANDIDATE" } }),
  ]);

  const recent = await prisma.application.findMany({
    where: { job: { companyId } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: { select: { name: true } },
          updatedAt: true,
        },
      },
      candidate: { select: { name: true, email: true } },
    },
  });

  const myJobs = await prisma.job.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      location: true,
      employmentType: true,
      remote: true,
      updatedAt: true,
      company: { select: { name: true, logoUrl: true } },
      _count: { select: { applications: true } },
    },
  });

  const emailUnverified = !dbUser?.emailVerified;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-4 space-y-6">
        {/* Header */}
        <div className="sticky top-12 z-30">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border glass-card p-4 md:p-6">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold leading-tight text-default">Panel</h1>

              {/* Badge con logo + nombre de la empresa */}
              {company && (
                <span className="inline-flex items-center gap-2 badge">
                  {company.logoUrl && (
                    <Image
                      src={company.logoUrl}
                      alt={company.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-sm object-contain"
                    />
                  )}
                  <span className="text-default">{company.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link href="/dashboard/jobs/new" className="btn btn-primary">
                + Publicar vacante
              </Link>
              <Link href="/dashboard/jobs" className="btn-ghost">
                Administrar vacantes
              </Link>
              <Link href="/dashboard/billing" className="btn-ghost">
                Facturación y plan
              </Link>
            </div>
          </header>
        </div>

        {/* Banner si el correo NO está verificado */}
        {emailUnverified && <BannerEmailUnverified />}

        {/* Checklist de configuración */}
        <SetupChecklist
          user={{
            name: dbUser?.name ?? (user?.name as string) ?? null,
            emailVerified: dbUser?.emailVerified ?? null,
          }}
          profile={profile}
          company={company}
        />

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="Vacantes abiertas" value={nf(openJobs)} tone="emerald" />
          <KpiCard label="Postulaciones totales" value={nf(appsTotal)} tone="blue" />
          <KpiCard label="Postulaciones últimos 7 días" value={nf(apps7d)} tone="violet" />
          <KpiCard label="Candidatos registrados" value={nf(candidates)} tone="zinc" />
        </section>

        {/* Grids */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Vacantes recientes */}
          <div className="lg:col-span-8 rounded-2xl border glass-card p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-default">Vacantes recientes</h2>
              <Link
                href="/dashboard/jobs"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ver todas →
              </Link>
            </div>

            {myJobs.length === 0 ? (
              <EmptyState
                title="Aún no hay vacantes"
                body="Publica tu primera vacante y empezará a aparecer aquí."
                ctaHref="/dashboard/jobs/new"
                ctaLabel="Publicar vacante"
              />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {myJobs.map((j) => {
                  const hasApps = j._count.applications > 0;
                  return (
                    <li key={j.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {/* mini logo en la línea del título */}
                            {j.company?.logoUrl && (
                              <Image
                                src={j.company.logoUrl}
                                alt={j.company?.name ?? "Logo"}
                                width={16}
                                height={16}
                                className="h-4 w-4 rounded-sm object-contain"
                              />
                            )}
                            <Link
                              href={`/dashboard/jobs/${j.id}`}
                              className="font-medium hover:underline text-default"
                            >
                              {j.title}
                            </Link>
                            <span className="text-[11px] text-muted">
                              · {j.location ?? "—"}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {j.employmentType ?? "—"} ·{" "}
                            {j.remote ? "Remoto" : "Presencial/Híbrido"}
                          </p>
                          <p className="text-[11px] text-muted mt-1">
                            Actualizada {fromNow(j.updatedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right flex flex-col items-end gap-2">
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full px-2 py-1 text-[11px] gap-1 border",
                              hasApps
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-500/40 dark:text-emerald-100"
                                : "bg-zinc-50 text-zinc-500 border-zinc-200/60 dark:bg-zinc-900/40 dark:border-zinc-700/60 dark:text-zinc-300"
                            )}
                          >
                            <Users className="h-3 w-3" />
                            {j._count.applications} postul.
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/dashboard/jobs/${j.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/70 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                              title="Ver vacante"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Ver vacante</span>
                            </Link>
                            <Link
                              href={`/dashboard/jobs/${j.id}/applications`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/70 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                              title="Ver candidatos"
                            >
                              <Users className="h-4 w-4" />
                              <span className="sr-only">Ver candidatos</span>
                            </Link>
                            <Link
                              href={`/dashboard/jobs/${j.id}/edit`}
                              className="inline-flex h-8 w-8 items-center justifycenter rounded-lg border border-zinc-200/70 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                              title="Editar vacante"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar vacante</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Postulaciones recientes */}
          <div className="lg:col-span-4 rounded-2xl border glass-card p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-default">Postulaciones recientes</h2>
              <Link
                href="/dashboard/applications"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
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
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-zinc-100/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 px-3 py-2.5 flex items-start justify-between gap-3 hover:border-blue-200 hover:bg-blue-50/60 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/40 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-default truncate">
                        {r.candidate?.name || "Candidato sin nombre"}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {r.job?.title ?? "Vacante eliminada"} · {fromNow(r.createdAt)}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {r.candidate?.email || "—"}
                      </p>
                    </div>
                    {r.status && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-500/40">
                        {r.status}
                      </span>
                    )}
                  </div>
                ))}
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
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: string | number;
  tone?: "zinc" | "emerald" | "amber" | "blue" | "violet";
}) {
  const tones: Record<
    string,
    { card: string; accent: string }
  > = {
    zinc: {
      card: "glass-card",
      accent: "bg-zinc-100 dark:bg-zinc-800",
    },
    emerald: {
      card:
        "glass-card border-emerald-300/50 dark:border-emerald-400/20 bg-emerald-50/60 dark:bg-emerald-900/20",
      accent: "bg-emerald-100 dark:bg-emerald-800",
    },
    amber: {
      card:
        "glass-card border-amber-300/50 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-900/20",
      accent: "bg-amber-100 dark:bg-amber-800",
    },
    blue: {
      card:
        "glass-card border-blue-300/50 dark:border-blue-400/20 bg-blue-50/60 dark:bg-blue-900/20",
      accent: "bg-blue-100 dark:bg-blue-800",
    },
    violet: {
      card:
        "glass-card border-violet-300/50 dark:border-violet-400/20 bg-violet-50/60 dark:bg-violet-900/20",
      accent: "bg-violet-100 dark:bg-violet-800",
    },
  };

  const t = tones[tone] ?? tones.zinc;

  return (
    <div
      className={clsx(
        // 🔽 menos padding y borde un poco más compacto
        "rounded-xl border shadow-sm hover:shadow-md transition flex items-center gap-3 p-3 md:p-4",
        t.card
      )}
    >
      {/* 🔽 indicador más pequeño */}
      <div className={clsx("h-6 w-6 rounded-lg", t.accent)} />
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        {/* 🔽 número menos gigante */}
        <p className="mt-1 text-2xl md:text-3xl font-bold text-default">{value}</p>
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
    <div className="rounded-2xl border border-dashed text-center glass-card p-6 md:p-8">
      <p className="text-base font-medium text-default">{title}</p>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
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
