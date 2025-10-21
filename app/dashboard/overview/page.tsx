// app/dashboard/overview/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import Link from "next/link";
import { fromNow } from "@/lib/dates";

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
      job: { select: { id: true, title: true, company: { select: { name: true } }, updatedAt: true } },
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
      _count: { select: { applications: true } },
    },
  });

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-10 space-y-10">
        {/* Header */}
        <div className="sticky top-16 z-30 -mx-2 px-2">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-4 py-3 shadow-sm">
            <div>
              <h1 className="text-3xl font-bold leading-tight">Overview</h1>
              <p className="text-sm text-zinc-600">
                Resumen de vacantes y postulaciones de tu empresa.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/jobs/new"
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
              >
                + Publicar vacante
              </Link>
              <Link
                href="/dashboard/jobs"
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Administrar vacantes
              </Link>
            </div>
          </header>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="Vacantes abiertas" value={nf(openJobs)} tone="emerald" />
          <KpiCard label="Postulaciones totales" value={nf(appsTotal)} tone="blue" />
          <KpiCard label="Postulaciones últimos 7 días" value={nf(apps7d)} tone="violet" />
          <KpiCard label="Candidatos registrados" value={nf(candidates)} />
        </section>

        {/* Grids */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Vacantes recientes */}
          <div className="lg:col-span-8 rounded-2xl border bg-white/85 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Vacantes recientes</h2>
              <Link href="/dashboard/jobs" className="text-sm text-blue-600 hover:underline">
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
              <ul className="divide-y">
                {myJobs.map((j) => (
                  <li key={j.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/jobs/${j.id}`} className="font-medium hover:underline">
                            {j.title}
                          </Link>
                          <span className="text-[11px] text-zinc-500">· {j.location ?? "—"}</span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {j.employmentType ?? "—"} · {j.remote ? "Remoto" : "Presencial/Híbrido"}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Actualizada {fromNow(j.updatedAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center rounded-full border bg-gray-50 px-2 py-1 text-[11px]">
                          {j._count.applications} postul.
                        </span>
                        <div className="mt-2 flex items-center gap-1">
                          <Link
                            href={`/dashboard/jobs/${j.id}`}
                            className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
                            title="Ver Kanban"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/dashboard/jobs/${j.id}/applications`}
                            className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
                            title="Ver candidatos"
                          >
                            Candidatos
                          </Link>
                          <Link
                            href={`/dashboard/jobs/${j.id}/edit`}
                            className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
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
          <div className="lg:col-span-4 rounded-2xl border bg-white/85 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Postulaciones recientes</h2>
              <Link href="/dashboard/applications" className="text-sm text-blue-600 hover:underline">
                Ver todas →
              </Link>
            </div>

            {recent.length === 0 ? (
              <EmptyState
                title="Sin postulaciones"
                body="Cuando lleguen postulaciones las verás aquí."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-zinc-600">
                    <tr>
                      <th className="py-2 px-3">Candidato</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Vacante</th>
                      <th className="py-2 px-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 px-3">{r.candidate?.name || "—"}</td>
                        <td className="py-2 px-3">{r.candidate?.email || "—"}</td>
                        <td className="py-2 px-3">
                          {r.job?.id ? (
                            <Link href={`/dashboard/jobs/${r.job.id}/applications`} className="hover:underline">
                              {r.job?.title ?? "—"}
                            </Link>
                          ) : (
                            r.job?.title ?? "—"
                          )}
                          <span className="ml-1 text-xs text-zinc-500">
                            ({r.job?.company?.name ?? "—"})
                          </span>
                        </td>
                        <td className="py-2 px-3" title={new Date(r.createdAt).toLocaleString()}>
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
    zinc: "border-zinc-200 bg-white/90",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    violet: "border-violet-200 bg-violet-50",
  };
  return (
    <div className={`rounded-2xl border p-6 shadow-sm hover:shadow-md transition ${tones[tone]}`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-4xl font-bold text-zinc-800">{value}</p>
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
    <div className="rounded-2xl border border-dashed p-8 text-center bg-white/70">
      <p className="text-base font-medium text-zinc-800">{title}</p>
      {body && <p className="mt-1 text-sm text-zinc-600">{body}</p>}
      {ctaHref && ctaLabel && (
        <div className="mt-4">
          <Link href={ctaHref} className="text-sm border rounded px-3 py-1 hover:bg-gray-50">
            {ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
