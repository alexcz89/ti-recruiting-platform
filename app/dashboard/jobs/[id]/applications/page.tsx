import CandidateProfileLink from "@/components/dashboard/CandidateProfileLink";
import { getRecruiterPipelinePresentation, RECRUITER_PIPELINE, RECRUITER_PIPELINE_STATE_LABELS, resolveRecruiterPipelineFilterKey } from "@/lib/hiring-process/recruiting-presentation";
import { buildRecruiterListHref, compareRecruiterListRows, countRecruiterPipelineRows, matchesRecruiterListFilters, matchScoreLevel, resolveCandidateLocation, resolveProcessActivity, type RecruiterListAssessment, type RecruiterListQuery, type RecruiterListSort, type SortDirection } from "@/lib/hiring-process/recruiter-list";
// app/dashboard/jobs/[id]/applications/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { isAssessmentExpired } from "@/lib/assessments/expiration";
import { getSessionCompanyId } from "@/lib/server/session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { notFound } from "next/navigation";
import { fromNow } from "@/lib/dates";
import InterestSelect from "./InterestSelect";
import ActionsMenu from "./ActionsMenu";
import { Phone, FileText as FileTextIcon, Search, Lock, ArrowLeft, MapPin, Calendar, Eye as EyeIcon, BarChart2, Users } from "lucide-react";
import ShareLinkedInButton from "./ShareLinkedInButton";
import JobActionsMenu from "@/components/dashboard/JobActionsMenu";
import MatchScorePopover from "@/components/dashboard/MatchScorePopover";
import MatchBreakdownMini from "@/components/jobs/MatchBreakdownMini";
import { buildRecruiterMatchJob, computeRecruiterMatch, getRecruiterMatchAccessIds, recruiterMatchCandidateSelect, recruiterMatchJobSelect } from "@/lib/ai/recruiter-match";
import {
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  type BillingPlan,
} from "@/lib/ai/matchScore";
import { isCanonicalHiringProcessRecruiterReadsEnabled } from "@/lib/hiring-process/feature-flags";
import {
  buildRecruiterApplicationReadRows,
  countRecruiterPipelineBuckets,
  filterRecruiterPipelineRows,
  PRIMARY_RECRUITER_PIPELINE_BUCKETS,
  RECRUITER_PIPELINE_LABELS,
  resolveRecruiterPipelineFilter,
  type RecruiterPipelineBucket,
} from "@/lib/hiring-process/recruiter-read-model";
import { getAssessmentTemplateVisibilityWhere } from "@/lib/assessments/access";

const PROFILE_TYPE_LABEL: Record<string, string> = {
  ENGINEERING: "Engineering",
  DATA: "Data",
  DEVOPS: "DevOps",
  PRODUCT: "Product",
  DESIGN: "Design",
  QA: "QA",
  RECRUITING: "Recruiting",
  BUSINESS: "Business",
  HYBRID: "Hybrid",
};

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";

const LEGACY_RECRUITER_TABS = [
  { bucket: "APPLIED", query: "REVIEW" },
  { bucket: "PRESELECTED", query: "MAYBE" },
  { bucket: "INTERVIEW", query: "ACCEPTED" },
  { bucket: "REJECTED", query: "REJECTED" },
] as const;

type MatchFilter = "ALL" | "HIGH" | "MED" | "LOW";
type CvFilter = "ALL" | "YES" | "NO";
const LIST_SECTIONS = RECRUITER_PIPELINE;

// Presentation only: consumes the authorized state already resolved below.
function AssessmentSummary({ states, detailHref }: { states: Array<{ title: string; state: string; score: number | null; attemptId: string | null }>; detailHref?: string }) {
  const associated = states.filter(state => state.state !== "NONE");
  if (!associated.length) return null;
  const completed = associated.filter(state => state.state === "COMPLETED").length;
  if (associated.length > 1) return <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
    {associated.length} evaluaciones · {completed} completada{completed === 1 ? "" : "s"}
    {detailHref && <a href={detailHref} className="ml-1 underline underline-offset-2 focus-visible:outline focus-visible:outline-2">Ver detalle</a>}
  </p>;
  const state = associated[0];
  const label = state.state === "COMPLETED" ? "Evaluación completada" : state.state === "STARTED" ? "Evaluación en progreso" : state.state === "EXPIRED" ? "Evaluación vencida" : "Evaluación enviada · Pendiente";
  return <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
    {label}{state.state === "COMPLETED" && typeof state.score === "number" ? ` · ${state.score}%` : ""}
    {state.state === "COMPLETED" && state.attemptId
      ? <a href={`/dashboard/assessments/attempts/${encodeURIComponent(state.attemptId)}/results`} aria-label={`Ver resultado de ${state.title}`} className="ml-1 underline underline-offset-2 focus-visible:outline focus-visible:outline-2">Ver resultado</a>
      : detailHref && <a href={detailHref} aria-label={`Ver detalle de ${state.title}`} className="ml-1 underline underline-offset-2 focus-visible:outline focus-visible:outline-2">Ver detalle</a>}
  </p>;
}

