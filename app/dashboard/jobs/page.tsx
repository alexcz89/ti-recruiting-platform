// app/dashboard/jobs/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import JobActionsMenu from "@/components/dashboard/JobActionsMenu";
import JobsFilterBar from "@/components/dashboard/JobsFilterBar";

// ───────────────────── Config ─────────────────────
export const metadata = { title: "Vacantes | Panel" };

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  PAUSED: "Pausada",
};

type SearchParams = {
  title?: string;
  location?: string; // "" | "REMOTE" | "<city/location>"
  date?: "any" | "7" | "30" | "90";
  sort?: "title" | "total" | "pending" | "createdAt" | "status";
  dir?: "asc" | "desc";
  status?: "ALL" | "OPEN" | "PAUSED" | "CLOSED";
  filter?: "pending" | "no-applications"; // 🆕 Filtros especiales
};

const DATE_WINDOWS: Array<{ value: NonNullable<SearchParams["date"]>; label: string; days?: number }> =
  [
    { value: "any", label: "Cualquier fecha" },
    { value: "7", label: "Últimos 7 días", days: 7 },
    { value: "30", label: "Últimos 30 días", days: 30 },
    { value: "90", label: "Últimos 90 días", days: 90 },
  ];

// ───────────────────── Helpers UI ─────────────────────
function toggleSortLink(sp: SearchParams, field: NonNullable<SearchParams["sort"]>) {
  const isSame = sp.sort === field;
  const nextDir: SearchParams["dir"] = isSame ? (sp.dir === "asc" ? "desc" : "asc") : "asc";
  const p = new URLSearchParams({
    title: sp.title || "",
    location: sp.location || "",
    date: sp.date || "any",
    status: sp.status || "OPEN",
    sort: field,
    dir: nextDir || "asc",
    ...(sp.filter && { filter: sp.filter }),
  });
  return `/dashboard/jobs?${p.toString()}`;
}

