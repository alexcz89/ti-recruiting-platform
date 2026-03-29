// app/dashboard/jobs/[id]/applications/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { notFound } from "next/navigation";
import { fromNow } from "@/lib/dates";
import InterestSelect from "./InterestSelect";
import ActionsMenu from "./ActionsMenu";
import { Phone, FileText as FileTextIcon, Search, Lock, SlidersHorizontal } from "lucide-react";
import JobActionsMenu from "@/components/dashboard/JobActionsMenu";
import MatchScorePopover from "@/components/dashboard/MatchScorePopover";
import MatchBreakdownMini from "@/components/jobs/MatchBreakdownMini";
import { computeTagBoost } from "@/lib/ai/tagBoost";
import {
  computeMatchScore,
  applyPlanGate,
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  type BillingPlan,
  type JobSkillInput,
  type CandidateSkillInput,
  type SeniorityLevel,
} from "@/lib/ai/matchScore";

const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional",
  CONVERSATIONAL: "Conversacional",
  BASIC: "Básico",
};

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
const INTEREST_LABEL: Record<InterestKey, string> = {
  REVIEW: "En revisión",
  MAYBE: "En duda",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
};

function getAppInterest(a: any): InterestKey {
  const raw = (a?.recruiterInterest ?? "").toString().toUpperCase();
  if (raw === "MAYBE" || raw === "ACCEPTED" || raw === "REJECTED") return raw;
  return "REVIEW";
}

type SortKey = "match" | "recent" | "name";
type MatchFilter = "ALL" | "HIGH" | "MED" | "LOW";
type CvFilter = "ALL" | "YES" | "NO";

function scoreToRange(score: number): "HIGH" | "MED" | "LOW" {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MED";
  return "LOW";
}

function toSeniorityLevel(s: string | null | undefined): SeniorityLevel | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "junior" || lower === "mid" || lower === "senior") return lower;
  return null;
}

