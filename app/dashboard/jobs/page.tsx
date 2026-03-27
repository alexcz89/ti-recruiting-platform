// app/dashboard/jobs/page.tsx
import Link from "next/link";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import JobActionsMenu from "@/components/dashboard/JobActionsMenu";
import JobsFilterBar from "@/components/dashboard/JobsFilterBar";
import AssignTemplateModalTrigger from "@/components/dashboard/AssignTemplateModalTrigger";
import { Briefcase, Users, Clock, CheckCircle2, Plus } from "lucide-react";

export const metadata = { title: "Vacantes | Panel" };

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  PAUSED: "Pausada",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50",
  PAUSED: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800/50",
  CLOSED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

type SearchParams = {
  title?: string;
  location?: string;
  date?: "any" | "7" | "30" | "90";
  sort?: "title" | "total" | "pending" | "createdAt" | "status";
  dir?: "asc" | "desc";
  status?: "ALL" | "OPEN" | "PAUSED" | "CLOSED";
  filter?: "pending" | "no-applications";
  assignTemplate?: string;
};

const DATE_WINDOWS: Array<{ value: NonNullable<SearchParams["date"]>; label: string; days?: number }> = [
  { value: "any", label: "Cualquier fecha" },
  { value: "7",   label: "Últimos 7 días",  days: 7  },
  { value: "30",  label: "Últimos 30 días", days: 30 },
  { value: "90",  label: "Últimos 90 días", days: 90 },
];

function toggleSortLink(sp: SearchParams, field: NonNullable<SearchParams["sort"]>) {
  const isSame = sp.sort === field;
  const nextDir: SearchParams["dir"] = isSame ? (sp.dir === "asc" ? "desc" : "asc") : "asc";
  const p = new URLSearchParams({
    title: sp.title || "", location: sp.location || "",
    date: sp.date || "any", status: sp.status || "OPEN",
    sort: field, dir: nextDir || "asc",
    ...(sp.filter && { filter: sp.filter }),
  });
  return `/dashboard/jobs?${p.toString()}`;
}