function sortIndicator(sp: SearchParams, field: NonNullable<SearchParams["sort"]>) {
  if (sp.sort !== field) return null;
  return (
    <span className="ml-1 text-[10px] align-middle text-zinc-500 dark:text-zinc-400">
      {sp.dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

// ───────────────────── Page ─────────────────────
export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-10">
          <h2 className="text-2xl font-bold mb-2">Vacantes</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No hay empresa asociada a tu sesión.
          </p>
        </div>
      </main>
    );
  }

  // Normaliza filtros
  const sp: Required<Pick<SearchParams, "title" | "location" | "date" | "sort" | "dir" | "status">> &
    Pick<SearchParams, "filter"> = {
    title: (searchParams.title || "").trim(),
    location: (searchParams.location || "").trim(),
    date: (searchParams.date as any) || "any",
    sort: (searchParams.sort as any) || "createdAt",
    dir: (searchParams.dir as any) || "desc",
    status: (searchParams.status as any) || "OPEN",
    filter: searchParams.filter,
  };

  // Fecha desde (si aplica)
  let createdAtGte: Date | undefined = undefined;
  const win = DATE_WINDOWS.find((w) => w.value === sp.date);
  if (win?.days) {
    createdAtGte = new Date(Date.now() - win.days * 24 * 60 * 60 * 1000);
  }

  // ── Métricas rápidas
  const allJobs = await prisma.job.findMany({
    where: { companyId },
    select: { id: true, status: true, title: true, location: true, remote: true },
  });
  const allJobIds = allJobs.map((j) => j.id);
  const openCount = allJobs.filter((j) => j.status === "OPEN").length;
  const pausedCount = allJobs.filter((j) => j.status === "PAUSED").length;
  const closedCount = allJobs.filter((j) => j.status === "CLOSED").length;

  const totalApplications = allJobIds.length
    ? await prisma.application.count({ where: { jobId: { in: allJobIds } } })
    : 0;
  const totalPending = allJobIds.length
    ? await prisma.application.count({
        where: { jobId: { in: allJobIds }, status: "SUBMITTED" },
      })
    : 0;

  // ── Filtros base para listado
  const where: any = { companyId };
  if (sp.status && sp.status !== "ALL") where.status = sp.status;
  if (sp.title) where.title = { contains: sp.title, mode: "insensitive" };

  if (sp.location) {
    if (sp.location === "REMOTE") {
      where.remote = true;
    } else {
      where.remote = false;
      where.location = sp.location;
    }
  }
  if (createdAtGte) where.createdAt = { gte: createdAtGte };

  // Cargamos jobs del reclutador/empresa
  let jobs = await prisma.job.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      location: true,
      remote: true,
      createdAt: true,
      status: true,
      _count: { select: { applications: true } },
    },
  });

  // Por revisar por job
  const byJobPending = await prisma.application.groupBy({
    by: ["jobId"],
    where: { jobId: { in: jobs.map((j) => j.id) }, status: "SUBMITTED" },
    _count: { _all: true },
  });
  const pendingMap = new Map<string, number>();
  for (const row of byJobPending) pendingMap.set(row.jobId, row._count._all);

  // 🆕 Aplicar filtros especiales
  if (sp.filter === "pending") {
    // Solo vacantes con candidatos pendientes
    jobs = jobs.filter((j) => (pendingMap.get(j.id) || 0) > 0);
  } else if (sp.filter === "no-applications") {
    // Solo vacantes sin postulaciones creadas hace más de 15 días
    const d15 = 15 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - d15);
    jobs = jobs.filter(
      (j) => j._count.applications === 0 && new Date(j.createdAt) < cutoffDate
    );
  }

  // Opciones para selects (todas las vacantes)
  const titleOptions = Array.from(new Set(allJobs.map((j) => j.title))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const uniqueLocations = Array.from(
    new Set(allJobs.filter((j) => !j.remote && j.location).map((j) => j.location as string))
  ).sort((a, b) => a.localeCompare(b, "es"));

  // Ordenamiento en memoria
  const sorted = [...jobs].sort((a, b) => {
    const dirMul = sp.dir === "asc" ? 1 : -1;
    switch (sp.sort) {
      case "title":
        return dirMul * a.title.localeCompare(b.title, "es");
      case "total":
        return dirMul * ((a._count.applications || 0) - (b._count.applications || 0));
      case "pending":
        return dirMul * ((pendingMap.get(a.id) || 0) - (pendingMap.get(b.id) || 0));
      case "status": {
        const order = ["OPEN", "PAUSED", "CLOSED"];
        return dirMul * (order.indexOf(a.status) - order.indexOf(b.status));
      }
      case "createdAt":
      default:
        return dirMul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  });

  // 🆕 Badge de filtro activo
  const activeFilterLabel =
    sp.filter === "pending"
      ? "Con candidatos por revisar"
      : sp.filter === "no-applications"
      ? "Sin postulaciones (>15 días)"
      : null;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
              Panel de reclutador
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
                Vacantes
              </h1>
              {activeFilterLabel && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  🔍 {activeFilterLabel}
                  <Link
                    href="/dashboard/jobs"
                    className="hover:underline"
                    title="Quitar filtro"
                  >
                    ✕
                  </Link>
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Gestiona y monitorea tus vacantes en Bolsa TI.
            </p>
          </div>
          <Link
            href="/dashboard/jobs/new"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/80 focus-visible:ring-offset-2"
          >
            + Publicar vacante
          </Link>
        </div>

        {/* Métricas rápidas */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Abiertas" value={openCount} />
          <MetricCard label="Pausadas/Cerradas" value={pausedCount + closedCount} />
          <MetricCard label="Postulaciones" value={totalApplications} />
          <MetricCard label="Por revisar" value={totalPending} accent />
        </section>

        {/* Filtros (Client Component con auto-submit) */}
        <section className="rounded-2xl border glass-card p-4 md:p-6">
          <JobsFilterBar
            titleOptions={titleOptions}
            locationOptions={uniqueLocations}
            sp={sp}
            dateWindows={DATE_WINDOWS.map(({ value, label }) => ({ value, label }))}
          />
        </section>

        {/* Tabla */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed glass-card p-8 text-center">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
              {activeFilterLabel
                ? `No hay vacantes ${activeFilterLabel.toLowerCase()}`
                : "No hay vacantes con esos filtros"}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {activeFilterLabel ? (
                <>
                  <Link href="/dashboard/jobs" className="text-blue-600 hover:underline">
                    Quitar filtro
                  </Link>{" "}
                  o ajusta los criterios.
                </>
              ) : (
                "Ajusta los filtros o crea una nueva vacante."
              )}
            </p>
            {!activeFilterLabel && (
              <div className="mt-4">
                <Link
                  href="/dashboard/jobs/new"
                  className="text-sm border rounded-full px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-900"
                >
                  Publicar vacante
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border glass-card p-0">
            <div className="overflow-x-auto rounded-2xl">
              <table className="w-full text-sm min-w-[960px]">
                <thead className="bg-gray-50/90 dark:bg-zinc-900/70 text-left text-zinc-600 dark:text-zinc-300 sticky top-0 z-10 backdrop-blur">
                  <tr>
                    <th className="py-3.5 px-4 w-[40%]">
                      <a href={toggleSortLink(sp, "title")} className="inline-flex items-center">
                        Vacante {sortIndicator(sp, "title")}
                      </a>
                    </th>
                    <th className="py-3.5 px-4 text-center">
                      <a href={toggleSortLink(sp, "total")} className="inline-flex items-center">
                        Postulaciones {sortIndicator(sp, "total")}
                      </a>
                    </th>
                    <th className="py-3.5 px-4 text-center">
                      <a href={toggleSortLink(sp, "pending")} className="inline-flex items-center">
                        Por revisar {sortIndicator(sp, "pending")}
                      </a>
                    </th>
                    <th className="py-3.5 px-4">
                      <a
                        href={toggleSortLink(sp, "createdAt")}
                        className="inline-flex items-center"
                      >
                        Fecha {sortIndicator(sp, "createdAt")}
                      </a>
                    </th>
                    <th className="py-3.5 px-4">
                      <a href={toggleSortLink(sp, "status")} className="inline-flex items-center">
                        Estatus {sortIndicator(sp, "status")}
                      </a>
                    </th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sorted.map((j) => {
                    const total = j._count.applications || 0;
                    const pending = pendingMap.get(j.id) || 0;

                    return (
                      <tr
                        key={j.id}
                        className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/70"
                      >
                        <td className="py-3.5 px-4 align-top">
                          <Link
                            href={`/dashboard/jobs/${j.id}/applications`}
                            className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline break-anywhere"
                            title="Ver postulaciones"
                          >
                            {j.title}
                          </Link>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {j.remote ? "Remoto" : j.location || "—"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center align-top">
                          <span className="inline-flex min-w-[2.2rem] justify-center rounded-full border bg-gray-50 px-2 py-0.5 text-[12px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                            {total}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center align-top">
                          <span className="inline-flex min-w-[2.2rem] justify-center rounded-full border bg-amber-50 px-2 py-0.5 text-[12px] text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/60 dark:text-amber-100">
                            {pending}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top text-zinc-800 dark:text-zinc-100">
                          {new Date(j.createdAt).toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] text-zinc-700 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {STATUS_LABEL[j.status] || j.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center justify-end">
                            <JobActionsMenu jobId={j.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
              <span>
                Mostrando <strong>{sorted.length}</strong> vacante
                {sorted.length === 1 ? "" : "s"}
                {activeFilterLabel && ` (${activeFilterLabel.toLowerCase()})`}
              </span>
              <span>Página 1 / 1</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ─────────────────── Subcomponentes métricas ─────────────────── */

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <article className="rounded-2xl border glass-card p-4 md:p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              accent ? "text-emerald-600 dark:text-emerald-300" : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {value}
          </p>
        </div>
        {accent && (
          <span className="inline-flex h-7 items-center rounded-full bg-emerald-500/10 px-3 text-[11px] font-medium text-emerald-700 border border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100">
            Prioritario
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {label === "Abiertas" &&
          "Vacantes activas recibiendo postulaciones."}
        {label === "Pausadas/Cerradas" &&
          "Vacantes que ya no reciben nuevas postulaciones."}
        {label === "Postulaciones" &&
          "Total de CVs recibidos en todas tus vacantes."}
        {label === "Por revisar" &&
          "Candidatos marcados como pendientes por revisar."}
      </p>
    </article>
  );
}