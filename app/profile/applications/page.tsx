// app/profile/applications/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { fromNow } from "@/lib/dates";
import {
  buildCandidateApplicationReadRows,
  CANDIDATE_PROCESS_BUCKETS,
  CANDIDATE_PROCESS_LABELS,
  countCandidateProcessBuckets,
  filterCandidateProcessRows,
  resolveCandidateProcessFilter,
  type CandidateProcessBucket,
} from "@/lib/hiring-process/candidate-read-model";
import { isCanonicalHiringProcessCandidateReadsEnabled } from "@/lib/hiring-process/feature-flags";

export const metadata = { title: "Mis postulaciones | Bolsa TI" };

const STATUSES = [
  "SUBMITTED",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;

type AppStatus = (typeof STATUSES)[number];

const STATUS_CONFIG: Record<AppStatus, { label: string; className: string }> = {
  SUBMITTED: {
    label: "Enviada",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  },
  REVIEWING: {
    label: "En revisión",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-900/20 dark:text-sky-300",
  },
  INTERVIEW: {
    label: "Entrevista",
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700/50 dark:bg-indigo-900/20 dark:text-indigo-300",
  },
  OFFER: {
    label: "Oferta",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300",
  },
  HIRED: {
    label: "Contratado",
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-300",
  },
  REJECTED: {
    label: "Rechazada",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300",
  },
};

const PROCESS_CLASS_NAMES: Record<CandidateProcessBucket, string> = {
  RECEIVED:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  REVIEWING:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-900/20 dark:text-sky-300",
  ASSESSMENT:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-violet-300",
  INTERVIEW:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700/50 dark:bg-indigo-900/20 dark:text-indigo-300",
  DECISION:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300",
  CLOSED:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "Tiempo completo",
  PART_TIME: "Medio tiempo",
  CONTRACT: "Contrato",
  FREELANCE: "Freelance",
  INTERNSHIP: "Prácticas",
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
};

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams?: { status?: string; process?: string; applied?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/signin?role=CANDIDATE&callbackUrl=/profile/applications");
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, role: true, name: true },
  });

  if (!me) redirect("/profile");
  if (me.role !== "CANDIDATE") redirect("/");

  const rawStatus = (searchParams?.status || "").toUpperCase();
  const isValidStatus = (STATUSES as readonly string[]).includes(rawStatus);
  const status = (isValidStatus ? rawStatus : "") as AppStatus | "";

  const canonicalCandidateReadsEnabled =
    isCanonicalHiringProcessCandidateReadsEnabled();

  const canonicalProcessFilter = canonicalCandidateReadsEnabled
    ? resolveCandidateProcessFilter({
        process: searchParams?.process,
        status: searchParams?.status,
      })
    : undefined;

  const allApps = await prisma.application.findMany({
    where: {
      candidateId: me.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          slug: true,
          title: true,
          location: true,
          employmentType: true,
          seniority: true,
          remote: true,
          company: { select: { name: true } },
        },
      },
    },
    take: 200,
  });

  const candidateRows = buildCandidateApplicationReadRows(allApps, {
    canonicalReadsEnabled: canonicalCandidateReadsEnabled,
  });

  const apps = canonicalCandidateReadsEnabled
    ? filterCandidateProcessRows(candidateRows, canonicalProcessFilter)
    : status
      ? candidateRows.filter((a) => a.status === status)
      : candidateRows;

  const appliedFlag = searchParams?.applied;

  const legacyCounters = allApps.reduce((acc, a) => {
    const s = (a.status as AppStatus) || "SUBMITTED";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const processCounters = countCandidateProcessBuckets(candidateRows);

  const totalApps = allApps.length;
  const visibleApps = apps.length;
  const hasActiveFilter = canonicalCandidateReadsEnabled
    ? Boolean(canonicalProcessFilter)
    : Boolean(status);

  const activeFilterLabel = canonicalCandidateReadsEnabled
    ? canonicalProcessFilter
      ? CANDIDATE_PROCESS_LABELS[canonicalProcessFilter.bucket]
      : null
    : status
      ? STATUS_CONFIG[status].label
      : null;

  return (
    <main className="w-full pb-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {appliedFlag === "1" && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Tu postulación se envió correctamente.
          </div>
        )}

        {appliedFlag === "existing" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
            Ya te habías postulado a esta vacante.
          </div>
        )}

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Mis postulaciones
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Hola {me.name ?? "candidato/a"} · {totalApps} postulación
              {totalApps !== 1 ? "es" : ""}
              {hasActiveFilter ? ` · ${visibleApps} en esta vista` : ""}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/jobs"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60 sm:w-auto"
            >
              ← Ver vacantes
            </Link>

            <Link
              href="/profile/summary"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60 sm:w-auto"
            >
              Ver mi perfil
            </Link>
          </div>
        </header>

        {totalApps > 0 && (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-2 pb-1">
              <Link
                href="/profile/applications"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  !hasActiveFilter
                    ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                Todas ({totalApps})
              </Link>

              {canonicalCandidateReadsEnabled
                ? CANDIDATE_PROCESS_BUCKETS.filter(
                    (bucket) => processCounters[bucket],
                  ).map((bucket) => (
                    <Link
                      key={bucket}
                      href={`/profile/applications?process=${bucket}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        canonicalProcessFilter?.bucket === bucket
                          ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {CANDIDATE_PROCESS_LABELS[bucket]} ({processCounters[bucket]})
                    </Link>
                  ))
                : STATUSES.filter((s) => legacyCounters[s]).map((s) => (
                    <Link
                      key={s}
                      href={`/profile/applications?status=${s}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        status === s
                          ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {STATUS_CONFIG[s].label} ({legacyCounters[s]})
                    </Link>
                  ))}
            </div>
          </div>
        )}

        {apps.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-6 text-center sm:p-10">
            <p className="text-base font-medium text-zinc-700 dark:text-zinc-200">
              {activeFilterLabel
                ? `Sin postulaciones con estado "${activeFilterLabel}"`
                : "Aún no tienes postulaciones"}
            </p>

            <Link
              href="/jobs"
              className="mt-4 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Buscar vacantes
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((a) => {
              const st = (a.status as AppStatus) || "SUBMITTED";
              const legacyCfg =
                STATUS_CONFIG[st] || STATUS_CONFIG.SUBMITTED;
              const cfg =
                a._candidateRead.source === "CANONICAL"
                  ? {
                      label: a._candidateRead.label,
                      className:
                        PROCESS_CLASS_NAMES[a._candidateRead.bucket],
                    }
                  : legacyCfg;

              return (
                <div
                  key={a.id}
                  className="glass-card rounded-2xl border p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-start gap-2">
                        {a.job ? (
                          <Link
                            href={`/jobs/${a.job.slug ?? a.job.id}`}
                            className="line-clamp-2 min-w-0 text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                          >
                            {a.job.title}
                          </Link>
                        ) : (
                          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            —
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.className}`}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <p className="break-words text-sm text-zinc-500 dark:text-zinc-400">
                        {a.job?.company?.name ?? "—"}
                        {a.job?.location ? ` · ${a.job.location}` : ""}
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {a.job?.employmentType && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {EMPLOYMENT_LABEL[a.job.employmentType] ?? a.job.employmentType}
                          </span>
                        )}

                        {a.job?.seniority && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {SENIORITY_LABEL[a.job.seniority] ?? a.job.seniority}
                          </span>
                        )}

                        {a.job?.remote && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300">
                            Remoto
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <time
                        className="whitespace-nowrap text-xs text-zinc-400"
                        title={new Date(a.createdAt).toLocaleString()}
                      >
                        {fromNow(a.createdAt)}
                      </time>

                      {a.job && (
                        <Link
                          href={`/jobs/${a.job.slug ?? a.job.id}`}
                          className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60 sm:w-auto whitespace-nowrap"
                        >
                          Ver vacante
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
