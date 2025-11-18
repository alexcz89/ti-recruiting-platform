// app/dashboard/overview/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import Link from "next/link";
import Image from "next/image";
import { fromNow } from "@/lib/dates";
import SetupChecklist from "../components/SetupChecklist";
import BannerEmailUnverified from "../components/BannerEmailUnverified";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const nf = (n: number) => new Intl.NumberFormat("es-MX").format(n);
const d7 = 7 * 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const companyId = await getSessionCompanyId().catch(() => null);

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

  // Sesión y datos para banner/checklist
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email || null;

  const dbUser = sessionEmail
    ? await prisma.user.findUnique({
        where: { email: sessionEmail },
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
              <h1 className="text-3xl font-bold leading-tight text-default">Overview</h1>

              {/* Badge con logo + nombre de la empresa */}
              {company?.logoUrl && (
                <span className="inline-flex items-center gap-2 badge">
                  <Image
                    src={company.logoUrl}
                    alt={company?.name ?? "Logo"}
                    width={20}
                    height={20}
                    className="h-5 w-5 rounded-sm object-contain"
                  />
                  <span className="text-default">{company?.name}</span>
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
          user={{ name: (session?.user as any)?.name ?? null }}
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
                {myJobs.map((j) => (
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
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] badge">
                          {j._count.applications} postul.
                        </span>
                        <div className="mt-2 flex items-center gap-1">
                          <Link
                            href={`/dashboard/jobs/${j.id}`}
                            className="btn-ghost text-xs"
                            title="Ver Pipeline"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/dashboard/jobs/${j.id}/applications`}
                            className="btn-ghost text-xs"
                            title="Ver candidatos"
                          >
                            Candidatos
                          </Link>
                          <Link
                            href={`/dashboard/jobs/${j.id}/edit`}
                            className="btn-ghost text-xs"
                            title="Editar"
                          >
                            Editar
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
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
              <div className="overflow-x-auto rounded-xl soft-panel p-0 border-0">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left">
                    <tr className="text-muted">
                      <th className="py-2.5 px-3.5 font-medium">Candidato</th>
                      <th className="py-2.5 px-3.5 font-medium">Email</th>
                      <th className="py-2.5 px-3.5 font-medium">Vacante</th>
                      <th className="py-2.5 px-3.5 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recent.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={`transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                          idx % 2 === 1
                            ? "bg-zinc-50/50 dark:bg-zinc-900/30"
                            : ""
                        }`}
                      >
                        <td className="py-2.5 px-3.5 text-default">
                          {r.candidate?.name || "—"}
                        </td>
                        <td className="py-2.5 px-3.5 text-default whitespace-nowrap">
                          {r.candidate?.email || "—"}
                        </td>
                        <td className="py-2.5 px-3.5 text-default">
                          {r.job?.id ? (
                            <Link
                              href={`/dashboard/jobs/${r.job.id}/applications`}
                              className="hover:underline"
                            >
                              {r.job?.title ?? "—"}
                            </Link>
                          ) : (
                            r.job?.title ?? "—"
                          )}
                          <span className="ml-1 text-xs text-muted">
                            ({r.job?.company?.name ?? "—"})
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-3.5 text-default whitespace-nowrap"
                          title={new Date(r.createdAt).toLocaleString()}
                        >
                          {fromNow(r.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  const tones: Record<string, string> = {
    zinc: "glass-card p-4 md:p-6",
    emerald:
      "glass-card p-4 md:p-6 border-emerald-300/50 dark:border-emerald-400/20 bg-emerald-50/60 dark:bg-emerald-900/20",
    amber:
      "glass-card p-4 md:p-6 border-amber-300/50 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-900/20",
    blue:
      "glass-card p-4 md:p-6 border-blue-300/50 dark:border-blue-400/20 bg-blue-50/60 dark:bg-blue-900/20",
    violet:
      "glass-card p-4 md:p-6 border-violet-300/50 dark:border-violet-400/20 bg-violet-50/60 dark:bg-violet-900/20",
  };
  return (
    <div className={`rounded-2xl border shadow-sm hover:shadow-md transition ${tones[tone]}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-4xl font-bold text-default">{value}</p>
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
