// app/dashboard/jobs/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import AutoSubmitJobStatus from "@/components/dashboard/AutoSubmitJobStatus";
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
  });
  return `/dashboard/jobs?${p.toString()}`;
}

function sortIndicator(sp: SearchParams, field: NonNullable<SearchParams["sort"]>) {
  if (sp.sort !== field) return null;
  return (
    <span className="ml-1 text-[10px] align-middle text-zinc-500">
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
      <main className="mx-auto max-w-[1600px] px-6 lg:px-10 py-10">
        <h2 className="text-2xl font-bold mb-2">Vacantes</h2>
        <p className="text-sm text-zinc-500">No hay empresa asociada a tu sesión.</p>
      </main>
    );
  }

  // Normaliza filtros
  const sp: Required<Pick<SearchParams, "title" | "location" | "date" | "sort" | "dir" | "status">> =
    {
      title: (searchParams.title || "").trim(),
      location: (searchParams.location || "").trim(),
      date: (searchParams.date as any) || "any",
      sort: (searchParams.sort as any) || "createdAt",
      dir: (searchParams.dir as any) || "desc",
      status: (searchParams.status as any) || "OPEN",
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
  const jobs = await prisma.job.findMany({
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

  return (
    <main className="mx-auto max-w-[1600px] px-6 lg:px-10 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold leading-tight">Vacantes</h1>
          <p className="text-sm text-zinc-600">Gestiona y monitorea tus vacantes.</p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
        >
          + Publicar vacante
        </Link>
      </div>

      {/* Métricas rápidas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border glass-card p-4 md:p-6">
          <p className="text-xs text-zinc-500">Abiertas</p>
          <p className="mt-1 text-2xl font-semibold">{openCount}</p>
        </div>
        <div className="rounded-2xl border glass-card p-4 md:p-6">
          <p className="text-xs text-zinc-500">Pausadas/Cerradas</p>
          <p className="mt-1 text-2xl font-semibold">{pausedCount + closedCount}</p>
        </div>
        <div className="rounded-2xl border glass-card p-4 md:p-6">
          <p className="text-xs text-zinc-500">Postulaciones</p>
          <p className="mt-1 text-2xl font-semibold">{totalApplications}</p>
        </div>
        <div className="rounded-2xl border glass-card p-4 md:p-6">
          <p className="text-xs text-zinc-500">Por revisar</p>
          <p className="mt-1 text-2xl font-semibold">{totalPending}</p>
        </div>
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
        <div className="rounded-2xl border border-dashed p-8 text-center glass-card p-4 md:p-6">
          <p className="text-base font-medium text-zinc-800">No hay vacantes con esos filtros</p>
          <p className="mt-1 text-sm text-zinc-600">Ajusta los filtros o crea una nueva vacante.</p>
          <div className="mt-4">
            <Link href="/dashboard/jobs/new" className="text-sm border rounded px-3 py-1 hover:bg-gray-50">
              Publicar vacante
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border glass-card p-4 md:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-zinc-600 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 w-[40%]">
                    <a href={toggleSortLink(sp, "title")} className="inline-flex items-center">
                      Vacante {sortIndicator(sp, "title")}
                    </a>
                  </th>
                  <th className="py-3 px-4 text-center">
                    <a href={toggleSortLink(sp, "total")} className="inline-flex items-center">
                      Postulaciones {sortIndicator(sp, "total")}
                    </a>
                  </th>
                  <th className="py-3 px-4 text-center">
                    <a href={toggleSortLink(sp, "pending")} className="inline-flex items-center">
                      Por revisar {sortIndicator(sp, "pending")}
                    </a>
                  </th>
                  <th className="py-3 px-4">
                    <a href={toggleSortLink(sp, "createdAt")} className="inline-flex items-center">
                      Fecha {sortIndicator(sp, "createdAt")}
                    </a>
                  </th>
                  <th className="py-3 px-4">
                    <a href={toggleSortLink(sp, "status")} className="inline-flex items-center">
                      Estatus {sortIndicator(sp, "status")}
                    </a>
                  </th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((j) => {
                  const total = j._count.applications || 0;
                  const pending = pendingMap.get(j.id) || 0;

                  return (
                    <tr key={j.id} className="border-t">
                      <td className="py-3 px-4 align-top">
                        <Link
                          href={`/dashboard/jobs/${j.id}/applications`}
                          className="font-medium hover:underline"
                          title="Ver postulaciones"
                        >
                          {j.title}
                        </Link>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {j.remote ? "Remoto" : j.location || "—"}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center align-top">
                        <span className="inline-flex justify-center rounded-full border bg-gray-50 px-2 py-0.5 text-[12px]">
                          {total}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center align-top">
                        <span className="inline-flex justify-center rounded-full border bg-amber-50 px-2 py-0.5 text-[12px] text-amber-800 border-amber-200">
                          {pending}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-top">
                        {new Date(j.createdAt).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3 px-4 align-top">
                        <AutoSubmitJobStatus
                          jobId={j.id}
                          defaultValue={j.status}
                          updateAction={async (fd) => {
                            "use server";
                            const companyId2 = await getSessionCompanyId().catch(() => null);
                            if (!companyId2) return;
                            const jobId = String(fd.get("jobId") || "");
                            const nextStatus = String(fd.get("status") || "");
                            if (!jobId || !nextStatus) return;
                            await prisma.job.update({
                              where: { id: jobId, companyId: companyId2 },
                              data: { status: nextStatus as any },
                            });
                          }}
                          labels={STATUS_LABEL}
                        />
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="flex items-center justify-end">
                          <JobActionsMenu
                            jobId={j.id}
                            editHref={`/dashboard/jobs/${j.id}/edit`}
                            applicationsHref={`/dashboard/jobs/${j.id}/applications`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 text-xs text-zinc-500 border-t glass-card p-4 md:p-6">
            <span>
              Mostrando <strong>{sorted.length}</strong> vacante{sorted.length === 1 ? "" : "s"}
            </span>
            <span>Página 1 / 1</span>
          </div>
        </div>
      )}
    </main>
  );
}