function adjustScoreByProfileType(params: {
  baseScore: number;
  profileType: string | null | undefined;
  jobIsTech: boolean;
}): number {
  const { baseScore, profileType, jobIsTech } = params;

  let score = baseScore;
  const normalizedProfile = String(profileType ?? "").toUpperCase();

  if (!jobIsTech || !normalizedProfile) {
    return Math.max(0, Math.min(100, score));
  }

  if (normalizedProfile === "RECRUITING" || normalizedProfile === "BUSINESS") {
    score -= 15;
  } else if (normalizedProfile === "HYBRID") {
    score -= 5;
  } else if (normalizedProfile === "ENGINEERING") {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    interest?: InterestKey | "ALL";
    q?: string;
    sort?: SortKey | string;
    match?: MatchFilter | string;
    cv?: CvFilter | string;
  };
}) {
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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });
  const plan = (company?.billingPlan ?? "FREE") as BillingPlan;

  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: {
      id: true,
      title: true,
      status: true,
      seniority: true,
      minYearsExperience: true,
      company: { select: { name: true } },
      skills: true,
      requiredSkills: {
        select: {
          must: true,
          weight: true,
          term: { select: { id: true, label: true } },
        },
      },
      assessments: {
        orderBy: { createdAt: "asc" },
        select: { templateId: true },
      },
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!job) notFound();

  const chosenTemplateId = job.assessments?.[0]?.templateId ?? null;
  const assessmentEnabled = Boolean(chosenTemplateId);

  const jobSkillsForEngine: JobSkillInput[] = job.requiredSkills.map((rs) => ({
    termId: rs.term.id,
    label: rs.term.label,
    must: rs.must,
    weight: rs.weight,
  }));

  const jobSeniorityForEngine = toSeniorityLevel(job.seniority);

  const hasJobSkills = jobSkillsForEngine.length > 0;
  const hasMatchSignals =
    hasJobSkills || jobSeniorityForEngine !== null || job.minYearsExperience !== null;

  const allApps = await prisma.application.findMany({
    where: { jobId: job.id, job: { companyId } },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          resumeUrl: true,
          phone: true,
          location: true,
          certifications: true,
          seniority: true,
          yearsExperience: true,
          aiProfile: {
            select: {
              tags: true,
              profileType: true,
            },
          },
          candidateSkills: {
            select: {
              level: true,
              term: { select: { id: true, label: true } },
            },
          },
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

  type AssessmentRowMeta = {
    enabled: boolean;
    templateId: string;
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    token: string | null;
    attemptId: string | null;
    score: number | null;
  };

  const assessmentByAppId = new Map<string, AssessmentRowMeta>();

  if (assessmentEnabled && chosenTemplateId && allApps.length) {
    const applicationIds = allApps.map((a) => a.id);
    const now = new Date();

    const [invites, attempts] = await Promise.all([
      prisma.assessmentInvite.findMany({
        where: { applicationId: { in: applicationIds }, templateId: chosenTemplateId },
        orderBy: { updatedAt: "desc" },
        select: { applicationId: true, token: true, status: true, expiresAt: true, updatedAt: true },
      }),
      prisma.assessmentAttempt.findMany({
        where: { applicationId: { in: applicationIds }, templateId: chosenTemplateId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, applicationId: true, status: true, totalScore: true, updatedAt: true, expiresAt: true },
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

    const attemptMap = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      if (!a.applicationId) continue;
      const prev = attemptMap.get(a.applicationId);
      if (!prev || statusRank(a.status) >= statusRank(prev.status)) {
        attemptMap.set(a.applicationId, a);
      }
    }

    const inviteMap = new Map<string, (typeof invites)[number]>();
    for (const inv of invites) {
      if (inv.applicationId && !inviteMap.has(inv.applicationId)) {
        inviteMap.set(inv.applicationId, inv);
      }
    }

    for (const appId of applicationIds) {
      const at = attemptMap.get(appId);
      const iv = inviteMap.get(appId);
      const attemptExpired = !!at?.expiresAt && new Date(at.expiresAt) <= now;
      const inviteExpired = !!iv?.expiresAt && new Date(iv.expiresAt) <= now;

      if (at && (at.status === "SUBMITTED" || at.status === "EVALUATED" || at.status === "COMPLETED")) {
        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: "COMPLETED",
          token: iv?.token ?? null,
          attemptId: at.id,
          score: at.totalScore ?? null,
        });
        continue;
      }

      if (attemptExpired || inviteExpired) {
        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: "EXPIRED",
          token: iv?.token ?? null,
          attemptId: at?.id ?? null,
          score: null,
        });
        continue;
      }

      if (at && at.status === "IN_PROGRESS") {
        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: "STARTED",
          token: iv?.token ?? null,
          attemptId: at.id,
          score: null,
        });
        continue;
      }

      if (iv) {
        const invStatus = String(iv.status || "").toUpperCase();

        if (invStatus === "CANCELLED" || invStatus === "REVOKED") {
          assessmentByAppId.set(appId, {
            enabled: true,
            templateId: chosenTemplateId,
            state: "EXPIRED",
            token: iv.token ?? null,
            attemptId: at?.id ?? null,
            score: null,
          });
          continue;
        }

        if (isFinalInvite(iv.status)) {
          assessmentByAppId.set(appId, {
            enabled: true,
            templateId: chosenTemplateId,
            state: "COMPLETED",
            token: iv.token ?? null,
            attemptId: at?.id ?? null,
            score: at?.totalScore ?? null,
          });
          continue;
        }

        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: invStatus === "STARTED" ? "STARTED" : "SENT",
          token: iv.token ?? null,
          attemptId: null,
          score: null,
        });
        continue;
      }

      assessmentByAppId.set(appId, {
        enabled: true,
        templateId: chosenTemplateId,
        state: "NONE",
        token: null,
        attemptId: null,
        score: null,
      });
    }
  }

  const counters: Record<InterestKey, number> = { REVIEW: 0, MAYBE: 0, ACCEPTED: 0, REJECTED: 0 };
  for (const a of allApps) counters[getAppInterest(a)]++;
  const total = allApps.length;

  const interestParam = searchParams?.interest as string | undefined;
  const chosenInterest: InterestKey | undefined = !interestParam
    ? "REVIEW"
    : interestParam === "ALL"
      ? undefined
      : (interestParam as InterestKey);

  const qParam = (searchParams?.q ?? "").toString();
  const q = qParam.trim().toLowerCase();
  const sortParamRaw = (searchParams?.sort as string | undefined) ?? "match";
  const sortKey: SortKey = sortParamRaw === "recent" || sortParamRaw === "name" ? sortParamRaw : "match";
  const matchParam = (searchParams?.match as string | undefined) ?? "ALL";
  const matchFilter: MatchFilter = ["HIGH", "MED", "LOW"].includes(matchParam) ? (matchParam as MatchFilter) : "ALL";
  const cvParam = (searchParams?.cv as string | undefined) ?? "ALL";
  const cvFilter: CvFilter = cvParam === "YES" || cvParam === "NO" ? (cvParam as CvFilter) : "ALL";

  let enriched = allApps.map((a) => {
    const candidateSkillsForEngine: CandidateSkillInput[] = (a.candidate?.candidateSkills ?? []).map((cs: any) => ({
      termId: cs.term.id,
      label: cs.term.label,
      level: cs.level,
    }));

    const matchResult = computeMatchScore({
      jobSkills: jobSkillsForEngine,
      candidateSkills: candidateSkillsForEngine,
      jobSeniority: jobSeniorityForEngine,
      candidateSeniority: toSeniorityLevel((a.candidate as any)?.seniority),
      jobMinYearsExperience: job.minYearsExperience ?? null,
      candidateYearsExperience: (a.candidate as any)?.yearsExperience ?? null,
    });

    const baseScore = matchResult?.score ?? 0;
    const profileType = a.candidate?.aiProfile?.profileType ?? null;

    const tagBoost = computeTagBoost({
      candidateTags: Array.isArray(a.candidate?.aiProfile?.tags) ? a.candidate.aiProfile.tags : [],
      jobTitle: job.title,
      jobSkills: job.requiredSkills.map((s) => s.term.label),
    });

    const scoreAfterProfile = adjustScoreByProfileType({
      baseScore,
      profileType,
      jobIsTech: hasJobSkills,
    });

    const finalScore = Math.max(0, Math.min(100, scoreAfterProfile + tagBoost));

    const fullName =
      a.candidate?.name ||
      [(a.candidate as any)?.firstName, (a.candidate as any)?.lastName].filter(Boolean).join(" ") ||
      "—";

    return {
      ...a,
      _matchResult: matchResult,
      _score: baseScore,
      _profileType: profileType,
      _profileAdjustedScore: scoreAfterProfile,
      _finalScore: finalScore,
      _tagBoost: tagBoost,
      _fullName: fullName,
      _lastActivity: a.createdAt,
      _hasCV: Boolean(a.candidate?.resumeUrl),
    };
  });

  if (chosenInterest) {
    enriched = enriched.filter((a) => getAppInterest(a) === chosenInterest);
  }

  if (q) {
    enriched = enriched.filter((a) => {
      const skills = (a.candidate?.candidateSkills ?? []).map((cs: any) => cs.term.label).join(" ");
      const profileTypeLabel = PROFILE_TYPE_LABEL[String(a._profileType ?? "").toUpperCase()] ?? "";
      const haystack = [a._fullName, a.candidate?.email ?? "", a.candidate?.location ?? "", skills, profileTypeLabel]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const sorted = [...enriched].sort((a, b) => {
    if (sortKey === "recent") return new Date(b._lastActivity).getTime() - new Date(a._lastActivity).getTime();
    if (sortKey === "name") return (a._fullName || "").localeCompare(b._fullName || "", "es", { sensitivity: "base" });
    return (b._finalScore ?? 0) - (a._finalScore ?? 0);
  });

  const withGate = sorted.map((a, idx) => {
    const gatedScore = applyPlanGate(a._score, idx, plan);
    const gatedFinalScore = applyPlanGate(a._finalScore, idx, plan);
    return {
      ...a,
      _gatedScore: gatedScore,
      _gatedFinalScore: gatedFinalScore,
      _locked: gatedScore === null,
    };
  });

  const apps = withGate.filter((a) => {
    if (matchFilter !== "ALL" && hasMatchSignals && !a._locked) {
      if (scoreToRange(a._gatedFinalScore ?? 0) !== matchFilter) return false;
    }
    if (cvFilter === "YES" && !a._hasCV) return false;
    if (cvFilter === "NO" && a._hasCV) return false;
    return true;
  });

  const lockedCount = withGate.filter((a) => a._locked).length;

  const matchCounts: Record<MatchFilter, number> = { ALL: 0, HIGH: 0, MED: 0, LOW: 0 };
  for (const a of withGate) {
    matchCounts.ALL++;
    if (!a._locked && hasMatchSignals) {
      matchCounts[scoreToRange(a._gatedFinalScore ?? 0)]++;
    }
  }

  function buildHref(overrides: { interest?: string; q?: string; sort?: string; match?: string; cv?: string }) {
    const usp = new URLSearchParams();
    const i = "interest" in overrides ? overrides.interest : interestParam;
    const qv = "q" in overrides ? overrides.q : qParam;
    const sv = "sort" in overrides ? overrides.sort : sortKey;
    const mv = "match" in overrides ? overrides.match : matchFilter !== "ALL" ? matchFilter : undefined;
    const cv = "cv" in overrides ? overrides.cv : cvFilter !== "ALL" ? cvFilter : undefined;

    if (i) usp.set("interest", i);
    if (qv) usp.set("q", qv);
    if (sv) usp.set("sort", sv);
    if (mv) usp.set("match", mv);
    if (cv) usp.set("cv", cv);

    return `/dashboard/jobs/${params.id}/applications${usp.toString() ? `?${usp.toString()}` : ""}`;
  }

  const headerBtnClasses =
    "inline-flex items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900";

  const activeFiltersCount = (matchFilter !== "ALL" ? 1 : 0) + (cvFilter !== "ALL" ? 1 : 0);

  const seniorityLabel = job.seniority
    ? { JUNIOR: "Junior", MID: "Mid", SENIOR: "Senior", LEAD: "Lead" }[job.seniority] ?? job.seniority
    : null;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="space-y-3">
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">{job.title}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {job.company?.name ?? "—"}
              {job.location ? ` · ${job.location}` : ""} · {fromNow(job.createdAt)}
              {seniorityLabel && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{seniorityLabel}</span>
              )}
              {job.minYearsExperience != null && (
                <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                  {job.minYearsExperience}+ años
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Link href={`/dashboard/jobs/${job.id}`} className={headerBtnClasses}>Pipeline</Link>
            <Link href={`/jobs/${job.id}`} target="_blank" className={headerBtnClasses}>Ver vacante</Link>
            <Link href="/dashboard/jobs" className={headerBtnClasses}>← Vacantes</Link>
            <JobActionsMenu jobId={job.id} currentStatus={job.status} />
          </div>
        </header>

        {lockedCount > 0 && (
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
            <FilterPill active={interestParam === "ALL"} href={buildHref({ interest: "ALL" })} label={`Todos (${total})`} />
            <FilterPill active={chosenInterest === "REVIEW"} href={buildHref({ interest: "REVIEW" })} label={`Revisión (${counters.REVIEW})`} />
            <FilterPill active={chosenInterest === "MAYBE"} href={buildHref({ interest: "MAYBE" })} label={`En duda (${counters.MAYBE})`} />
            <FilterPill active={chosenInterest === "ACCEPTED"} href={buildHref({ interest: "ACCEPTED" })} label={`Aceptados (${counters.ACCEPTED})`} />
            <FilterPill active={chosenInterest === "REJECTED"} href={buildHref({ interest: "REJECTED" })} label={`Rechazados (${counters.REJECTED})`} />
          </div>
        </section>

        <section className="glass-card rounded-2xl border p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Filtrar por</span>
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
              {activeFiltersCount > 0 && (
                <Link
                  href={buildHref({ match: undefined, cv: undefined })}
                  className="ml-auto text-[11px] text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
                >
                  Limpiar
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              {hasMatchSignals && (
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-[11px] text-zinc-400">Match</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(["ALL", "HIGH", "MED", "LOW"] as MatchFilter[]).map((f) => (
                      <Link
                        key={f}
                        href={buildHref({ match: f === "ALL" ? undefined : f })}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          matchFilter === f
                            ? f === "HIGH"
                              ? "border-emerald-500 bg-emerald-600 text-white"
                              : f === "MED"
                                ? "border-amber-500 bg-amber-500 text-white"
                                : f === "LOW"
                                  ? "border-red-400 bg-red-500 text-white"
                                  : "border-zinc-500 bg-zinc-700 text-white dark:border-zinc-400 dark:bg-zinc-600"
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                        }`}
                      >
                        {f === "ALL"
                          ? `Todos (${matchCounts.ALL})`
                          : f === "HIGH"
                            ? `Alto (${matchCounts.HIGH})`
                            : f === "MED"
                              ? `Medio (${matchCounts.MED})`
                              : `Bajo (${matchCounts.LOW})`}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-[11px] text-zinc-400">CV</span>
                <div className="flex gap-1.5">
                  {(["ALL", "YES", "NO"] as CvFilter[]).map((f) => (
                    <Link
                      key={f}
                      href={buildHref({ cv: f === "ALL" ? undefined : f })}
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
            </div>
          </div>
        </section>

        {apps.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-6 text-center">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
              {activeFiltersCount > 0
                ? "Ningún candidato coincide con los filtros."
                : chosenInterest
                  ? `Sin candidatos en ${INTEREST_LABEL[chosenInterest]}.`
                  : "Aún no hay postulaciones."}
            </p>
            {activeFiltersCount > 0 && (
              <Link href={buildHref({ match: undefined, cv: undefined })} className="mt-2 inline-block text-sm text-emerald-600 underline hover:no-underline">
                Limpiar filtros
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 bg-white/90 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="flex flex-col gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <form method="get" className="relative w-full sm:max-w-xs">
                {interestParam && <input type="hidden" name="interest" value={interestParam} />}
                {sortKey && <input type="hidden" name="sort" value={sortKey} />}
                {matchFilter !== "ALL" && <input type="hidden" name="match" value={matchFilter} />}
                {cvFilter !== "ALL" && <input type="hidden" name="cv" value={cvFilter} />}
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  name="q"
                  defaultValue={qParam}
                  className="w-full rounded-full border border-zinc-200 bg-white/70 py-1.5 pl-8 pr-3 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  placeholder="Nombre, email, ciudad, skill o perfil…"
                />
              </form>

              <div className="flex items-center gap-2 text-xs">
                <span className="shrink-0 text-zinc-500">Ordenar:</span>
                <div className="inline-flex rounded-full bg-zinc-100/60 p-0.5 dark:bg-zinc-900/70">
                  <SortPill href={buildHref({ sort: "match" })} active={sortKey === "match"}>Match</SortPill>
                  <SortPill href={buildHref({ sort: "recent" })} active={sortKey === "recent"}>Reciente</SortPill>
                  <SortPill href={buildHref({ sort: "name" })} active={sortKey === "name"}>Nombre</SortPill>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 text-[11px] text-zinc-400">
              {apps.length} candidato{apps.length !== 1 ? "s" : ""}{activeFiltersCount > 0 ? " (filtrado)" : ""}
            </div>

            <div className="block divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
              {apps.map((a: any) => {
                const matchResult = a._matchResult;
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
                          <Link href={candidateHref} className="block truncate text-sm font-semibold hover:underline">
                            {a._fullName}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold">{a._fullName}</span>
                        )}
                        <p className="truncate text-xs text-zinc-500">{a.candidate?.location ?? "—"}</p>
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
                        compact
                        showCounts={hasJobSkills}
                      />
                    )}

                    {!locked && hasJobSkills && matchResult.details.filter((d: any) => d.matched).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {matchResult.details.filter((d: any) => d.matched).slice(0, 3).map((d: any) => (
                          <span
                            key={d.termId}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              d.must
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                                : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
                            }`}
                          >
                            {d.label}
                          </span>
                        ))}
                        {matchResult.matchedCount > 3 && (
                          <span className="text-[10px] text-zinc-400">+{matchResult.matchedCount - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 max-w-[160px]">
                        <InterestSelect applicationId={a.id} initial={getAppInterest(a)} />
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
                          applicationId={a.id}
                          jobId={job.id}
                          candidateHref={candidateHref}
                          resumeUrl={resumeUrl ?? null}
                          candidateEmail={a.candidate?.email ?? ""}
                          candidatePhone={phone ?? null}
                          assessment={
                            assessmentEnabled && chosenTemplateId
                              ? ({
                                  enabled: true,
                                  templateId: chosenTemplateId,
                                  state: (assessMeta?.state ?? "NONE") as any,
                                  token: assessMeta?.token ?? null,
                                  attemptId: assessMeta?.attemptId ?? null,
                                } as any)
                              : ({ enabled: false } as any)
                          }
                        />
                      </div>
                    </div>

                    {assessMeta?.enabled && assessMeta.state !== "NONE" && (
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          assessMeta.state === "COMPLETED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
                            : assessMeta.state === "STARTED"
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : assessMeta.state === "EXPIRED"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-violet-200 bg-violet-50 text-violet-700",
                        ].join(" ")}
                      >
                        {assessMeta.state === "COMPLETED"
                          ? `Assessment: ${typeof assessMeta.score === "number" ? `${assessMeta.score}%` : "OK"}`
                          : assessMeta.state === "STARTED"
                            ? "Assessment: iniciado"
                            : assessMeta.state === "EXPIRED"
                              ? "Assessment: expirado"
                              : "Assessment: enviado"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Candidato</th>
                    <th className="px-3 py-2.5 font-medium">
                      {hasMatchSignals ? "AI Match" : <span className="text-zinc-400">AI Match <span className="font-normal">(sin señales)</span></span>}
                    </th>
                    <th className="px-3 py-2.5 font-medium">Skills</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 font-medium">Actividad</th>
                    <th className="px-3 py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a: any) => {
                    const matchResult = a._matchResult;
                    const gatedFinalScore: number | null = a._gatedFinalScore;
                    const locked: boolean = a._locked;
                    const matchedDetails = (matchResult?.details ?? []).filter((d: any) => d.matched).slice(0, 4);
                    const hiddenCount = Math.max(0, (matchResult?.matchedCount ?? 0) - matchedDetails.length);
                    const candidateHref = a.candidate?.id
                      ? `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`
                      : undefined;
                    const phone = a.candidate?.phone as string | undefined;
                    const resumeUrl = a.candidate?.resumeUrl as string | undefined;
                    const hasWhatsApp = phone?.trim().startsWith("+52");
                    const assessMeta = assessmentEnabled && chosenTemplateId ? assessmentByAppId.get(a.id) ?? null : null;
                    const languages = a.candidate?.candidateLanguages ?? [];
                    const profileTypeLabel =
                      PROFILE_TYPE_LABEL[String(a._profileType ?? "").toUpperCase()] ?? null;

                    return (
                      <tr key={a.id} className="align-top border-t border-zinc-100 transition-colors hover:bg-zinc-50/40 dark:border-zinc-800 dark:hover:bg-zinc-900/20">
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {candidateHref ? (
                              <Link href={candidateHref} className="font-medium hover:underline">{a._fullName}</Link>
                            ) : (
                              <span className="font-medium">{a._fullName}</span>
                            )}

                            <span className="text-xs text-zinc-500">{a.candidate?.location ?? "—"}</span>

                            {profileTypeLabel && (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
                                  {profileTypeLabel}
                                </span>
                              </div>
                            )}

                            {languages.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {languages.slice(0, 2).map((l: any) => (
                                  <span
                                    key={`${l.term.label}-${l.level}`}
                                    className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300"
                                  >
                                    {l.term.label} {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
                                  </span>
                                ))}
                                {languages.length > 2 && <span className="text-[10px] text-zinc-400">+{languages.length - 2}</span>}
                              </div>
                            )}

                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              {phone && (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-900/70" title={`Tel: ${phone}`}>
                                  <Phone className="h-3 w-3" />
                                </span>
                              )}
                              {resumeUrl && (
                                <a
                                  href={resumeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900/70"
                                  title="Ver CV"
                                >
                                  <FileTextIcon className="h-3 w-3" />
                                </a>
                              )}
                              {hasWhatsApp && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                  WA
                                </span>
                              )}
                            </div>

                            {assessMeta?.enabled && assessMeta.state !== "NONE" && (
                              <span
                                className={[
                                  "mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                  assessMeta.state === "COMPLETED"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
                                    : assessMeta.state === "STARTED"
                                      ? "border-sky-200 bg-sky-50 text-sky-700"
                                      : assessMeta.state === "EXPIRED"
                                        ? "border-amber-200 bg-amber-50 text-amber-800"
                                        : "border-violet-200 bg-violet-50 text-violet-700",
                                ].join(" ")}
                              >
                                {assessMeta.state === "COMPLETED"
                                  ? `Assessment: ${typeof assessMeta.score === "number" ? `${assessMeta.score}%` : "OK"}`
                                  : assessMeta.state === "STARTED"
                                    ? "Iniciado"
                                    : assessMeta.state === "EXPIRED"
                                      ? "Expirado"
                                      : "Enviado"}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-2.5">
                          {!hasMatchSignals ? (
                            <span className="text-xs text-zinc-400">—</span>
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
                            <div className="space-y-1.5">
                              <MatchScorePopover
                                score={gatedFinalScore!}
                                matchResult={matchResult}
                                jobSkillCount={jobSkillsForEngine.length}
                                scoreColor={scoreToColor(gatedFinalScore!)}
                                scoreTextColor={scoreToTextColor(gatedFinalScore!)}
                                scoreLabel={scoreToLabel(gatedFinalScore!)}
                                candidateId={a.candidate?.id}
                                jobId={job.id}
                              />
                              <MatchBreakdownMini
                                matchResult={matchResult}
                                showCounts={hasJobSkills}
                              />
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          {locked ? (
                            <span className="text-xs text-zinc-400">—</span>
                          ) : matchedDetails.length ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {matchedDetails.map((d: any, i: number) => (
                                <span
                                  key={`${d.termId}-${i}`}
                                  title={d.must ? "Requerida" : "Deseable"}
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                                    d.must
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-600/60 dark:bg-emerald-900/20 dark:text-emerald-200"
                                      : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
                                  }`}
                                >
                                  {d.must && <span className="mr-1 text-[9px] font-bold uppercase">Req</span>}
                                  {d.label}
                                  {d.candidateLevel && <span className="ml-1 text-[9px] opacity-50">L{d.candidateLevel}</span>}
                                </span>
                              ))}
                              {hiddenCount > 0 && <span className="text-[10px] text-zinc-400">+{hiddenCount}</span>}
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="inline-flex min-w-[130px] max-w-[150px]">
                            <InterestSelect applicationId={a.id} initial={getAppInterest(a)} />
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-xs text-zinc-500" title={new Date(a._lastActivity).toLocaleString()}>
                          {fromNow(a._lastActivity)}
                        </td>

                        <td className="px-3 py-2.5 align-top">
                          <ActionsMenu
                            applicationId={a.id}
                            jobId={job.id}
                            candidateHref={candidateHref}
                            resumeUrl={resumeUrl ?? null}
                            candidateEmail={a.candidate?.email ?? ""}
                            candidatePhone={phone ?? null}
                            assessment={
                              assessmentEnabled && chosenTemplateId
                                ? ({
                                    enabled: true,
                                    templateId: chosenTemplateId,
                                    state: (assessMeta?.state ?? "NONE") as any,
                                    token: assessMeta?.token ?? null,
                                    attemptId: assessMeta?.attemptId ?? null,
                                  } as any)
                                : ({ enabled: false } as any)
                            }
                          />
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

function FilterPill({ active, href, label }: { active?: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition sm:px-4 ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
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