function sortIndicator(sp: SearchParams, field: NonNullable<SearchParams["sort"]>) {
  if (sp.sort !== field) return null;
  return <span className="ml-1 text-[10px] text-zinc-400">{sp.dir === "asc" ? "▲" : "▼"}</span>;
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No hay empresa asociada a tu sesión.</p>
        </div>
      </main>
    );
  }

  const sp = {
    title:          (searchParams.title || "").trim(),
    location:       (searchParams.location || "").trim(),
    date:           (searchParams.date as any) || "any",
    sort:           (searchParams.sort as any) || "createdAt",
    dir:            (searchParams.dir as any) || "desc",
    status:         (searchParams.status as any) || "OPEN",
    filter:         searchParams.filter,
    assignTemplate: searchParams.assignTemplate,
  };

  let createdAtGte: Date | undefined;
  const win = DATE_WINDOWS.find(w => w.value === sp.date);
  if (win?.days) createdAtGte = new Date(Date.now() - win.days * 86400000);

  // ── Métricas
  const allJobs = await prisma.job.findMany({
    where: { companyId },
    select: { id: true, status: true, title: true, location: true, remote: true },
  });
  const allJobIds = allJobs.map(j => j.id);
  const openCount   = allJobs.filter(j => j.status === "OPEN").length;
  const pausedCount = allJobs.filter(j => j.status === "PAUSED").length;
  const closedCount = allJobs.filter(j => j.status === "CLOSED").length;

  const totalApplications = allJobIds.length
    ? await prisma.application.count({ where: { jobId: { in: allJobIds } } }) : 0;
  const totalPending = allJobIds.length
    ? await prisma.application.count({ where: { jobId: { in: allJobIds }, status: "SUBMITTED" } }) : 0;

  // ── Listado filtrado
  const where: any = { companyId };
  if (sp.status && sp.status !== "ALL") where.status = sp.status;
  if (sp.title)    where.title    = { contains: sp.title, mode: "insensitive" };
  if (sp.location) {
    if (sp.location === "REMOTE") { where.remote = true; }
    else { where.remote = false; where.location = sp.location; }
  }
  if (createdAtGte) where.createdAt = { gte: createdAtGte };

  let jobs = await prisma.job.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, location: true, remote: true,
      createdAt: true, status: true,
      _count: { select: { applications: true } },
      assessments: { select: { templateId: true } },
    },
  });

  const byJobPending = await prisma.application.groupBy({
    by: ["jobId"],
    where: { jobId: { in: jobs.map(j => j.id) }, status: "SUBMITTED" },
    _count: { _all: true },
  });
  const pendingMap = new Map<string, number>();
  for (const row of byJobPending) pendingMap.set(row.jobId, row._count._all);

  if (sp.filter === "pending") {
    jobs = jobs.filter(j => (pendingMap.get(j.id) || 0) > 0);
  } else if (sp.filter === "no-applications") {
    const cutoff = new Date(Date.now() - 15 * 86400000);
    jobs = jobs.filter(j => j._count.applications === 0 && new Date(j.createdAt) < cutoff);
  }

  const titleOptions     = Array.from(new Set(allJobs.map(j => j.title))).sort((a,b) => a.localeCompare(b,"es"));
  const uniqueLocations  = Array.from(new Set(allJobs.filter(j => !j.remote && j.location).map(j => j.location as string))).sort((a,b) => a.localeCompare(b,"es"));

  const sorted = [...jobs].sort((a, b) => {
    const m = sp.dir === "asc" ? 1 : -1;
    switch (sp.sort) {
      case "title":    return m * a.title.localeCompare(b.title, "es");
      case "total":    return m * ((a._count.applications||0) - (b._count.applications||0));
      case "pending":  return m * ((pendingMap.get(a.id)||0) - (pendingMap.get(b.id)||0));
      case "status": { const o = ["OPEN","PAUSED","CLOSED"]; return m * (o.indexOf(a.status)-o.indexOf(b.status)); }
      default:         return m * (new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());
    }
  });

  const activeFilterLabel =
    sp.filter === "pending"          ? "Con candidatos por revisar" :
    sp.filter === "no-applications"  ? "Sin postulaciones (>15 días)" : null;

  // ── Modal data
  const allTemplates = sp.assignTemplate
    ? await prisma.assessmentTemplate.findMany({
        where: { isActive: true },
        select: { id:true, title:true, description:true, difficulty:true, type:true, totalQuestions:true, timeLimit:true, passingScore:true },
        orderBy: { title: "asc" },
      }) : [];

  const jobsWithAssessmentsMap = new Map(jobs.map(j => [j.id, j.assessments.map(a => a.templateId)]));
  const missingIds = sp.assignTemplate ? allJobIds.filter(id => !jobsWithAssessmentsMap.has(id)) : [];
  const missingAssessments = missingIds.length
    ? await prisma.jobAssessment.findMany({ where: { jobId: { in: missingIds } }, select: { jobId:true, templateId:true } }) : [];
  const missingMap = new Map<string, string[]>();
  for (const a of missingAssessments) {
    if (!missingMap.has(a.jobId)) missingMap.set(a.jobId, []);
    missingMap.get(a.jobId)!.push(a.templateId);
  }

  const allJobsForModal = allJobs.map(j => ({
    id: j.id, title: j.title, location: j.location ?? null, remote: j.remote, status: j.status,
    assignedTemplateIds: jobsWithAssessmentsMap.get(j.id) ?? missingMap.get(j.id) ?? [],
  }));

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AssignTemplateModalTrigger jobs={allJobsForModal} templates={allTemplates as any} />

      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-10 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {/* Banner asignar template */}
        {sp.assignTemplate && (
          <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800/50 dark:bg-violet-950/20">
            <div className="h-2 w-2 shrink-0 rounded-full bg-violet-500 animate-pulse" />
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
              Elige una vacante para asignar el template de evaluación.
            </p>
            <Link href="/dashboard/jobs" className="ml-auto shrink-0 text-xs font-bold text-violet-600 hover:underline dark:text-violet-400">
              Cancelar
            </Link>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Panel de reclutador
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                Vacantes
              </h1>
              {activeFilterLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 dark:bg-amber-900/40 dark:border-amber-500/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  🔍 {activeFilterLabel}
                  <Link href="/dashboard/jobs" className="hover:opacity-70" title="Quitar filtro">✕</Link>
                </span>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/jobs/new"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Publicar vacante</span>
            <span className="sm:hidden">Publicar</span>
          </Link>
        </div>

        {/* ── Métricas ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Abiertas",          value: openCount,                    icon: Briefcase,    color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Pausadas/Cerradas", value: pausedCount + closedCount,    icon: Clock,        color: "text-zinc-700 dark:text-zinc-300" },
            { label: "Postulaciones",     value: totalApplications,            icon: Users,        color: "text-blue-600 dark:text-blue-400" },
            { label: "Por revisar",       value: totalPending,                 icon: CheckCircle2, color: "text-amber-600 dark:text-amber-400", accent: true },
          ].map(({ label, value, icon: Icon, color, accent }) => (
            <div key={label} className="rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-800/50 dark:bg-zinc-900/80 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 leading-tight">
                  {label}
                </p>
                {accent && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                    Prio
                  </span>
                )}
              </div>
              <p className={`mt-1 text-2xl sm:text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-800/50 dark:bg-zinc-900/80 p-3 sm:p-4 shadow-sm">
          <JobsFilterBar
            titleOptions={titleOptions}
            locationOptions={uniqueLocations}
            sp={sp}
            dateWindows={DATE_WINDOWS.map(({ value, label }) => ({ value, label }))}
          />
        </div>

        {/* ── Contenido ── */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-base font-bold text-zinc-800 dark:text-zinc-100">
              {activeFilterLabel ? `No hay vacantes ${activeFilterLabel.toLowerCase()}` : "Sin vacantes"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {activeFilterLabel
                ? <><Link href="/dashboard/jobs" className="text-blue-600 hover:underline">Quitar filtro</Link> o ajusta criterios.</>
                : "Crea tu primera vacante para empezar a recibir postulaciones."}
            </p>
            {!activeFilterLabel && (
              <Link href="/dashboard/jobs/new" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition">
                <Plus className="h-4 w-4" /> Publicar vacante
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Vista desktop: tabla ── */}
            <div className="hidden md:block rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-800/50 dark:bg-zinc-900/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 w-[38%]">
                        <Link href={toggleSortLink(sp, "title")} className="inline-flex items-center hover:text-zinc-700 dark:hover:text-zinc-200">
                          Vacante{sortIndicator(sp, "title")}
                        </Link>
                      </th>
                      <th className="py-3 px-4">Evaluación</th>
                      <th className="py-3 px-4 text-center">
                        <Link href={toggleSortLink(sp, "total")} className="inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200">
                          Postulaciones{sortIndicator(sp, "total")}
                        </Link>
                      </th>
                      <th className="py-3 px-4 text-center">
                        <Link href={toggleSortLink(sp, "pending")} className="inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200">
                          Por revisar{sortIndicator(sp, "pending")}
                        </Link>
                      </th>
                      <th className="py-3 px-4">
                        <Link href={toggleSortLink(sp, "createdAt")} className="inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200">
                          Fecha{sortIndicator(sp, "createdAt")}
                        </Link>
                      </th>
                      <th className="py-3 px-4">Estatus</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {sorted.map(j => {
                      const total   = j._count.applications || 0;
                      const pending = pendingMap.get(j.id) || 0;
                      const assignedCount = j.assessments?.length ?? 0;

                      return (
                        <tr key={j.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              href={`/dashboard/jobs/${j.id}/applications`}
                              className="font-semibold text-zinc-900 dark:text-zinc-50 hover:underline"
                            >
                              {j.title}
                            </Link>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {j.remote ? "Remoto" : j.location || "—"}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {assignedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                                ✓ {assignedCount} template{assignedCount > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <Link
                                href="/dashboard/assessments/templates"
                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-600 dark:hover:text-violet-400 transition whitespace-nowrap"
                              >
                                + Asignar
                              </Link>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex min-w-[2rem] justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                              {total}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex min-w-[2rem] justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              pending > 0
                                ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200"
                                : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                            }`}>
                              {pending}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                            {new Date(j.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLE[j.status] || STATUS_STYLE.CLOSED}`}>
                              {STATUS_LABEL[j.status] || j.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <JobActionsMenu jobId={j.id} currentStatus={j.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Mostrando <strong>{sorted.length}</strong> vacante{sorted.length !== 1 ? "s" : ""}</span>
                <span>Página 1 / 1</span>
              </div>
            </div>

            {/* ── Vista mobile: cards ── */}
            <div className="md:hidden space-y-3">
              {sorted.map(j => {
                const total         = j._count.applications || 0;
                const pending       = pendingMap.get(j.id) || 0;
                const assignedCount = j.assessments?.length ?? 0;

                return (
                  <div key={j.id} className="rounded-2xl border border-zinc-200/80 bg-white/90 dark:border-zinc-800/50 dark:bg-zinc-900/80 shadow-sm overflow-hidden">
                    {/* Top accent by status */}
                    <div className={`h-1 w-full ${j.status === "OPEN" ? "bg-emerald-500" : j.status === "PAUSED" ? "bg-yellow-400" : "bg-zinc-300"}`} />

                    <div className="p-4 space-y-3">
                      {/* Título + estatus */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/dashboard/jobs/${j.id}/applications`}
                            className="font-bold text-zinc-900 dark:text-zinc-50 hover:underline leading-tight"
                          >
                            {j.title}
                          </Link>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {j.remote ? "Remoto" : j.location || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[j.status] || STATUS_STYLE.CLOSED}`}>
                            {STATUS_LABEL[j.status] || j.status}
                          </span>
                          <JobActionsMenu jobId={j.id} currentStatus={j.status} />
                        </div>
                      </div>

                      {/* Métricas */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50 py-2">
                          <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{total}</p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Postulaciones</p>
                        </div>
                        <div className={`flex flex-col items-center rounded-xl py-2 ${
                          pending > 0
                            ? "bg-amber-50 dark:bg-amber-950/30"
                            : "bg-zinc-50 dark:bg-zinc-800/50"
                        }`}>
                          <p className={`text-lg font-black ${pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>{pending}</p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Por revisar</p>
                        </div>
                        <div className="flex flex-col items-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50 py-2">
                          <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 text-center leading-tight px-1">
                            {new Date(j.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">Fecha</p>
                        </div>
                      </div>

                      {/* Evaluación */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Evaluación</span>
                        {assignedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            ✓ {assignedCount} template{assignedCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <Link
                            href="/dashboard/assessments/templates"
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-violet-400 hover:text-violet-600 transition"
                          >
                            + Asignar evaluación
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <p className="text-center text-xs text-zinc-400 py-2">
                {sorted.length} vacante{sorted.length !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <article className="rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-800/50 dark:bg-zinc-900/80 p-3 sm:p-4 shadow-sm flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 leading-tight">{label}</p>
      <p className={`text-2xl sm:text-3xl font-black ${accent ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
    </article>
  );
}