// app/dashboard/assessments/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers, cookies } from "next/headers";
import type { ReactNode } from "react";

import AssessmentActionsMenu from "@/components/dashboard/assessments/AssessmentActionsMenu";
import { authOptions } from "@/lib/auth";
import { fromNow } from "@/lib/dates";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  Filter, 
  Search, 
  Briefcase, 
  ListChecks,
  TrendingUp,
  Users,
  AlertTriangle
} from "lucide-react";

export const metadata = { title: "Evaluaciones | Panel" };
export const dynamic = "force-dynamic";

type StateFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "INACTIVE";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeState(s: string | null): StateFilter {
  const v = String(s ?? "").toUpperCase();
  if (v === "PENDING") return "PENDING";
  if (v === "IN_PROGRESS") return "IN_PROGRESS";
  if (v === "COMPLETED") return "COMPLETED";
  if (v === "INACTIVE") return "INACTIVE";
  return "ALL";
}

function stateLabel(state: Exclude<StateFilter, "ALL">) {
  if (state === "COMPLETED") return "Completado";
  if (state === "IN_PROGRESS") return "En progreso";
  if (state === "INACTIVE") return "Inactivo";
  return "Pendiente";
}

function tone(state: Exclude<StateFilter, "ALL">) {
  if (state === "COMPLETED")
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50";
  if (state === "IN_PROGRESS")
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50";
  if (state === "INACTIVE")
    return "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-700";
  return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50";
}

function fmtScore(n: any) {
  return typeof n === "number" && Number.isFinite(n) ? `${Math.round(n)}%` : "—";
}

function buildPageHref(searchParams: Record<string, string | string[] | undefined> | undefined, nextPage: number) {
  const sp = new URLSearchParams();

  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page") continue;
      if (Array.isArray(v)) {
        if (v[0]) sp.set(k, v[0]);
      } else if (v) {
        sp.set(k, v);
      }
    }
  }

  sp.set("page", String(nextPage));
  const qs = sp.toString();
  return `/dashboard/assessments${qs ? `?${qs}` : ""}`;
}

function getBaseUrl() {
  const h = headers();

  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  const env =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  return (env ? (env.startsWith("http") ? env : `https://${env}`) : "http://localhost:3000").replace(/\/$/, "");
}

