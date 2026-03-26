// app/dashboard/candidates/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import Link from "next/link";
import {
  computeMatchScore,
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  hasMatchSignals,
  type BillingPlan,
  type JobSkillInput,
  type CandidateSkillInput,
  type SeniorityLevel,
} from "@/lib/ai/matchScore";
import {
  ArrowLeft,
  Download,
  GitBranch,
  Lock,
  CheckCircle2,
  XCircle,
  Send,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import CandidateSummaryCard from "@/components/dashboard/CandidateSummaryCard";
import SendAssessmentButton from "@/components/dashboard/SendAssessmentButton";

export const metadata = { title: "Candidato | Panel" };

const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};

const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
};

function toSeniorityLevel(s: string | null | undefined): SeniorityLevel | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "junior" || lower === "mid" || lower === "senior") return lower;
  return null;
}

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { applicationId?: string; jobId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/candidates");

  const me = await prisma.user.findUnique({
    where: { email: session.user?.email! },
    select: { id: true, role: true, companyId: true },
  });
  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) redirect("/");
  const companyId = me.companyId ?? null;

  const company = companyId
    ? await prisma.company.findUnique({
        where: { id: companyId },
        select: { billingPlan: true },
      })
    : null;
  const plan = (company?.billingPlan ?? "FREE") as BillingPlan;

  const candidate = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      role: true,
      certifications: true,
      seniority: true,
      yearsExperience: true,
      candidateSkills: {
        select: {
          id: true,
          level: true,
          term: { select: { id: true, label: true } },
        },
        orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
      },
      candidateLanguages: {
        select: {
          level: true,
          term: { select: { label: true } },
        },
      },
    },
  });
  if (!candidate) notFound();
  if (candidate.role !== "CANDIDATE") redirect("/dashboard");

  const fromJobId = searchParams?.jobId;
  const activeAppId = searchParams?.applicationId || "";

  let jobForMatch: {
    id: string;
    title: string;
    seniority: string | null;
    minYearsExperience: number | null;
    requiredSkills: JobSkillInput[];
    assessmentTemplateId: string | null;
  } | null = null;

  if (fromJobId && companyId) {
    const jobRaw = await prisma.job.findFirst({
      where: { id: fromJobId, companyId },
      select: {
        id: true,
        title: true,
        seniority: true,
        minYearsExperience: true,
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
          take: 1,
        },
      },
    });

    if (jobRaw) {
      jobForMatch = {
        id: jobRaw.id,
        title: jobRaw.title,
        seniority: jobRaw.seniority ?? null,
        minYearsExperience: jobRaw.minYearsExperience ?? null,
        requiredSkills: jobRaw.requiredSkills.map((rs) => ({
          termId: rs.term.id,
          label: rs.term.label,
          must: rs.must,
          weight: rs.weight,
        })),
        assessmentTemplateId: jobRaw.assessments?.[0]?.templateId ?? null,
      };
    }
  }

  // Fetch assessment state for the active application
  let assessmentState: {
    applicationId: string;
    templateId: string;
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    attemptId: string | null;
    token: string | null;
    score: number | null;
  } | null = null;

  if (activeAppId && jobForMatch?.assessmentTemplateId && companyId) {
    const now = new Date();
    const templateId = jobForMatch.assessmentTemplateId;

    const [invite, attempt] = await Promise.all([
      prisma.assessmentInvite.findFirst({
        where: { applicationId: activeAppId, templateId },
        orderBy: { updatedAt: "desc" },
        select: { token: true, status: true, expiresAt: true },
      }),
      prisma.assessmentAttempt.findFirst({
        where: { applicationId: activeAppId, templateId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true, totalScore: true, expiresAt: true },
      }),
    ]);

    const attemptExpired =
      !!attempt?.expiresAt && new Date(attempt.expiresAt) <= now;
    const inviteExpired =
      !!invite?.expiresAt && new Date(invite.expiresAt) <= now;
    const attemptStatus = String(attempt?.status || "").toUpperCase();
    const inviteStatus = String(invite?.status || "").toUpperCase();

    if (
      attempt &&
      (attemptStatus === "SUBMITTED" ||
        attemptStatus === "EVALUATED" ||
        attemptStatus === "COMPLETED")
    ) {
      assessmentState = {
        applicationId: activeAppId,
        templateId,
        state: "COMPLETED",
        attemptId: attempt.id,
        token: invite?.token ?? null,
        score: attempt.totalScore ?? null,
      };
    } else if (attemptExpired || inviteExpired) {
      assessmentState = {
        applicationId: activeAppId,
        templateId,
        state: "EXPIRED",
        attemptId: attempt?.id ?? null,
        token: invite?.token ?? null,
        score: null,
      };
    } else if (attempt && attemptStatus === "IN_PROGRESS") {
      assessmentState = {
        applicationId: activeAppId,
        templateId,
        state: "STARTED",
        attemptId: attempt.id,
        token: invite?.token ?? null,
        score: null,
      };
    } else if (invite) {
      assessmentState = {
        applicationId: activeAppId,
        templateId,
        state: inviteStatus === "STARTED" ? "STARTED" : "SENT",
        attemptId: null,
        token: invite.token,
        score: null,
      };
    } else if (jobForMatch.assessmentTemplateId) {
      assessmentState = {
        applicationId: activeAppId,
        templateId,
        state: "NONE",
        attemptId: null,
        token: null,
        score: null,
      };
    }
  }

  const candidateSkillsForEngine: CandidateSkillInput[] = candidate.candidateSkills.map((cs) => ({
    termId: cs.term.id,
    label: cs.term.label,
    level: cs.level,
  }));

  const jobSeniorityForEngine = toSeniorityLevel(jobForMatch?.seniority);
  const hasJobSkills = (jobForMatch?.requiredSkills?.length ?? 0) > 0;
  const hasMatch = jobForMatch
    ? hasMatchSignals({
        jobSkills: jobForMatch.requiredSkills,
        jobSeniority: jobSeniorityForEngine,
        jobMinYearsExperience: jobForMatch.minYearsExperience,
      })
    : false;

  const matchResult =
    jobForMatch && hasMatch
      ? computeMatchScore({
          jobSkills: jobForMatch.requiredSkills,
          candidateSkills: candidateSkillsForEngine,
          jobSeniority: jobSeniorityForEngine,
          candidateSeniority: toSeniorityLevel(candidate.seniority as string | null),
          jobMinYearsExperience: jobForMatch.minYearsExperience,
          candidateYearsExperience: candidate.yearsExperience,
        })
      : null;

  const matchLocked = plan === "FREE";
  const gatedScore = matchResult && !matchLocked ? matchResult.score : null;

  const myApps = companyId
    ? await prisma.application.findMany({
        where: { candidateId: candidate.id, job: { companyId } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              skills: true,
              company: { select: { name: true } },
            },
          },
        },
        take: 10,
      })
    : [];

  const Pill = ({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) => (
    <span
      className={
        highlight
          ? "mr-1 mb-1 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-100"
          : "mr-1 mb-1 inline-block rounded-full border border-zinc-200 bg-gray-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
      }
    >
      {children}
    </span>
  );

  const List = ({ items, emptyLabel = "—" }: { items?: string[] | null; emptyLabel?: string }) =>
    items && items.length ? (
      <div className="mt-2 flex flex-wrap">{items.map((s) => <Pill key={s}>{s}</Pill>)}</div>
    ) : (
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>
    );

  const waHref = candidate.phone
    ? `https://wa.me/${candidate.phone.replace(/^\+/, "")}?text=${encodeURIComponent(
        `Hola ${candidate.name ?? ""}, te contacto por una oportunidad laboral.`
      )}`
    : null;

  const pdfSrc = candidate.resumeUrl
    ? `${candidate.resumeUrl}${candidate.resumeUrl.includes("#") ? "" : "#toolbar=1&navpanes=0&scrollbar=1"}`
    : null;

  function buildRequiredSnapshot(jobSkills: string[] | null | undefined, candSkills: string[] | null | undefined) {
    const reqNames = new Set(
      (jobSkills || [])
        .filter((s) => s.toLowerCase().startsWith("req:"))
        .map((s) => s.slice(4).trim().toLowerCase())
        .filter(Boolean)
    );
    const cand = candSkills || [];
    const matches: string[] = [];
    const seen = new Set<string>();

    for (const s of cand) {
      const key = s.toLowerCase();
      if (!seen.has(key) && reqNames.has(key)) {
        matches.push(s);
        seen.add(key);
      }
    }

    const others: string[] = [];
    for (const s of cand) {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        others.push(s);
        seen.add(key);
      }
      if (matches.length + others.length >= 4) break;
    }

    return { matches: matches.slice(0, 4), others: others.slice(0, Math.max(0, 4 - matches.length)) };
  }

  const detailedSkills = (candidate.candidateSkills || [])
    .map((s) => ({ id: s.id, label: s.term?.label || "", level: s.level ?? null, termId: s.term?.id || "" }))
    .filter((s) => s.label);

  const candidateSkillNames = detailedSkills.map((s) => s.label);

  const languageItems = (candidate.candidateLanguages || [])
    .map((cl) => {
      const label = cl.term?.label || "";
      const levelKey = cl.level || "";
      if (!label && !levelKey) return null;
      const levelLabel = LEVEL_LABEL[levelKey] ?? (levelKey ? levelKey : "");
      return levelLabel ? `${label} · ${levelLabel}` : label;
    })
    .filter(Boolean) as string[];

  const matchedDetails = matchResult?.details.filter((d) => d.matched) ?? [];
  const missingRequired = matchResult?.details.filter((d) => !d.matched && d.must) ?? [];
  const missingNice = matchResult?.details.filter((d) => !d.matched && !d.must) ?? [];

  const fitBadge = (fit: string | undefined, type: "seniority" | "experience") => {
    if (!fit || fit === "unknown") return null;
    const isGood = type === "seniority" ? fit === "exact" : fit === "meets";
    const isOk = fit === "close";
    const label =
      type === "seniority"
        ? { exact: "Seniority: exacto", close: "Seniority: cercano", below: "Seniority: bajo" }[fit] ?? fit
        : { meets: "Experiencia: cumple", close: "Experiencia: cercana", below: "Experiencia: insuficiente" }[fit] ?? fit;

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
          isGood
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-200"
            : isOk
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300"
        }`}
      >
        {label}
      </span>
    );
  };

  // Button styles
  const btnBase = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition min-h-[40px]";
  const btnDefault = `${btnBase} border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`;
  const btnGreen = `${btnBase} border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300`;
  const btnWhatsApp = `${btnBase} border-transparent bg-emerald-600 text-white hover:bg-emerald-500`;

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:space-y-8 lg:px-8 lg:py-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-sm font-semibold text-white shadow-sm">
            {candidate.name?.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "C"}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
              {candidate.name || "Candidato"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{candidate.email}</span>
              {candidate.location && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{candidate.location}</span>
              )}
              {candidate.phone && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{candidate.phone}</span>
              )}
              {candidate.seniority && (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700 dark:border-violet-600/40 dark:bg-violet-900/20 dark:text-violet-300">
                  {SENIORITY_LABEL[candidate.seniority as string] ?? candidate.seniority}
                </span>
              )}
              {candidate.yearsExperience != null && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {candidate.yearsExperience} año{candidate.yearsExperience !== 1 ? "s" : ""} exp.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {fromJobId && (
            <>
              <Link href={`/dashboard/jobs/${fromJobId}/applications`} className={btnDefault}>
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Volver a la vacante</span>
              </Link>
              <Link href={`/dashboard/jobs/${fromJobId}`} className={btnDefault}>
                <GitBranch className="h-4 w-4 shrink-0" />
                <span>Ver pipeline</span>
              </Link>
            </>
          )}

          {candidate.resumeUrl ? (
            <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className={btnGreen}>
              <Download className="h-4 w-4 shrink-0" />
              <span>Descargar CV</span>
            </a>
          ) : (
            <span className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-400 dark:border-zinc-700">
              Sin CV
            </span>
          )}

          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer" className={btnWhatsApp}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current">
                <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.62 2 2.22 6.4 2.22 11.81c0 1.73.45 3.42 1.31 4.92L2 22l5.42-1.5a9.78 9.78 0 0 0 4.61 1.17h.01c5.41 0 9.81-4.4 9.81-9.81 0-2.62-1.02-5.08-2.8-6.95Zm-7.02 15.1h-.01a8.1 8.1 0 0 1-4.12-1.13l-.29-.17-3.21.89.86-3.13-.19-.32a8.13 8.13 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.15-8.14 2.17 0 4.21.84 5.75 2.38a8.08 8.08 0 0 1 2.39 5.76c0 4.49-3.65 8.14-8.08 8.14Zm4.46-6.07c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.37-1.94-1.18-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.02-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.56 4.06 3.59.57.25 1.01.4 1.36.52.57.18 1.09.16 1.5.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
              </svg>
              <span>WhatsApp</span>
            </a>
          )}

          {/* FIX Bug #3b: botón de enviar assessment si hay template + applicationId */}
          {assessmentState && activeAppId && (
            <SendAssessmentButton
              applicationId={activeAppId}
              assessment={assessmentState}
            />
          )}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">

        {/* ── Left: main content ── */}
        <section className="space-y-5 lg:col-span-2">

          {/* AI Match */}
          {jobForMatch && (
            <div className="glass-card rounded-2xl border p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  AI Match —{" "}
                  <Link href={`/dashboard/jobs/${jobForMatch.id}/applications`} className="text-emerald-600 hover:underline dark:text-emerald-400">
                    {jobForMatch.title}
                  </Link>
                  {jobForMatch.seniority && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {SENIORITY_LABEL[jobForMatch.seniority] ?? jobForMatch.seniority}
                    </span>
                  )}
                  {jobForMatch.minYearsExperience != null && (
                    <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {jobForMatch.minYearsExperience}+ años
                    </span>
                  )}
                </h2>
                {matchLocked && (
                  <Link href="/dashboard/billing" className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
                    Mejorar plan →
                  </Link>
                )}
              </div>

              {matchLocked ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">AI Match bloqueado en plan Gratis</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Actualiza a Starter o Pro para ver el score detallado.
                    </p>
                  </div>
                </div>
              ) : !hasMatch ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Esta vacante aún no tiene señales suficientes para calcular AI Match.
                </p>
              ) : !matchResult ? null : (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                      <span className={`text-4xl font-black ${scoreToTextColor(gatedScore!)}`}>{gatedScore}%</span>
                      <span className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{scoreToLabel(gatedScore!)}</span>
                    </div>

                    <div className="flex-1 space-y-2">
                      {[
                        { label: "Score general", value: gatedScore!, total: null },
                        ...(matchResult.totalRequired > 0 ? [{ label: `Skills requeridas (${matchResult.totalRequired})`, value: matchResult.mustScore, total: null }] : []),
                        ...(matchResult.totalNice > 0 ? [{ label: `Skills deseables (${matchResult.totalNice})`, value: matchResult.niceScore, total: null }] : []),
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{label}</span>
                            <span>{value}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/50">
                            <div className={`h-1.5 rounded-full transition-all ${scoreToColor(value)}`} style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {hasJobSkills
                          ? `${matchResult.matchedCount} de ${jobForMatch.requiredSkills.length} skills coinciden`
                          : "Score calculado con señales de seniority y/o experiencia"}
                      </p>
                    </div>
                  </div>

                  {(matchResult.seniorityFit !== "unknown" || matchResult.experienceFit !== "unknown") && (
                    <div className="flex flex-wrap gap-2">
                      {fitBadge(matchResult.seniorityFit, "seniority")}
                      {fitBadge(matchResult.experienceFit, "experience")}
                    </div>
                  )}

                  {hasJobSkills && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          ✅ Tiene ({matchedDetails.length})
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {matchedDetails.length === 0 ? (
                            <p className="text-xs text-zinc-400">Ninguna skill coincide</p>
                          ) : matchedDetails.map((d) => (
                            <span key={d.termId} title={d.must ? "Requerida" : "Deseable"}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                d.must
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-200"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
                              }`}>
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              {d.label}
                              {d.candidateLevel && <span className="opacity-60">L{d.candidateLevel}</span>}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          ❌ Le falta ({missingRequired.length + missingNice.length})
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {missingRequired.length === 0 && missingNice.length === 0 ? (
                            <p className="text-xs text-zinc-400">Cubre todas las skills</p>
                          ) : (
                            <>
                              {missingRequired.map((d) => (
                                <span key={d.termId} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
                                  <XCircle className="h-3 w-3 shrink-0" />
                                  {d.label}
                                  <span className="text-[9px] font-semibold uppercase opacity-70">Req</span>
                                </span>
                              ))}
                              {missingNice.map((d) => (
                                <span key={d.termId} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                                  <XCircle className="h-3 w-3 shrink-0 opacity-50" />
                                  {d.label}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Summary */}
          <CandidateSummaryCard candidateId={candidate.id} jobId={jobForMatch?.id ?? null} />

          {/* Info */}
          <div className="glass-card rounded-2xl border p-4 md:p-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Información</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Nombre", value: candidate.name },
                { label: "Email", value: candidate.email },
                { label: "Teléfono", value: candidate.phone },
                { label: "Ubicación", value: candidate.location },
                { label: "Fecha de nacimiento", value: candidate.birthdate ? new Date(candidate.birthdate).toLocaleDateString() : null },
                { label: "Seniority", value: candidate.seniority ? (SENIORITY_LABEL[candidate.seniority as string] ?? candidate.seniority) : null },
                { label: "Años de experiencia", value: candidate.yearsExperience != null ? `${candidate.yearsExperience} años` : null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">{value ?? "—"}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">LinkedIn</dt>
                <dd className="mt-0.5">
                  {candidate.linkedin ? (
                    <a className="text-blue-600 hover:underline dark:text-blue-400 break-all" href={candidate.linkedin} target="_blank" rel="noreferrer">{candidate.linkedin}</a>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">GitHub</dt>
                <dd className="mt-0.5">
                  {candidate.github ? (
                    <a className="text-blue-600 hover:underline dark:text-blue-400 break-all" href={candidate.github} target="_blank" rel="noreferrer">{candidate.github}</a>
                  ) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Skills + Certs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass-card rounded-2xl border p-4 md:p-5">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Skills</h2>
              {detailedSkills.length > 0 ? (
                <ul className="space-y-3">
                  {detailedSkills.map((s) => {
                    const levelValue = s.level ?? 0;
                    const pct = Math.max(0, Math.min(100, Math.round(levelValue * 20)));
                    const levelLabel = s.level != null ? SKILL_LEVEL_LABEL[s.level as number] ?? `Nivel ${s.level}` : "Sin nivel";
                    const isJobRequired = matchResult?.details.find((d) => d.termId === s.termId && d.must && d.matched);
                    const isJobNice = matchResult?.details.find((d) => d.termId === s.termId && !d.must && d.matched);

                    return (
                      <li key={s.id} className={`soft-panel px-3 py-2 ${isJobRequired ? "ring-1 ring-emerald-400/50 dark:ring-emerald-500/30" : ""}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{s.label}</span>
                            {isJobRequired && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Req</span>
                            )}
                            {isJobNice && !isJobRequired && (
                              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Nice</span>
                            )}
                          </div>
                          <span className="text-xs text-muted">{levelLabel}</span>
                        </div>
                        <div className="mt-2 progress" role="progressbar" aria-label={`Nivel ${levelValue} de 5 en ${s.label}`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={levelValue}>
                          <div className="progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin skills capturados</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl border p-4 md:p-5">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Certificaciones</h2>
                <List items={candidate.certifications} emptyLabel="Sin certificaciones capturadas" />
              </div>
              <div className="glass-card rounded-2xl border p-4 md:p-5">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Idiomas</h2>
                <List items={languageItems} emptyLabel="Sin idiomas capturados" />
              </div>
            </div>
          </div>

          {/* CV Preview */}
          {candidate.resumeUrl && (
            <div className="glass-card rounded-2xl border p-4 md:p-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">CV</h2>
              <div className="overflow-hidden rounded-lg border bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative w-full" style={{ height: "70vh" }}>
                  <iframe src={pdfSrc!} title="Vista previa del CV" className="absolute inset-0 h-full w-full" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className={btnDefault}>Abrir en nueva pestaña</a>
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" download className={btnDefault}>Descargar</a>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Si el visor no carga, usa &quot;Abrir en nueva pestaña&quot;.
              </p>
            </div>
          )}
        </section>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          <div className="glass-card rounded-2xl border p-4 md:p-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Postulaciones recientes (mi empresa)
            </h3>
            {myApps.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">—</p>
            ) : (
              <ul className="space-y-3">
                {myApps.map((a) => {
                  const { matches, others } = buildRequiredSnapshot(a.job?.skills, candidateSkillNames);
                  const show = [...matches, ...others].slice(0, 4);
                  const isActive = a.job?.id === fromJobId;

                  return (
                    <li
                      key={a.id}
                      className={`rounded-xl border p-3 text-sm ${
                        isActive
                          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-600/40 dark:bg-emerald-950/30"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-950/70"
                      }`}
                    >
                      <div className="font-medium text-zinc-900 dark:text-zinc-50 leading-snug">
                        {a.job?.title} — {a.job?.company?.name ?? "—"}
                        {isActive && (
                          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Activa
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        Estado: {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                      </div>

                      {show.length > 0 && (
                        <div className="mt-2 flex flex-wrap">
                          {show.map((s) => <Pill key={s} highlight={matches.includes(s)}>{s}</Pill>)}
                        </div>
                      )}

                      {/* FIX Bug #5: botones con estilo correcto (sin Mensajes) */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Ver vacante → lleva al pipeline */}
                        <Link
                          href={`/dashboard/jobs/${a.job?.id}/applications`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver vacante
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {!fromJobId && (
            <Link href="/dashboard/jobs" className="block text-sm text-blue-600 hover:underline dark:text-blue-400">
              ← Volver a vacantes
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}