function MatchedSkills({ details }: { details: Array<{ label: string; matched: boolean }> }) {
  // Preserve the deterministic order produced by the shared match engine; no new ranking.
  const matched = details.filter(detail => detail.matched).slice(0, 5);
  if (!matched.length) return null;
  return <div className="mt-1 max-w-[230px] text-xs text-zinc-600 dark:text-zinc-300">
    <p className="break-words">{matched.slice(0, 3).map(detail => detail.label).join(" · ")}</p>
    {matched.length > 3 && <details className="mt-0.5"><summary className="cursor-pointer rounded text-zinc-500 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 dark:text-zinc-400">+{matched.length - 3} coincidencias</summary>
      <p className="mt-1">{matched.slice(3).map(detail => detail.label).join(" · ")}</p>
    </details>}
  </div>;
}

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    interest?: InterestKey | "ALL";
    pipeline?: string;
    q?: string;
    sort?: string;
    dir?: string;
    match?: MatchFilter | string;
    cv?: CvFilter | string;
    preselected?: string;
    assessment?: string;
    outcome?: string;
  };
}) {
  const canonicalRecruiterReadsEnabled =
    isCanonicalHiringProcessRecruiterReadsEnabled();
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 py-10 lg:px-10">
          <div className="glass-card rounded-2xl border border-dashed p-4 text-center md:p-6">
            <p className="mb-1 text-base font-medium text-zinc-800">No hay empresa asociada a tu sesión.</p>
            <p className="text-sm text-zinc-600">Pide al administrador que asigne tu usuario a una empresa.</p>
          </div>
        </div>
      </main>
    );
  }
  const templateVisibilityWhere = getAssessmentTemplateVisibilityWhere({
    role: "RECRUITER",
    companyId,
  });
  if (!templateVisibilityWhere) notFound();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true, name: true },
  });
  const plan = (company?.billingPlan ?? "FREE") as BillingPlan;
  const matchNow = new Date();

  // Nombre del reclutador para el mensaje de WhatsApp (solo primer nombre)
  const session = await getServerSession(authOptions);
  const recruiterName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: {
      ...recruiterMatchJobSelect,
      id: true,
      slug: true,
      title: true,
      status: true,
      seniority: true,
      minYearsExperience: true,
      company: { select: { name: true } },
      skills: true,
      assessments: {
        where: { template: templateVisibilityWhere },
        orderBy: { createdAt: "asc" },
        select: { templateId: true, template: { select: { title: true } } },
      },
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!job) notFound();

  const jobAssessmentTemplates = job.assessments ?? [];
  const chosenTemplateId = jobAssessmentTemplates[0]?.templateId ?? null;
  const assessmentEnabled = jobAssessmentTemplates.length > 0;
  const allJobTemplateIds = jobAssessmentTemplates.map(a => a.templateId);
  const jobTemplateTitles: Record<string, string> = Object.fromEntries(
    jobAssessmentTemplates.map(a => [a.templateId, (a as any).template?.title ?? a.templateId])
  );

  const { jobSkills: jobSkillsForEngine, hasMatchSignals } = buildRecruiterMatchJob(job);
  const hasJobSkills = jobSkillsForEngine.length > 0;

  const allApps = await prisma.application.findMany({
    where: { jobId: job.id, job: { companyId } },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          ...recruiterMatchCandidateSelect(matchNow),
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          resumeUrl: true,
          phone: true,
          location: true,
          city: true,
          admin1: true,
          country: true,
          certifications: true,
          seniority: true,
          yearsExperience: true,
          desiredSalaryMin: true,
          candidateLanguages: {
            select: {
              level: true,
              term: { select: { label: true } },
            },
          },
        },
      },
    },
  });

  type TemplateState = {
    templateId: string;
    title: string;
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    token: string | null;
    attemptId: string | null;
    score: number | null;
  };

  type AssessmentRowMeta = {
    enabled: boolean;
    templateId: string;
    templateIds?: string[];
    templateTitles?: Record<string, string>;
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    token: string | null;
    attemptId: string | null;
    score: number | null;
    // Estado por cada template del job
    perTemplateState?: TemplateState[];
  };

  const assessmentByAppId = new Map<string, AssessmentRowMeta>();

  if (assessmentEnabled && chosenTemplateId && allApps.length) {
    const applicationIds = allApps.map((a) => a.id);
    const now = new Date();

    const [invites, attempts] = await Promise.all([
      prisma.assessmentInvite.findMany({
        where: { applicationId: { in: applicationIds }, templateId: { in: allJobTemplateIds } },
        orderBy: { updatedAt: "desc" },
        select: { applicationId: true, templateId: true, token: true, status: true, expiresAt: true, updatedAt: true },
      }),
      prisma.assessmentAttempt.findMany({
        where: { applicationId: { in: applicationIds }, templateId: { in: allJobTemplateIds } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, applicationId: true, templateId: true, status: true, totalScore: true, updatedAt: true, expiresAt: true },
      }),
    ]);

    const statusRank = (s: any) => {
      const v = String(s || "").toUpperCase();
      if (v === "SUBMITTED" || v === "EVALUATED" || v === "COMPLETED") return 3;
      if (v === "IN_PROGRESS") return 2;
      if (v === "NOT_STARTED") return 1;
      return 0;
    };

    const isFinalInvite = (s: any) => {
      const v = String(s || "").toUpperCase();
      return v === "SUBMITTED" || v === "EVALUATED" || v === "COMPLETED";
    };

    // Indexar por "appId:templateId" para soportar múltiples templates
    const attemptByKey = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      if (!a.applicationId || !a.templateId) continue;
      const key = `${a.applicationId}:${a.templateId}`;
      const prev = attemptByKey.get(key);
      if (!prev || statusRank(a.status) >= statusRank(prev.status)) {
        attemptByKey.set(key, a);
      }
    }

    const inviteByKey = new Map<string, (typeof invites)[number]>();
    for (const inv of invites) {
      if (!inv.applicationId || !inv.templateId) continue;
      const key = `${inv.applicationId}:${inv.templateId}`;
      if (!inviteByKey.has(key)) inviteByKey.set(key, inv);
    }

    // Función helper: estado de un template específico para una aplicación
    const getTemplateState = (appId: string, templateId: string) => {
      const key = `${appId}:${templateId}`;
      const at = attemptByKey.get(key);
      const iv = inviteByKey.get(key);
      const attemptExpired = isAssessmentExpired(at?.expiresAt, now);
      const inviteExpired = isAssessmentExpired(iv?.expiresAt, now);

      if (at && (at.status === "SUBMITTED" || at.status === "EVALUATED" || at.status === "COMPLETED")) {
        return { state: "COMPLETED" as const, token: iv?.token ?? null, attemptId: at.id, score: at.totalScore ?? null };
      }
      if (at && at.status === "IN_PROGRESS") {
        if (!attemptExpired) {
          return { state: "STARTED" as const, token: iv?.token ?? null, attemptId: at.id, score: null };
        }
        return { state: "EXPIRED" as const, token: iv?.token ?? null, attemptId: at.id, score: null };
      }
      if (attemptExpired || inviteExpired) {
        return { state: "EXPIRED" as const, token: iv?.token ?? null, attemptId: at?.id ?? null, score: null };
      }
      if (iv) {
        const s = String(iv.status || "").toUpperCase();
        if (s === "CANCELLED" || s === "REVOKED") return { state: "EXPIRED" as const, token: iv.token ?? null, attemptId: at?.id ?? null, score: null };
        if (isFinalInvite(iv.status)) return { state: "COMPLETED" as const, token: iv.token ?? null, attemptId: at?.id ?? null, score: at?.totalScore ?? null };

        const invState = s === "STARTED" ? "STARTED" as const : "SENT" as const;
        return { state: invState, token: iv.token ?? null, attemptId: null, score: null };
      }
      return { state: "NONE" as const, token: null, attemptId: null, score: null };
    };

    for (const appId of applicationIds) {
      // Calcular estado por cada template
      const perTemplateState = allJobTemplateIds.map((templateId) => ({
        templateId,
        title: jobTemplateTitles[templateId] ?? templateId,
        ...getTemplateState(appId, templateId),
      }));

      // Estado global = el más avanzado de todos los templates
      // Prioridad: COMPLETED > STARTED > SENT > EXPIRED > NONE
      const statePriority = { COMPLETED: 5, STARTED: 4, SENT: 3, EXPIRED: 2, NONE: 1 };
      const primaryTemplate = perTemplateState.reduce((best, t) =>
        (statePriority[t.state] ?? 0) >= (statePriority[best.state] ?? 0) ? t : best,
        perTemplateState[0]
      );

      assessmentByAppId.set(appId, {
        enabled: true,
        templateId: primaryTemplate?.templateId ?? chosenTemplateId,
        templateIds: allJobTemplateIds,
        templateTitles: jobTemplateTitles,
        state: primaryTemplate?.state ?? "NONE",
        token: primaryTemplate?.token ?? null,
        attemptId: primaryTemplate?.attemptId ?? null,
        score: primaryTemplate?.score ?? null,
        perTemplateState,
      });
    }



  }

  const recruiterRows = buildRecruiterApplicationReadRows(allApps, {
    canonicalReadsEnabled: canonicalRecruiterReadsEnabled,
  });
  const presentationOf = (a: typeof allApps[number]) => getRecruiterPipelinePresentation(a, canonicalRecruiterReadsEnabled);
  // Etapas: universo de la vacante antes de búsqueda y filtros secundarios.
  const { counts: counters, integrityCount } = countRecruiterPipelineRows(allApps, canonicalRecruiterReadsEnabled);
  const total = allApps.length;
  const activityEvents = allApps.length ? await prisma.applicationEvent.groupBy({
    by: ["applicationId"],
    where: { companyId, applicationId: { in: allApps.map((a) => a.id) } },
    _max: { happenedAt: true },
  }) : [];
  const lastEventByApp = new Map(activityEvents.map((row) => [row.applicationId, row._max.happenedAt]));

  const interestParam = searchParams?.interest as string | undefined;
  const pipelineParam = searchParams?.pipeline as string | undefined;
  const oldFilter = resolveRecruiterPipelineFilter({ pipeline: pipelineParam, interest: interestParam });
  const requested = pipelineParam ?? oldFilter;
  const chosenPipeline = resolveRecruiterPipelineFilterKey(requested, searchParams?.outcome);
  const allPipelineSelected = !chosenPipeline;

  const qParam = (searchParams?.q ?? "").toString();
  const q = qParam.trim().toLowerCase();
  const sortParamRaw = searchParams?.sort ?? "match";
  const sortKey: RecruiterListSort = sortParamRaw === "recent" ? "activity" : sortParamRaw === "name" ? "candidate"
    : ["candidate", "match", "status", "activity", "location"].includes(sortParamRaw) ? sortParamRaw as RecruiterListSort : "match";
  const sortDirection: SortDirection = searchParams?.dir === "asc" || searchParams?.dir === "desc"
    ? searchParams.dir : sortKey === "match" || sortKey === "activity" ? "desc" : "asc";
  const matchParam = (searchParams?.match as string | undefined) ?? "ALL";
  const matchFilter: MatchFilter = ["HIGH", "MED", "LOW"].includes(matchParam) ? (matchParam as MatchFilter) : "ALL";
  const cvParam = (searchParams?.cv as string | undefined) ?? "ALL";
  const cvFilter: CvFilter = cvParam === "YES" || cvParam === "NO" ? (cvParam as CvFilter) : "ALL";
  const preselectedFilter = searchParams?.preselected === "1";
  const assessmentFilter: RecruiterListAssessment = ["NONE", "SENT", "STARTED", "COMPLETED", "EXPIRED"].includes(searchParams?.assessment ?? "")
    ? searchParams!.assessment as RecruiterListAssessment : "ALL";
  const outcomeFilter = requested === "CLOSED" && ["REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"].includes(searchParams?.outcome ?? "")
    ? searchParams!.outcome : undefined;

  const matchAccess = getRecruiterMatchAccessIds(allApps, plan);
  let enriched = recruiterRows.map((a) => {
    const match = matchAccess.has(a.id) ? computeRecruiterMatch(job, a.candidate, matchNow) : null;
    const profileType = a.candidate?.aiProfile?.profileType ?? null;

    const fullName =
      a.candidate?.name ||
      [(a.candidate as any)?.firstName, (a.candidate as any)?.lastName].filter(Boolean).join(" ") ||
      "—";

    return {
      ...a,
      _matchResult: match?.matchResult ?? null,
      _matchAdjustments: match ? { baseScore: match.baseScore, profileAdjustment: match.profileAdjustment, tagAdjustment: match.tagAdjustment, finalScore: match.finalScore } : null,
      _profileType: profileType,
      _gatedFinalScore: match?.finalScore ?? null,
      _locked: match === null,
      _fullName: fullName,
      _activity: resolveProcessActivity(a.submittedAt, lastEventByApp.get(a.id)),
      _location: resolveCandidateLocation(a.candidate),
      _hasCV: Boolean(a.candidate?.resumeUrl),
      _presentation: presentationOf(a),
      _assessmentState: (assessmentByAppId.get(a.id)?.state ?? "NONE") as RecruiterListAssessment,
    };
  });

  if (chosenPipeline) {
    enriched = enriched.filter(a => { const p = presentationOf(a); const key = chosenPipeline; return p.pipelineState === key; });
  }

  if (q) {
    enriched = enriched.filter((a) => {
      const skills = (a.candidate?.candidateSkills ?? []).map((cs: any) => cs.term.label).join(" ");
      const profileTypeLabel = PROFILE_TYPE_LABEL[String(a._profileType ?? "").toUpperCase()] ?? "";
      const haystack = [a._fullName, a.candidate?.email ?? "", a._location.full ?? "", skills, profileTypeLabel]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const toListRow = (a: typeof enriched[number]) => ({
    id: a.id, name: a._fullName, score: hasMatchSignals ? a._gatedFinalScore : null,
    presentation: a._presentation, activityAt: a._activity.at,
    location: a._location.full, hasCV: a._hasCV, assessment: a._assessmentState,
  });
  const withGate = enriched;
  const apps = enriched.filter((a) => matchesRecruiterListFilters(toListRow(a), {
    preselected: preselectedFilter, assessment: assessmentFilter, outcome: outcomeFilter,
    match: hasMatchSignals ? matchFilter : "ALL", cv: cvFilter,
  })).sort((a, b) => compareRecruiterListRows(toListRow(a), toListRow(b), sortKey, sortDirection));

  const lockedCount = withGate.filter((a) => a._locked).length;

  const matchCounts: Record<MatchFilter, number> = { ALL: 0, HIGH: 0, MED: 0, LOW: 0 };
  for (const a of withGate) {
    matchCounts.ALL++;
    if (!a._locked && hasMatchSignals) {
      matchCounts[matchScoreLevel(a._gatedFinalScore!)]++;
    }
  }

  const currentQuery: RecruiterListQuery = {
    pipeline: chosenPipeline, q: qParam, sort: sortKey, dir: sortDirection,
    match: matchFilter !== "ALL" ? matchFilter : undefined,
    cv: cvFilter !== "ALL" ? cvFilter : undefined,
    preselected: preselectedFilter ? "1" : undefined,
    assessment: assessmentFilter !== "ALL" ? assessmentFilter : undefined,
    outcome: outcomeFilter,
  };
  function buildHref(overrides: RecruiterListQuery) {
    return buildRecruiterListHref(params.id, currentQuery, overrides);
  }

  function sortHref(key: RecruiterListSort) {
    const nextDirection = sortKey === key ? (sortDirection === "asc" ? "desc" : "asc")
      : key === "match" || key === "activity" ? "desc" : "asc";
    return buildHref({ sort: key, dir: nextDirection });
  }

  const headerBtnClasses =
    "inline-flex items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900";

  const activeFiltersCount = (matchFilter !== "ALL" ? 1 : 0) + (cvFilter !== "ALL" ? 1 : 0)
    + (preselectedFilter ? 1 : 0) + (assessmentFilter !== "ALL" ? 1 : 0) + (outcomeFilter ? 1 : 0);

  const seniorityLabel = job.seniority
    ? { JUNIOR: "Junior", MID: "Mid", SENIOR: "Senior", LEAD: "Lead" }[job.seniority] ?? job.seniority
    : null;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">{job.title}</h1>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                job.status === "OPEN"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : job.status === "PAUSED"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  job.status === "OPEN" ? "bg-emerald-500"
                  : job.status === "PAUSED" ? "bg-amber-500"
                  : "bg-zinc-400"
                }`} />
                {job.status === "OPEN" ? "Abierta" : job.status === "PAUSED" ? "Pausada" : "Cerrada"}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                {job.company?.name ?? "—"}
              </span>
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fromNow(job.createdAt)}
              </span>
              {seniorityLabel && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{seniorityLabel}</span>
              )}
              {job.minYearsExperience != null && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {job.minYearsExperience}+ años exp.
                </span>
              )}
            </div>
          </div>

          {/* Botones — en mobile se hacen scroll horizontal */}
          <div className="flex flex-row items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Link href="/dashboard/jobs" className={`${headerBtnClasses} shrink-0`}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <Link href={`/dashboard/jobs/${job.id}`} className={`${headerBtnClasses} shrink-0`}>
              <BarChart2 className="h-3.5 w-3.5" />
              Pipeline
            </Link>
            <Link href={`/jobs/${job.slug ?? job.id}`} target="_blank" className={`${headerBtnClasses} shrink-0`}>
              <EyeIcon className="h-3.5 w-3.5" />
              Ver vacante
            </Link>
            <ShareLinkedInButton jobId={job.id} jobTitle={job.title} jobLocation={job.location} />
            <JobActionsMenu jobId={job.id} currentStatus={job.status} />
          </div>
        </header>

        {hasMatchSignals && lockedCount > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-700/40 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {lockedCount} candidato{lockedCount > 1 ? "s" : ""} con AI Match bloqueado
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {plan === "FREE" ? "Actualiza a Starter para ver el AI Match" : "Actualiza a Pro para ver todos los candidatos"}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="self-start rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 sm:self-auto sm:shrink-0"
            >
              Mejorar plan →
            </Link>
          </div>
        )}

        <section className="glass-card rounded-2xl border p-3 sm:p-4">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <FilterPill
              active={allPipelineSelected}
              href={
                buildHref({ pipeline: undefined })
              }
              label={`Todos (${total})`}
              count={total}
            />
            {LIST_SECTIONS.map(key => <FilterPill key={key} active={chosenPipeline === key} href={buildHref({ pipeline: key })} label={`${RECRUITER_PIPELINE_STATE_LABELS[key]} (${counters[key]})`} count={counters[key]} />)}
          </div>
          {integrityCount > 0 && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Advertencia de integridad: {integrityCount} registro{integrityCount === 1 ? "" : "s"} sin etapa verificable. No se incluyen en los conteos de etapa; visibles en Todos y con cambios bloqueados.
          </p>}
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Los conteos incluyen todas las postulaciones de esta vacante, antes de los filtros secundarios.</p>
        </section>


        {apps.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Users className="h-6 w-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                {activeFiltersCount > 0
                  ? "Ningún candidato coincide con los filtros."
                  : total === 0
                    ? "Aún no hay postulaciones."
                    : chosenPipeline
                      ? `Sin candidatos en ${(RECRUITER_PIPELINE_STATE_LABELS[chosenPipeline])}.`
                      : "Aún no hay postulaciones."}
              </p>
              {!activeFiltersCount && total === 0 && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Tu vacante está activa. Compártela para atraer candidatos.
                </p>
              )}
            </div>
            {activeFiltersCount > 0 ? (
              <Link href={buildHref({ match: undefined, cv: undefined, preselected: undefined, assessment: undefined, outcome: undefined })}
                className="inline-block text-sm text-emerald-600 underline hover:no-underline">
                Limpiar filtros
              </Link>
            ) : total === 0 && (
              <ShareLinkedInButton jobId={job.id} jobTitle={job.title} jobLocation={job.location} />
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 bg-white/90 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="border-b border-zinc-100 dark:border-zinc-800 p-3 sm:p-4 space-y-2.5">

              {/* Fila 1: Búsqueda + Ordenar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <form method="get" className="relative w-full sm:max-w-xs">
                  {chosenPipeline && <input type="hidden" name="pipeline" value={chosenPipeline} />}
                  {interestParam && <input type="hidden" name="interest" value={interestParam} />}
                  {sortKey && <input type="hidden" name="sort" value={sortKey} />}
                  <input type="hidden" name="dir" value={sortDirection} />
                  {matchFilter !== "ALL" && <input type="hidden" name="match" value={matchFilter} />}
                  {cvFilter !== "ALL" && <input type="hidden" name="cv" value={cvFilter} />}
                  {preselectedFilter && <input type="hidden" name="preselected" value="1" />}
                  {assessmentFilter !== "ALL" && <input type="hidden" name="assessment" value={assessmentFilter} />}
                  {outcomeFilter && <input type="hidden" name="outcome" value={outcomeFilter} />}
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    name="q"
                    defaultValue={qParam}
                    className="w-full rounded-full border border-zinc-200 bg-white/70 py-1.5 pl-8 pr-3 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="Nombre, email, ciudad, skill o perfil…"
                  />
                </form>

                <div className="flex items-center gap-2 text-xs sm:hidden">
                  <span className="shrink-0 text-zinc-500">Ordenar:</span>
                  <div className="flex flex-wrap rounded-full bg-zinc-100/60 p-0.5 dark:bg-zinc-900/70">
                    <SortPill href={sortHref("match")} active={sortKey === "match"}>Match</SortPill>
                    <SortPill href={sortHref("activity")} active={sortKey === "activity"}>Actividad</SortPill>
                    <SortPill href={sortHref("candidate")} active={sortKey === "candidate"}>Nombre</SortPill>
                    <SortPill href={sortHref("status")} active={sortKey === "status"}>Estado</SortPill>
                  </div>
                </div>
              </div>

              {/* Fila 2: Filtros inline + contador */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {hasMatchSignals && (
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 text-[11px] font-medium text-zinc-400">Match</span>
                    <div className="flex flex-wrap gap-1">
                      {(["ALL", "HIGH", "MED", "LOW"] as MatchFilter[]).map((f) => {
                        const isEmpty = f !== "ALL" && matchCounts[f] === 0 && matchFilter !== f;
                        return (
                          <Link
                            key={f}
                            href={buildHref({ match: f === "ALL" ? undefined : f })}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              matchFilter === f
                                ? f === "HIGH" ? "border-emerald-500 bg-emerald-600 text-white"
                                  : f === "MED" ? "border-amber-500 bg-amber-500 text-white"
                                  : f === "LOW" ? "border-red-400 bg-red-500 text-white"
                                  : "border-zinc-500 bg-zinc-700 text-white dark:bg-zinc-600"
                                : isEmpty
                                ? "border-zinc-200/50 bg-white text-zinc-400 dark:border-zinc-700/50 dark:bg-zinc-900/40 dark:text-zinc-600"
                                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                            }`}
                          >
                            {f === "ALL" ? `Todos (${matchCounts.ALL})`
                              : f === "HIGH" ? `Alto (${matchCounts.HIGH})`
                              : f === "MED" ? `Medio (${matchCounts.MED})`
                              : `Bajo (${matchCounts.LOW})`}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[11px] font-medium text-zinc-400">CV</span>
                  <div className="flex gap-1">
                    {(["ALL", "YES", "NO"] as CvFilter[]).map((f) => (
                      <Link
                        key={f}
                        href={buildHref({ cv: f === "ALL" ? undefined : f })}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          cvFilter === f
                            ? "border-emerald-500 bg-emerald-600 text-white"
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                        }`}
                      >
                        {f === "ALL" ? "Todos" : f === "YES" ? "Con CV" : "Sin CV"}
                      </Link>
                    ))}
                  </div>
                </div>

                <Link href={buildHref({ preselected: preselectedFilter ? undefined : "1" })}
                  aria-pressed={preselectedFilter}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${preselectedFilter ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100" : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}>
                  Solo preselectos
                </Link>
                {(assessmentEnabled || assessmentFilter !== "ALL") && <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-zinc-500">Evaluación:</span>
                  {(["ALL", "NONE", "SENT", "STARTED", "COMPLETED", "EXPIRED"] as RecruiterListAssessment[]).map((state) =>
                    <Link key={state} href={buildHref({ assessment: state === "ALL" ? undefined : state })}
                      aria-current={assessmentFilter === state ? "true" : undefined}
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${assessmentFilter === state ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-100" : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}>
                      {({ ALL: "Todas", NONE: "Sin evaluación", SENT: "Enviada", STARTED: "Iniciada", COMPLETED: "Completada", EXPIRED: "Vencida" } as Record<string, string>)[state]}
                    </Link>)}
                </div>}


                <div className="ml-auto flex items-center gap-3">
                  {activeFiltersCount > 0 && (
                    <Link
                      href={buildHref({ match: undefined, cv: undefined, preselected: undefined, assessment: undefined, outcome: undefined })}
                      className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-zinc-600 whitespace-nowrap"
                    >
                      Limpiar
                    </Link>
                  )}
                  <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                    {apps.length} candidato{apps.length !== 1 ? "s" : ""}{activeFiltersCount > 0 ? " (filtrado)" : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="block divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
              {apps.map((a: any) => {
                const matchResult = a._matchResult!; // Used only inside authorized match branches.
                const gatedFinalScore: number | null = a._gatedFinalScore;
                const locked: boolean = a._locked;
                const profileTypeLabel =
                  PROFILE_TYPE_LABEL[String(a._profileType ?? "").toUpperCase()] ?? null;
                const candidateHref = a.candidate?.id
                  ? `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`
                  : undefined;
                const phone = a.candidate?.phone as string | undefined;
                const resumeUrl = a.candidate?.resumeUrl as string | undefined;
                const assessMeta = assessmentEnabled && chosenTemplateId ? assessmentByAppId.get(a.id) ?? null : null;

                return (
                  <div key={a.id} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {candidateHref ? (
                          <CandidateProfileLink applicationId={a.id} jobId={job.id} source={{ stage: a.stage, disposition: a.disposition, status: a.status, recruiterInterest: a.recruiterInterest, stateVersion: a.stateVersion }} enabled={session?.user?.role === "RECRUITER" && !a._presentation.integrityIssue} href={candidateHref} className="block truncate text-sm font-semibold hover:underline">
                            {a._fullName}
                          </CandidateProfileLink>
                        ) : (
                          <span className="text-sm font-semibold">{a._fullName}</span>
                        )}
                        <p className="truncate text-xs text-zinc-500">{a._location.full ?? "—"}</p>
                        <AssessmentSummary states={assessMeta?.perTemplateState ?? []} detailHref={candidateHref} />
                        {(a.candidate as any)?.desiredSalaryMin != null && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            💰 {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format((a.candidate as any).desiredSalaryMin)}/mes
                          </p>
                        )}
                        {profileTypeLabel && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
                              {profileTypeLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      {hasMatchSignals && (
                        locked ? (
                          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900/40">
                            <Lock className="h-3 w-3 text-zinc-400" />
                            <span className="text-[11px] text-zinc-400">{plan === "FREE" ? "Starter" : "Pro"}</span>
                          </div>
                        ) : (
                          <div className="shrink-0 text-right">
                            <span className={`text-lg font-black leading-none ${scoreToTextColor(gatedFinalScore!)}`}>{gatedFinalScore}%</span>
                            <p className="text-[10px] text-zinc-400">{scoreToLabel(gatedFinalScore!)}</p>
                          </div>
                        )
                      )}
                    </div>

                    {hasMatchSignals && !locked && gatedFinalScore !== null && (
                      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className={`h-1.5 rounded ${scoreToColor(gatedFinalScore)}`} style={{ width: `${gatedFinalScore}%` }} />
                      </div>
                    )}

                    {!locked && hasMatchSignals && (
                      <MatchBreakdownMini
                        matchResult={matchResult}
                        adjustments={a._matchAdjustments}
                        compact
                        showCounts={hasJobSkills}
                      />
                    )}

                    {!locked && hasMatchSignals && <MatchedSkills details={matchResult.details} />}

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <InterestSelect
                          applicationId={a.id}
                          initial={a.recruiterInterest as InterestKey}
                          initialStateVersion={a.stateVersion}
                          legacyStatus={a.status}
                          canonicalStage={a.stage}
                          canonicalDisposition={a.disposition}
                          canonicalRecruiterReadsEnabled={canonicalRecruiterReadsEnabled}
                          integrityIssue={a._presentation.integrityIssue}
                        />
                        {a._presentation.preselected && <span className="text-[10px] text-amber-700 dark:text-amber-300">Perfil preseleccionado</span>}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {phone && (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-900/70" title={phone}>
                            <Phone className="h-3 w-3" />
                          </span>
                        )}
                        {resumeUrl && (
                          <a
                            href={resumeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900/70"
                            title="Ver CV"
                          >
                            <FileTextIcon className="h-3 w-3" />
                          </a>
                        )}
                        <ActionsMenu
                          stageActionsInSelector
                          integrityIssue={a._presentation.integrityIssue}
                          applicationId={a.id}
                          jobId={job.id}
                          processSource={{ stage: a.stage, disposition: a.disposition, status: a.status, recruiterInterest: a.recruiterInterest, stateVersion: a.stateVersion }}
                          canonicalRecruiterReadsEnabled={canonicalRecruiterReadsEnabled}
                          candidateHref={candidateHref}
                          resumeUrl={resumeUrl ?? null}
                          candidateEmail={a.candidate?.email ?? ""}
                          candidatePhone={phone ?? null}
                          candidateName={a._fullName ?? null}
                          recruiterName={recruiterName}
                          jobTitle={job.title}
                          companyName={company?.name ?? null}
                          assessment={
                            assessmentEnabled && chosenTemplateId
                              ? ({
                                  enabled: true,
                                  templateId: assessMeta?.templateId ?? chosenTemplateId,
                                  templateIds: allJobTemplateIds,
                                  templateTitles: jobTemplateTitles,
                                  perTemplateState: assessMeta?.perTemplateState,
                                  state: (assessMeta?.state ?? "NONE") as any,
                                  token: assessMeta?.token ?? null,
                                  attemptId: assessMeta?.attemptId ?? null,
                                } as any)
                              : ({ enabled: false } as any)
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[940px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400">
                  <tr>
                    <th scope="col" aria-sort={sortKey === "candidate" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-3 py-2.5 font-medium"><Link href={sortHref("candidate")} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Candidato {sortKey === "candidate" ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</Link></th>
                    <th scope="col" aria-sort={sortKey === "match" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-3 py-2.5 font-medium">
                      <Link href={sortHref("match")} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">AI Match / Skills {sortKey === "match" ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</Link>{!hasMatchSignals && <span className="ml-1 font-normal text-zinc-400">(sin señales)</span>}
                    </th>
                    <th scope="col" aria-sort={sortKey === "status" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-3 py-2.5 font-medium"><Link href={sortHref("status")} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Etapa {sortKey === "status" ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</Link></th>
                    <th scope="col" aria-sort={sortKey === "activity" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-3 py-2.5 font-medium"><Link href={sortHref("activity")} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Última actividad {sortKey === "activity" ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</Link></th>
                    <th className="px-3 py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a: any) => {
                    const matchResult = a._matchResult!; // Used only inside authorized match branches.
                    const gatedFinalScore: number | null = a._gatedFinalScore;
                    const locked: boolean = a._locked;
                    const candidateHref = a.candidate?.id
                      ? `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`
                      : undefined;
                    const phone = a.candidate?.phone as string | undefined;
                    const resumeUrl = a.candidate?.resumeUrl as string | undefined;
                    const assessMeta = assessmentEnabled && chosenTemplateId ? assessmentByAppId.get(a.id) ?? null : null;

                    return (
                      <tr key={a.id} className="align-middle border-t border-zinc-100 transition-colors hover:bg-zinc-50/70 dark:border-zinc-800 dark:hover:bg-zinc-900/40">
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {candidateHref ? (
                              <CandidateProfileLink applicationId={a.id} jobId={job.id} source={{ stage: a.stage, disposition: a.disposition, status: a.status, recruiterInterest: a.recruiterInterest, stateVersion: a.stateVersion }} enabled={session?.user?.role === "RECRUITER" && !a._presentation.integrityIssue} href={candidateHref} className="block max-w-[240px] truncate font-semibold text-zinc-900 hover:text-emerald-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-100" title={a._fullName}>{a._fullName}</CandidateProfileLink>
                            ) : (
                              <span className="font-medium">{a._fullName}</span>
                            )}

                            {a._location.full && <span className="max-w-[240px] truncate text-xs text-zinc-500" title={a._location.full}>{a._location.full}</span>}

                            <AssessmentSummary states={assessMeta?.perTemplateState ?? []} detailHref={candidateHref} />
                          </div>
                        </td>

                        <td className="px-3 py-2.5">
                          {!hasMatchSignals ? (
                            <span className="text-xs text-zinc-400">Sin análisis</span>
                          ) : locked ? (
                            <div className="group relative inline-flex cursor-pointer items-center gap-1.5">
                              <div className="flex h-8 w-20 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40">
                                <Lock className="h-3.5 w-3.5 text-zinc-400" />
                                <span className="text-xs font-medium text-zinc-400">{plan === "FREE" ? "Starter" : "Pro"}</span>
                              </div>
                              <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-52 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-xl group-hover:block dark:border-zinc-700 dark:bg-zinc-900">
                                <p className="font-semibold text-zinc-800 dark:text-zinc-100">AI Match bloqueado</p>
                                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                                  Mejora a {plan === "FREE" ? "Starter" : "Pro"} para ver este score.
                                </p>
                                <Link
                                  href="/dashboard/billing"
                                  className="pointer-events-auto mt-2 block rounded-lg bg-emerald-600 px-2 py-1.5 text-center font-semibold text-white hover:bg-emerald-700"
                                >
                                  Ver planes →
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <MatchScorePopover
                              score={gatedFinalScore!}
                              matchResult={matchResult}
                              adjustments={a._matchAdjustments}
                              jobSkillCount={jobSkillsForEngine.length}
                              scoreColor={scoreToColor(gatedFinalScore!)}
                              scoreTextColor={scoreToTextColor(gatedFinalScore!)}
                              scoreLabel={scoreToLabel(gatedFinalScore!)}
                              candidateId={a.candidate?.id}
                              jobId={job.id}
                            />
                          )}
                          {!locked && hasMatchSignals && <MatchedSkills details={matchResult.details} />}
                        </td>

                        <td className="min-w-[145px] px-3 py-2.5">
                          <div className="space-y-1.5">
                            <InterestSelect
                              applicationId={a.id}
                              initial={a.recruiterInterest as InterestKey}
                              initialStateVersion={a.stateVersion}
                              legacyStatus={a.status}
                              canonicalStage={a.stage}
                              canonicalDisposition={a.disposition}
                              canonicalRecruiterReadsEnabled={canonicalRecruiterReadsEnabled}
                          integrityIssue={a._presentation.integrityIssue}
                            />
                            {a._presentation.preselected && <span className="text-[10px] text-amber-700 dark:text-amber-300">Perfil preseleccionado</span>}
                          </div>
                        </td>

                        <td className="px-3 py-2.5" title={a._activity.at.toISOString()}>
                          <span className="block text-[10px] text-zinc-400">
                            {a._activity.kind === "APPLICATION" ? "Postulación" : "Actividad del proceso"}
                          </span>
                          <span className="text-xs text-zinc-500">{fromNow(a._activity.at)}</span>
                        </td>

                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <ActionsMenu
                          stageActionsInSelector
                          integrityIssue={a._presentation.integrityIssue}
                              applicationId={a.id}
                              jobId={job.id}
                              processSource={{ stage: a.stage, disposition: a.disposition, status: a.status, recruiterInterest: a.recruiterInterest, stateVersion: a.stateVersion }}
                              canonicalRecruiterReadsEnabled={canonicalRecruiterReadsEnabled}
                              candidateHref={candidateHref}
                              resumeUrl={resumeUrl ?? null}
                              candidateEmail={a.candidate?.email ?? ""}
                              candidatePhone={phone ?? null}
                              candidateName={a._fullName ?? null}
                              recruiterName={recruiterName}
                              jobTitle={job.title}
                              companyName={company?.name ?? null}
                              assessment={
                                assessmentEnabled && chosenTemplateId
                                  ? ({
                                      enabled: true,
                                      templateId: assessMeta?.templateId ?? chosenTemplateId,
                                      templateIds: allJobTemplateIds,
                                      templateTitles: jobTemplateTitles,
                                      state: (assessMeta?.state ?? "NONE") as any,
                                      token: assessMeta?.token ?? null,
                                      attemptId: assessMeta?.attemptId ?? null,
                                      perTemplateState: assessMeta?.perTemplateState,
                                    } as any)
                                  : ({ enabled: false } as any)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterPill({ active, href, label, count }: { active?: boolean; href: string; label: string; count?: number }) {
  const isEmpty = typeof count === "number" && count === 0 && !active;
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition sm:px-4 ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
          : isEmpty
          ? "border-zinc-200/50 bg-transparent text-zinc-400 hover:bg-zinc-100/40 dark:border-zinc-700/50 dark:text-zinc-600"
          : "border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-100/70 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
      }`}
    >
      {label}
    </Link>
  );
}

function SortPill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-2.5 py-1 text-xs transition sm:px-3 ${
        active
          ? "bg-white text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-200"
          : "text-zinc-500 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
      }`}
    >
      {children}
    </Link>
  );
}
