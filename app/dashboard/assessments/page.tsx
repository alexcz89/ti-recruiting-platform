// app/dashboard/assessments/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers, cookies } from "next/headers";
import type { ReactNode } from "react";

import AssessmentActionsMenu from "@/components/dashboard/assessments/AssessmentActionsMenu";
import AutoRefresh from "@/components/dashboard/assessments/AutoRefresh";
import { authOptions } from '@/lib/server/auth';
import { fromNow } from "@/lib/dates";

export const metadata = { title: "Evaluaciones | Panel" };
export const dynamic = "force-dynamic";

type StateFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "CANCELLED";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeState(s: string | null): StateFilter {
  const v = String(s ?? "").toUpperCase();
  if (v === "PENDING") return "PENDING";
  if (v === "IN_PROGRESS") return "IN_PROGRESS";
  if (v === "COMPLETED") return "COMPLETED";
  if (v === "EXPIRED") return "EXPIRED";
  if (v === "CANCELLED") return "CANCELLED";
  return "ALL";
}

function stateLabel(state: Exclude<StateFilter, "ALL">) {
  if (state === "COMPLETED") return "Completado";
  if (state === "IN_PROGRESS") return "En progreso";
  if (state === "EXPIRED") return "Expirada";
  if (state === "CANCELLED") return "Cancelada";
  return "Pendiente";
}

function fmtScore(n: any) {
  return typeof n === "number" && Number.isFinite(n) ? `${Math.round(n)}%` : "—";
}