export default async function CompanyAssessmentsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const role = String((session.user as any).role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const jobId = typeof searchParams?.jobId === "string" ? searchParams.jobId.trim() : "";
  const state = normalizeState(typeof searchParams?.state === "string" ? searchParams.state : null);
  const hasAttempt = typeof searchParams?.hasAttempt === "string" ? searchParams.hasAttempt : "";
  const page = clampInt(parseInt(String(searchParams?.page ?? "1"), 10) || 1, 1, 9999);

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (jobId) qs.set("jobId", jobId);
  if (state && state !== "ALL") qs.set("state", state);
  if (hasAttempt) qs.set("hasAttempt", hasAttempt);
  qs.set("page", String(page));

  const baseUrl = getBaseUrl();
  const cookieHeader = cookies().toString();

  const res = await fetch(`${baseUrl}/api/dashboard/assessments?${qs.toString()}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <div className="mx-auto max-w-[1800px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900/50 dark:bg-red-950/20">
            <p className="text-lg font-semibold text-red-900 dark:text-red-200">Error cargando evaluaciones</p>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">Status: {res.status}</p>
          </div>
        </div>
      </main>
    );
  }

  const data = await res.json();

  const jobs: Array<{ id: string; title: string }> = data.jobs ?? [];
  const rows: any[] = data.rows ?? [];
  const total: number = data.total ?? 0;
  const totalPages: number = data.totalPages ?? 1;

  // Métricas
  const mTotal = rows.length;
  const mCompleted = rows.filter((r) => r.uiState === "COMPLETED").length;
  const mInProgress = rows.filter((r) => r.uiState === "IN_PROGRESS").length;
  const mPending = rows.filter((r) => r.uiState === "PENDING").length;
  const mInactive = rows.filter((r) => r.uiState === "INACTIVE").length;

  const scored = rows
    .map((r) => (typeof r.attempt?.totalScore === "number" ? r.attempt.totalScore : null))
    .filter((n: any) => n !== null) as number[];

  const avgScore = scored.length ? Math.round(scored.reduce((s, n) => s + n, 0) / scored.length) : 0;

  const suspicious = rows.filter((r) => {
    const sev = String(r.attempt?.severity ?? "").toUpperCase();
    return sev === "SUSPICIOUS" || sev === "CRITICAL" || r.attempt?.multiSession;
  }).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header mejorado */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50/50 to-white p-6 shadow-sm dark:border-zinc-800/50 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900">
          {/* Decoración de fondo */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 opacity-20 blur-3xl dark:from-violet-900 dark:to-blue-900 dark:opacity-10" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-20 blur-3xl dark:from-emerald-900 dark:to-teal-900 dark:opacity-10" />
          
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 p-2 shadow-lg shadow-violet-500/20">
                <ListChecks className="h-4 w-4 text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Panel de reclutador
              </span>
            </div>
            <h1 className="mt-3 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 bg-clip-text text-3xl font-black tracking-tight text-transparent dark:from-white dark:via-zinc-100 dark:to-white">
              Evaluaciones
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              Monitorea el progreso de tus candidatos, revisa resultados y gestiona evaluaciones en tiempo real.
            </p>
          </div>
        </div>

        {/* Métricas mejoradas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            label="Pendientes"
            value={mPending}
            icon={Clock}
            color="violet"
            total={mTotal}
          />
          <MetricCard
            label="En progreso"
            value={mInProgress}
            icon={TrendingUp}
            color="blue"
            total={mTotal}
          />
          <MetricCard
            label="Completadas"
            value={mCompleted}
            icon={CheckCircle2}
            color="emerald"
            total={mTotal}
          />
          <MetricCard
            label="Inactivas"
            value={mInactive}
            icon={Users}
            color="zinc"
            total={mTotal}
          />
          <MetricCard
            label="Score prom."
            value={`${avgScore}%`}
            icon={TrendingUp}
            color="teal"
            isPercentage
          />
          <MetricCard
            label="Alertas"
            value={suspicious}
            icon={AlertTriangle}
            color="amber"
            isAlert
          />
        </div>

        {/* Filtros mejorados */}
        <form className="group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md dark:border-zinc-800/50 dark:bg-zinc-900/80">
          <div className="p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              {/* Buscar */}
              <div className="sm:col-span-2 lg:col-span-5">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Buscar
                </label>
                <div className="group/input relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within/input:text-violet-500" />
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Nombre, email o assessment..."
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white/80 pl-10 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                  />
                </div>
              </div>

              {/* Vacante */}
              <div className="lg:col-span-3">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Vacante
                </label>
                <div className="group/input relative">
                  <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within/input:text-violet-500" />
                  <select
                    name="jobId"
                    defaultValue={jobId}
                    className="h-10 w-full appearance-none rounded-xl border border-zinc-200 bg-white/80 pl-10 pr-9 text-sm text-zinc-900 shadow-sm outline-none transition-all hover:border-zinc-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                  >
                    <option value="">Todas</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Estado
                </label>
                <div className="group/input relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within/input:text-violet-500" />
                  <select
                    name="state"
                    defaultValue={state}
                    className="h-10 w-full appearance-none rounded-xl border border-zinc-200 bg-white/80 pl-10 pr-9 text-sm text-zinc-900 shadow-sm outline-none transition-all hover:border-zinc-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                  >
                    <option value="ALL">Todos</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="IN_PROGRESS">En progreso</option>
                    <option value="COMPLETED">Completado</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Attempts */}
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Intentos
                </label>
                <div className="group/input relative">
                  <ListChecks className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within/input:text-violet-500" />
                  <select
                    name="hasAttempt"
                    defaultValue={hasAttempt}
                    className="h-10 w-full appearance-none rounded-xl border border-zinc-200 bg-white/80 pl-10 pr-9 text-sm text-zinc-900 shadow-sm outline-none transition-all hover:border-zinc-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                  >
                    <option value="">Todos</option>
                    <option value="1">Con intento</option>
                    <option value="0">Sin intento</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones del formulario */}
            <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200/70 pt-4 dark:border-zinc-700/70 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Mostrando <span className="font-bold text-violet-600 dark:text-violet-400">{mTotal}</span> de{" "}
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{total}</span> resultados
              </p>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="group inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/30 active:scale-[0.98] dark:from-violet-500 dark:to-blue-500"
                >
                  <Filter className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                  Aplicar filtros
                </button>
                <Link
                  href="/dashboard/assessments"
                  className="inline-flex h-9 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Limpiar
                </Link>
              </div>
            </div>
          </div>
        </form>

        {/* Tabla mejorada - NOTA: Se agregó pb-48 para espacio del menú */}
        {rows.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700">
                <Search className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">No hay resultados</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Ajusta los filtros o espera a que haya actividad de candidatos.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/80 shadow-lg backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/80">
            {/* IMPORTANTE: Envolver en un div con padding bottom para el menú */}
            <div className="overflow-x-auto pb-48">
              <table className="w-full table-fixed text-sm" style={{ minWidth: '1400px' }}>
                <colgroup>
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '240px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '180px' }} />
                </colgroup>
                <thead className="border-b border-zinc-200/80 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 dark:border-zinc-800/50 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Candidato
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Assessment
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Vacante
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-center text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Estado
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-center text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Score
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-center text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Anti-cheat
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Actividad
                    </th>
                    <th className="whitespace-nowrap px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {rows.map((r) => {
                    const inv = (r?.inv ?? r) as any;
                    const attempt = (r?.attempt ?? null) as any;

                    const st = r.uiState as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "INACTIVE";
                    const stTone = tone(st);
                    const stLabel = stateLabel(st);

                    const scoreTxt = fmtScore(attempt?.totalScore);
                    const passed = attempt?.passed === true;
                    const hasFinal = Boolean(r.resultsUrl);

                    const sev = String(attempt?.severity ?? "NORMAL").toUpperCase();
                    const sevScore = typeof attempt?.severityScore === "number" ? attempt.severityScore : 0;
                    const showAlert = sev === "SUSPICIOUS" || sev === "CRITICAL" || attempt?.multiSession;

                    const lastActivity = attempt?.submittedAt || attempt?.createdAt || inv.updatedAt || inv.createdAt;

                    const templateId = String(inv?.templateId ?? inv?.template?.id ?? "");
                    const token = String(inv?.token ?? "");
                    const inviteLink =
                      r.inviteLink ??
                      (templateId && token
                        ? `/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}`
                        : null);

                    const resultsUrl =
                      r.resultsUrl ?? (attempt?.id ? `/assessments/attempts/${attempt.id}/results` : null);

                    const applicationId = String(inv?.applicationId ?? inv?.application?.id ?? "");
                    const menuTemplateId = templateId || null;

                    return (
                      <tr
                        key={inv.id}
                        className="group relative bg-white transition-all hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-blue-50/50 dark:bg-zinc-900/50 dark:hover:from-violet-950/20 dark:hover:to-blue-950/20"
                      >
                        {/* Candidato - CLICABLE */}
                        <td className="relative px-5 py-4">
                          {/* Indicador lateral en hover */}
                          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-violet-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                          <Link
                            href={`/dashboard/candidates/${inv.candidate?.id || '#'}`}
                            className="flex items-center gap-2.5 transition-all hover:opacity-80"
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-blue-100 text-xs font-bold text-violet-700 ring-2 ring-transparent transition-all group-hover:ring-violet-200 dark:from-violet-900/40 dark:to-blue-900/40 dark:text-violet-300 dark:group-hover:ring-violet-800/50">
                              {(inv.candidate?.name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-zinc-900 transition-colors hover:text-violet-600 dark:text-zinc-50 dark:hover:text-violet-400">
                                {inv.candidate?.name || "Sin nombre"}
                              </p>
                              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {inv.candidate?.email}
                              </p>
                            </div>
                          </Link>
                        </td>

                        {/* Assessment */}
                        <td className="px-5 py-4">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                              {inv.template?.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {String(inv.template?.difficulty ?? "").toLowerCase()}
                              {typeof inv.template?.timeLimit === "number" ? ` · ${inv.template.timeLimit} min` : ""}
                            </p>
                          </div>
                        </td>

                        {/* Vacante - CLICABLE a applications */}
                        <td className="px-5 py-4">
                          {inv.application?.job?.id ? (
                            <Link
                              href={`/dashboard/jobs/${inv.application.job.id}/applications`}
                              className="inline-block truncate font-medium text-zinc-800 transition-colors hover:text-violet-600 dark:text-zinc-100 dark:hover:text-violet-400"
                            >
                              {inv.application.job.title}
                            </Link>
                          ) : (
                            <p className="truncate text-zinc-500 dark:text-zinc-400">—</p>
                          )}
                        </td>

                        {/* Estado - MEJORADO CON ICONOS MÁS DISTINTIVOS */}
                        <td className="px-5 py-4 text-center">
                          {st === "COMPLETED" && (
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${stTone}`}>
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                              <span className="flex-shrink-0">{stLabel}</span>
                            </span>
                          )}
                          {st === "IN_PROGRESS" && (
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${stTone}`}>
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                              </div>
                              <span className="flex-shrink-0">{stLabel}</span>
                            </span>
                          )}
                          {st === "PENDING" && (
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${stTone}`}>
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 dark:bg-violet-500">
                                <Clock className="h-2.5 w-2.5 text-white" />
                              </div>
                              <span className="flex-shrink-0">{stLabel}</span>
                            </span>
                          )}
                          {st === "INACTIVE" && (
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${stTone}`}>
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-500 dark:bg-zinc-600">
                                <XCircle className="h-2.5 w-2.5 text-white" />
                              </div>
                              <span className="flex-shrink-0">{stLabel}</span>
                            </span>
                          )}
                        </td>

                        {/* Score - MEJORADO CON TOOLTIP Y ANIMACIÓN */}
                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1.5">
                            <div className="group/score relative">
                              <span className="inline-flex min-w-[3.5rem] cursor-help justify-center rounded-lg border-2 border-zinc-200 bg-white px-2.5 py-1.5 text-base font-black text-zinc-900 transition-all hover:scale-105 hover:border-violet-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-violet-600">
                                {scoreTxt}
                              </span>
                              {/* Tooltip on hover */}
                              {typeof attempt?.totalScore === "number" && (
                                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/score:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
                                  Puntuación total
                                </div>
                              )}
                            </div>

                            {hasFinal && attempt?.passed != null ? (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                  passed
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-red-700 dark:text-red-300"
                                }`}
                              >
                                {passed ? (
                                  <>
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Aprobó
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-2.5 w-2.5" /> No aprobó
                                  </>
                                )}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Anti-cheat - MEJORADO CON TOOLTIP */}
                        <td className="px-5 py-4 text-center">
                          {showAlert ? (
                            <div className="group/alert relative inline-flex">
                              <span className="inline-flex cursor-help items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-amber-400 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-900 shadow-sm transition-all hover:scale-105 hover:shadow-md dark:border-amber-600/50 dark:bg-amber-900/30 dark:text-amber-200">
                                <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" />
                                <span className="flex-shrink-0">
                                  {sev}
                                  {attempt?.multiSession && " · Multi"}
                                </span>
                              </span>
                              {/* Tooltip */}
                              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-amber-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/alert:opacity-100">
                                Puntuación: {sevScore}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                              <div className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </div>
                              Normal
                            </span>
                          )}
                        </td>

                        {/* Actividad - MEJORADO */}
                        <td className="px-5 py-4">
                          <div className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-200">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                              <Clock className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                            </div>
                            <span className="font-medium">{fromNow(lastActivity)}</span>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end">
                            <AssessmentActionsMenu
                              applicationId={applicationId || null}
                              templateId={menuTemplateId}
                              invitePath={inviteLink}
                              resultsUrl={resultsUrl}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación mejorada */}
            <div className="flex flex-col gap-2 border-t border-zinc-200/80 bg-gradient-to-r from-zinc-50/50 via-white to-zinc-50/50 px-4 py-3 dark:border-zinc-800/50 dark:from-zinc-900/50 dark:via-zinc-900/30 dark:to-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Página <span className="font-black text-violet-600 dark:text-violet-400">{page}</span> de{" "}
                <span className="font-black text-zinc-900 dark:text-zinc-100">{totalPages}</span>
              </p>

              <div className="flex gap-2">
                <PagerLink disabled={page <= 1} href={buildPageHref(searchParams, page - 1)}>
                  ← Anterior
                </PagerLink>
                <PagerLink disabled={page >= totalPages} href={buildPageHref(searchParams, page + 1)}>
                  Siguiente →
                </PagerLink>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function PagerLink({ href, disabled, children }: { href: string; disabled?: boolean; children: ReactNode }) {
  if (disabled) {
    return (
      <span className="inline-flex items-center rounded-xl border-2 border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-700 dark:hover:bg-violet-900/20 dark:hover:text-violet-300"
    >
      {children}
    </Link>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  total,
  isPercentage,
  isAlert,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: "violet" | "blue" | "emerald" | "zinc" | "teal" | "amber";
  total?: number;
  isPercentage?: boolean;
  isAlert?: boolean;
}) {
  const colors = {
    violet: {
      bg: "from-violet-500 to-purple-500",
      shadow: "shadow-violet-500/25",
      text: "text-violet-600 dark:text-violet-400",
      bar: "bg-violet-500",
    },
    blue: {
      bg: "from-blue-500 to-cyan-500",
      shadow: "shadow-blue-500/25",
      text: "text-blue-600 dark:text-blue-400",
      bar: "bg-blue-500",
    },
    emerald: {
      bg: "from-emerald-500 to-teal-500",
      shadow: "shadow-emerald-500/25",
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    },
    zinc: {
      bg: "from-zinc-400 to-zinc-500",
      shadow: "shadow-zinc-500/25",
      text: "text-zinc-600 dark:text-zinc-400",
      bar: "bg-zinc-500",
    },
    teal: {
      bg: "from-teal-500 to-cyan-500",
      shadow: "shadow-teal-500/25",
      text: "text-teal-600 dark:text-teal-400",
      bar: "bg-teal-500",
    },
    amber: {
      bg: "from-amber-500 to-orange-500",
      shadow: "shadow-amber-500/25",
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
  };

  const c = colors[color];
  const percentage = total ? Math.round((Number(value) / total) * 100) : 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md dark:border-zinc-800/50 dark:bg-zinc-900/80">
      {/* Icono decorativo */}
      <div className={`absolute -right-3 -top-3 h-20 w-20 rounded-full bg-gradient-to-br ${c.bg} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
      
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
          <div className={`rounded-lg bg-gradient-to-br ${c.bg} p-1 ${c.shadow} shadow-md`}>
            <Icon className="h-3 w-3 text-white" />
          </div>
        </div>

        <div className="mt-2">
          <p className={`text-2xl font-black ${c.text}`}>{value}</p>
        </div>

        {/* Barra de progreso para valores numéricos */}
        {total && !isPercentage && !isAlert && typeof value === "number" && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full ${c.bar} transition-all duration-500 ease-out`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{percentage}% del total</p>
          </div>
        )}
      </div>
    </div>
  );
}