function fmtTime(seconds: number | null | undefined): string {
  if (!seconds || typeof seconds !== "number") return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function buildPageHref(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  nextPage: number
) {
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
  return (
    env
      ? env.startsWith("http")
        ? env
        : `https://${env}`
      : "http://localhost:3000"
  ).replace(/\/$/, "");
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
  const state = normalizeState(
    typeof searchParams?.state === "string" ? searchParams.state : null
  );
  const hasAttempt =
    typeof searchParams?.hasAttempt === "string" ? searchParams.hasAttempt : "";
  const sort = typeof searchParams?.sort === "string" ? searchParams.sort : "recent";
  const page = clampInt(
    parseInt(String(searchParams?.page ?? "1"), 10) || 1,
    1,
    9999
  );

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (jobId) qs.set("jobId", jobId);
  if (state && state !== "ALL") qs.set("state", state);
  if (hasAttempt) qs.set("hasAttempt", hasAttempt);
  if (sort && sort !== "recent") qs.set("sort", sort);
  qs.set("page", String(page));

  // exportQs: same filters but no page (for CSV export & API)
  const exportQs = new URLSearchParams(qs);
  exportQs.delete("page");

  const baseUrl = getBaseUrl();
  const cookieHeader = cookies().toString();

  const res = await fetch(`${baseUrl}/api/dashboard/assessments?${qs.toString()}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) {
    return <main className={pageClass}>
      <h1 className="text-2xl font-semibold tracking-tight">Evaluaciones</h1>
      <div role="alert" className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p>No pudimos cargar las evaluaciones.</p>
        <Link href={buildPageHref(searchParams, page)} className={actionClass}>Reintentar</Link>
      </div>
    </main>;
  }

  const data = await res.json();
  const jobs: Array<{ id: string; title: string }> = data.jobs ?? [];
  const rows: any[] = data.rows ?? [];
  const total: number = data.total ?? 0;
  const totalPages: number = data.totalPages ?? 1;
  const hasInProgress = rows.some(row => row.uiState === "IN_PROGRESS");
  const attemptFilter = hasAttempt === "1" || hasAttempt === "0";
  const pageFilters = state !== "ALL" || attemptFilter;
  const scoreSort = sort === "score_desc" || sort === "score_asc";
  const filtered = Boolean(q || jobId || pageFilters);

  return (
    <main className={pageClass}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Evaluaciones</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Resultados y seguimiento de candidatos</p>
      </header>

      <form method="get" action="/dashboard/assessments" aria-label="Filtros de evaluaciones" className="space-y-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(12rem,2fr)_minmax(10rem,1fr)_minmax(9rem,1fr)]">
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <label htmlFor="assessment-search" className={labelClass}>Buscar</label>
            <input id="assessment-search" name="q" defaultValue={q} placeholder="Nombre, correo o evaluación" className={inputClass} />
          </div>
          <div className="min-w-0">
            <label htmlFor="assessment-job" className={labelClass}>Vacante</label>
            <select id="assessment-job" name="jobId" defaultValue={jobId} className={inputClass}>
              <option value="">Todas</option>
              {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="assessment-state" className={labelClass}>Estado</label>
            <select id="assessment-state" name="state" defaultValue={state} className={inputClass}>
              <option value="ALL">Todos</option><option value="PENDING">Pendiente</option><option value="IN_PROGRESS">En progreso</option><option value="COMPLETED">Completado</option><option value="EXPIRED">Expirada</option><option value="CANCELLED">Cancelada</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <details open={attemptFilter || scoreSort} className="min-w-0 max-w-full">
            <summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              Intentos y orden{(attemptFilter || scoreSort) && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">Activos</span>}
            </summary>
            <div className="grid gap-3 pb-2 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="assessment-attempts" className={labelClass}>Intentos</label>
                <select id="assessment-attempts" name="hasAttempt" defaultValue={hasAttempt} className={inputClass}><option value="">Todos</option><option value="1">Con intento</option><option value="0">Sin intento</option></select>
              </div>
              <div className="min-w-0">
                <label htmlFor="assessment-sort" className={labelClass}>Ordenar</label>
                <select id="assessment-sort" name="sort" defaultValue={sort} className={inputClass}><option value="recent">Más reciente</option><option value="score_desc">Calificación mayor a menor</option><option value="score_asc">Calificación menor a mayor</option></select>
              </div>
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary min-h-11 bg-emerald-700 hover:bg-emerald-800">Aplicar filtros</button>
            <Link href="/dashboard/assessments" className={actionClass}>Limpiar</Link>
            <a href={`/api/dashboard/assessments/export?${exportQs.toString()}`} download="evaluaciones.csv" title="Exporta hasta 2000 invitaciones de la búsqueda" className={actionClass}>Exportar CSV</a>
          </div>
        </div>
        {(pageFilters || scoreSort) && <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          {pageFilters && "Estado e intentos filtran la página actual; la paginación conserva las invitaciones de la búsqueda por nombre y vacante. "}
          {scoreSort && "La calificación se ordena dentro de cada página."}
        </p>}
      </form>

      <section aria-labelledby="assessment-results-title" className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="assessment-results-title" className="text-sm font-medium">{rows.length} en esta página <span className="font-normal text-zinc-600 dark:text-zinc-400">· {total} {pageFilters ? "invitaciones antes de filtrar estado e intentos" : "invitaciones para esta búsqueda"}</span></h2>
          {hasInProgress && <AutoRefresh hasInProgress={hasInProgress} intervalMs={30_000} />}
        </div>
        {rows.length > 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400 xl:hidden">Desliza la tabla para consultar resultados y acciones.</p>}
        {rows.length === 0 ? (
          <div className="border-y border-zinc-200 py-8 dark:border-zinc-800">
            <h3 className="font-medium">{filtered || total > 0 ? "No hay coincidencias en esta página" : "Todavía no hay evaluaciones"}</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{filtered || total > 0 ? "Ajusta los filtros o consulta otra página de la búsqueda." : "Las invitaciones y los resultados de tus candidatos aparecerán aquí."}</p>
            {filtered && <Link href="/dashboard/assessments" className={actionClass}>Ver sin filtros</Link>}
          </div>
        ) : (
          <div role="region" aria-label="Tabla de evaluaciones, desplazamiento horizontal disponible" tabIndex={0} className="max-w-full overflow-x-auto rounded-sm border-y border-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-zinc-800">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <caption className="sr-only">Resultados y seguimiento de evaluaciones</caption>
              <colgroup><col className="w-[20%]" /><col className="w-[27%]" /><col className="w-[18%]" /><col className="w-[17%]" /><col className="w-[18%]" /></colgroup>
              <thead className="border-b border-zinc-200 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"><tr>
                {['Candidato', 'Evaluación y vacante', 'Estado y resultado', 'Integridad', 'Acciones'].map(label => <th key={label} scope="col" className="px-2 py-3 font-medium">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map(r => {
                  const inv = r?.inv ?? r;
                  const attempt = r.attempt ?? null;
                  const st = r.uiState as Exclude<StateFilter, "ALL">;
                  const candidateName = inv.candidate?.name || "Sin nombre";
                  const templateId = String(inv.templateId ?? inv.template?.id ?? "");
                  const token = String(inv.token ?? "");
                  const inviteLink = r.inviteLink ?? (templateId && token ? `/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}` : null);
                  const resultsUrl = r.resultsUrl ?? (attempt?.id ? `/dashboard/assessments/attempts/${attempt.id}/results` : null);
                  const final = Boolean(r.resultsUrl) || st === "COMPLETED";
                  const score = typeof attempt?.totalScore === "number" ? Math.min(100, attempt.totalScore) : attempt?.totalScore;
                  const severity = String(attempt?.severity ?? "").toUpperCase();
                  const alert = severity === "CRITICAL" || severity === "SUSPICIOUS" || attempt?.multiSession;
                  const lastActivity = attempt?.submittedAt || attempt?.createdAt || inv.updatedAt || inv.createdAt;
                  return <tr key={inv.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-2 py-3">
                      {inv.candidate?.id ? <Link href={`/dashboard/candidates/${inv.candidate.id}`} title={candidateName} className="block truncate rounded font-medium !text-zinc-900 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-600 dark:!text-zinc-100">{candidateName}</Link> : <span className="block truncate" title={candidateName}>{candidateName}</span>}
                      <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400" title={inv.candidate?.email}>{inv.candidate?.email}</p>
                    </td>
                    <td className="px-2 py-3">
                      <p className="truncate font-medium" title={inv.template?.title}>{inv.template?.title || "Evaluación sin título"}</p>
                      {inv.application?.job?.id ? <Link href={`/dashboard/jobs/${inv.application.job.id}/applications`} title={inv.application.job.title} className="mt-1 block truncate rounded text-xs text-emerald-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-300">{inv.application.job.title}</Link> : <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">Sin vacante vinculada</span>}
                      {lastActivity && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{fromNow(lastActivity)}</p>}
                    </td>
                    <td className="px-2 py-3">
                      <p className={st === "IN_PROGRESS" ? "font-medium text-blue-700 dark:text-blue-300" : "font-medium"}>{stateLabel(st)}</p>
                      {final ? <p className={`mt-1 tabular-nums ${attempt?.passed === true ? "text-emerald-700 dark:text-emerald-300" : attempt?.passed === false ? "text-rose-700 dark:text-rose-300" : "text-zinc-600 dark:text-zinc-400"}`}><span className="font-semibold">{fmtScore(score)}</span>{typeof attempt?.passed === "boolean" && <span className="ml-2 text-xs">{attempt.passed ? "Aprobó" : "No aprobó"}</span>}</p> : <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Sin resultado final</p>}
                      {st === "COMPLETED" && attempt?.timeSpent ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{fmtTime(attempt.timeSpent)}{typeof inv.template?.timeLimit === "number" ? ` / ${inv.template.timeLimit}m` : ""}</p> : null}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {alert ? <details><summary className="min-h-11 cursor-pointer rounded font-medium text-amber-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-amber-200">Revisar señales</summary><p className="leading-5 text-zinc-600 dark:text-zinc-400">{severity === "CRITICAL" ? "Nivel crítico." : severity === "SUSPICIOUS" ? "Nivel sospechoso." : "Señal registrada."}{attempt.multiSession ? " Varias sesiones." : ""}{typeof attempt.severityScore === "number" ? ` Indicador: ${attempt.severityScore}.` : ""}</p></details> : <span className="text-zinc-600 dark:text-zinc-400">{attempt ? "Sin datos suficientes" : "Sin datos"}</span>}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {st === "COMPLETED" && resultsUrl && <Link href={resultsUrl} aria-label={`Ver resultados de ${candidateName}`} className={actionClass}>Ver resultados</Link>}
                        <AssessmentActionsMenu applicationId={String(inv.applicationId ?? inv.application?.id ?? "") || null} templateId={templateId || null} invitePath={inviteLink} resultsUrl={resultsUrl} ariaLabel={`Acciones de evaluación de ${candidateName}`} />
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">Las señales de integridad requieren revisión; no determinan fraude.</p>}
        <nav aria-label="Paginación de evaluaciones" className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">Página {page} de {totalPages}</p>
          <div className="flex gap-2"><PagerLink disabled={page <= 1} href={buildPageHref(searchParams, page - 1)}>Anterior</PagerLink><PagerLink disabled={page >= totalPages} href={buildPageHref(searchParams, page + 1)}>Siguiente</PagerLink></div>
        </nav>
      </section>
    </main>
  );
}

const pageClass = "mx-auto w-full max-w-[1600px] space-y-4 px-4 py-5 text-zinc-900 dark:text-zinc-100 sm:px-6 lg:px-8";
const labelClass = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";
const inputClass = "h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const actionClass = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium text-emerald-700 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950";
function PagerLink({ href, disabled, children }: { href: string; disabled?: boolean; children: ReactNode }) {
  return disabled ? <span aria-disabled="true" className="inline-flex min-h-11 items-center px-2 text-zinc-500 dark:text-zinc-500">{children}</span> : <Link href={href} className={actionClass}>{children}</Link>;
}
