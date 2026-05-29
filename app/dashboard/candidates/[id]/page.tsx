// app/dashboard/candidates/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import Link from "next/link";
import {
  buildCandidateSkillInputs,
  buildJobSkillInputs,
  computeMatchScore,
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  hasMatchSignals,
  type BillingPlan,
  type JobSkillInput,
  type SeniorityLevel,
} from "@/lib/ai/matchScore";
import { Lock, CheckCircle2, XCircle } from "lucide-react";
import CandidateSummaryCard from "@/components/dashboard/CandidateSummaryCard";
import SendAssessmentButton from "@/components/dashboard/SendAssessmentButton";
import CandidateReviewShell from "@/components/dashboard/CandidateReviewShell";
import type { AppState as CandidateAppState } from "@/components/dashboard/CandidateReviewShell";

export const metadata = { title: "Candidato | Panel" };

const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};


const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
};

const EDUCATION_LEVEL_LABEL: Record<string, string> = {
  NONE: "Sin estudios",
  PRIMARY: "Primaria",
  SECONDARY: "Secundaria",
  HIGH_SCHOOL: "Preparatoria",
  TECHNICAL: "Técnico",
  BACHELOR: "Licenciatura",
  MASTER: "Maestría",
  DOCTORATE: "Doctorado",
  OTHER: "Otro",
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
    select: {
      id: true,
      role: true,
      name: true,
      recruiterProfile: {
        select: {
          companyId: true,
        },
      },
    },
  });

  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) redirect("/");

  const companyId = me.recruiterProfile?.companyId ?? null;

  const company = companyId
    ? await prisma.company.findUnique({
        where: { id: companyId },
        select: { billingPlan: true, name: true },
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
      desiredSalaryMin: true,
      desiredCurrency: true,
      candidateSkills: {
        select: {
          id: true,
          level: true,
          term: { select: { id: true, label: true, aliases: true } },
        },
        orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
      },
      candidateLanguages: {
        select: {
          level: true,
          term: { select: { label: true } },
        },
      },
      experiences: {
        select: {
          id: true,
          role: true,
          company: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          description: true,
        },
        orderBy: [{ startDate: "desc" }],
      },
      education: {
        select: {
          id: true,
          level: true,
          status: true,
          institution: true,
          program: true,
          startDate: true,
          endDate: true,
          sortIndex: true,
        },
        orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }],
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
    assessmentTemplates: { templateId: string; title: string }[];
  } | null = null;

  if (fromJobId && companyId) {
    const jobRaw = await prisma.job.findFirst({
      where: { id: fromJobId, companyId },
      select: {
        id: true,
        title: true,
        seniority: true,
        minYearsExperience: true,
        skills: true,
        requiredSkills: {
          select: {
            must: true,
            weight: true,
            term: { select: { id: true, label: true, aliases: true } },
          },
        },
        assessments: {
          orderBy: { createdAt: "asc" },
          select: {
            templateId: true,
            template: { select: { title: true } },
          },
        },
      },
    });

    if (jobRaw) {
      jobForMatch = {
        id: jobRaw.id,
        title: jobRaw.title,
        seniority: jobRaw.seniority ?? null,
        minYearsExperience: jobRaw.minYearsExperience ?? null,
        requiredSkills: buildJobSkillInputs(jobRaw.requiredSkills, jobRaw.skills),
        assessmentTemplates: jobRaw.assessments.map((a) => ({
          templateId: a.templateId,
          title: a.template?.title ?? a.templateId,
        })),
      };
    }
  }

  // Estado por cada assessment template asignado a la vacante
  type AssessmentStateEntry = {
    applicationId: string;
    templateId: string;
    templateTitle: string;
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    attemptId: string | null;
    token: string | null;
    score: number | null;
  };

  const assessmentStates: AssessmentStateEntry[] = [];

  if (activeAppId && jobForMatch && jobForMatch.assessmentTemplates.length > 0) {
    const now = new Date();

    await Promise.all(
      jobForMatch.assessmentTemplates.map(async ({ templateId, title: templateTitle }) => {
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

        const attemptExpired = !!attempt?.expiresAt && new Date(attempt.expiresAt) <= now;
        const inviteExpired  = !!invite?.expiresAt  && new Date(invite.expiresAt)  <= now;
        const attemptStatus  = String(attempt?.status || "").toUpperCase();
        const inviteStatus   = String(invite?.status  || "").toUpperCase();

        let state: AssessmentStateEntry["state"] = "NONE";
        let attemptId: string | null = null;
        let token: string | null = null;
        let score: number | null = null;

        if (attempt && (attemptStatus === "SUBMITTED" || attemptStatus === "EVALUATED" || attemptStatus === "COMPLETED")) {
          state = "COMPLETED";
          attemptId = attempt.id;
          token = invite?.token ?? null;
          score = attempt.totalScore ?? null;
        } else if (attemptExpired || inviteExpired) {
          state = "EXPIRED";
          attemptId = attempt?.id ?? null;
          token = invite?.token ?? null;
        } else if (attempt && attemptStatus === "IN_PROGRESS") {
          state = "STARTED";
          attemptId = attempt.id;
          token = invite?.token ?? null;
        } else if (invite) {
          state = inviteStatus === "STARTED" ? "STARTED" : "SENT";
          token = invite.token;
        }

        assessmentStates.push({ applicationId: activeAppId, templateId, templateTitle, state, attemptId, token, score });
      })
    );

    // Mantener el orden original de la vacante
    assessmentStates.sort((a, b) => {
      const order = jobForMatch!.assessmentTemplates.map((t) => t.templateId);
      return order.indexOf(a.templateId) - order.indexOf(b.templateId);
    });
  }

  const candidateSkillsForEngine = buildCandidateSkillInputs(candidate.candidateSkills);

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

  // Navegación prev/next entre candidatos de la misma vacante
  type NavEntry = {
    candidateId: string;
    applicationId: string;
    name: string;
    seniority: string | null;
    location: string | null;
    status: string;
    recruiterInterest: string;
    starred: boolean;
  };
  let navList: NavEntry[] = [];
  let navIndex = -1;

  if (fromJobId && companyId) {
    const jobApps = await prisma.application.findMany({
      where: { jobId: fromJobId, job: { companyId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        recruiterInterest: true,
        starred: true,
        candidate: { select: { id: true, name: true, seniority: true, location: true } },
      },
    });
    navList = jobApps.map((a) => ({
      candidateId: a.candidate.id,
      applicationId: a.id,
      name: a.candidate.name ?? "Candidato",
      seniority: a.candidate.seniority ?? null,
      location: a.candidate.location ?? null,
      status: a.status,
      recruiterInterest: a.recruiterInterest,
      starred: a.starred,
    }));
    navIndex = navList.findIndex((n) => n.applicationId === activeAppId);
  }

  // Current application state (for right sidebar)
  const currentApplication = activeAppId
    ? await prisma.application.findFirst({
        where: { id: activeAppId, job: { companyId: companyId ?? "" } },
        select: {
          id: true,
          status: true,
          recruiterInterest: true,
          internalNotes: true,
          starred: true,
          createdAt: true,
          submittedAt: true,
          reviewingAt: true,
          interviewAt: true,
          offerAt: true,
          hiredAt: true,
          rejectedAt: true,
          lastViewedAt: true,
          viewCount: true,
        },
      })
    : null;

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

  const candidateFirstName =
    candidate.name?.trim().split(/\s+/)[0] || "hola";

  const recruiterName =
    me.name?.trim().split(/\s+/)[0] || "Reclutamiento";

  const companyName =
    company?.name?.trim() || "la empresa";

  const jobTitle = jobForMatch?.title || "la vacante";

  // Normalización consistente con ActionsMenu: asegurar formato 52XXXXXXXXXX
  const rawPhone = candidate.phone || "";
  let whatsappPhone = rawPhone.replace(/\D/g, "");
  if (whatsappPhone.length === 10) whatsappPhone = `52${whatsappPhone}`;
  if (whatsappPhone.length === 13 && whatsappPhone.startsWith("521")) whatsappPhone = `52${whatsappPhone.slice(3)}`;

  const whatsappMessage =
    `Hola ${candidateFirstName}, soy ${recruiterName} de ${companyName}. ` +
    `Te contacto porque aplicaste a la vacante de ${jobTitle}. ` +
    `¿Tienes disponibilidad para platicar?`;

  const waHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  const pdfSrc = candidate.resumeUrl
    ? `${candidate.resumeUrl}${candidate.resumeUrl.includes("#") ? "" : "#toolbar=1&navpanes=0&scrollbar=1"}`
    : null;

  const detailedSkills = (candidate.candidateSkills || [])
    .map((s) => ({ id: s.id, label: s.term?.label || "", level: s.level ?? null, termId: s.term?.id || "" }))
    .filter((s) => s.label);

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

  const btnLink = "inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  // Serialize application for client component (no Date objects)
  const appStateForShell: CandidateAppState | null = currentApplication
    ? {
        id: currentApplication.id,
        status: currentApplication.status,
        recruiterInterest: currentApplication.recruiterInterest,
        internalNotes: currentApplication.internalNotes ?? null,
        starred: currentApplication.starred,
        createdAt: currentApplication.createdAt.toISOString(),
        submittedAt: currentApplication.submittedAt.toISOString(),
        reviewingAt: currentApplication.reviewingAt?.toISOString() ?? null,
        interviewAt: currentApplication.interviewAt?.toISOString() ?? null,
        offerAt: currentApplication.offerAt?.toISOString() ?? null,
        hiredAt: currentApplication.hiredAt?.toISOString() ?? null,
        rejectedAt: currentApplication.rejectedAt?.toISOString() ?? null,
        lastViewedAt: currentApplication.lastViewedAt?.toISOString() ?? null,
        viewCount: currentApplication.viewCount,
      }
    : null;

  // ── Slot content ────────────────────────────────────────────────────────────

  const summarySlot = (
    <div className="space-y-5">
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
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Actualiza a Starter o Pro para ver el score detallado.</p>
              </div>
            </div>
          ) : !hasMatch ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Esta vacante aún no tiene señales suficientes para calcular AI Match.</p>
          ) : !matchResult ? null : (
            <div className="mt-4 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <span className={`text-4xl font-black ${scoreToTextColor(gatedScore!)}`}>{gatedScore}%</span>
                  <span className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{scoreToLabel(gatedScore!)}</span>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { label: "Score general", value: gatedScore! },
                    ...(matchResult.totalRequired > 0 ? [{ label: `Skills requeridas (${matchResult.totalRequired})`, value: matchResult.mustScore }] : []),
                    ...(matchResult.totalNice > 0 ? [{ label: `Skills deseables (${matchResult.totalNice})`, value: matchResult.niceScore }] : []),
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{label}</span><span>{value}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/50">
                        <div className={`h-1.5 rounded-full transition-all ${scoreToColor(value)}`} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {hasJobSkills ? `${matchResult.matchedCount} de ${jobForMatch.requiredSkills.length} skills coinciden` : "Score calculado con señales de seniority y/o experiencia"}
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
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tiene ({matchedDetails.length})</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedDetails.length === 0 ? <p className="text-xs text-zinc-400">Ninguna skill coincide</p> : matchedDetails.map((d) => (
                        <span key={d.termId} title={d.must ? "Requerida" : "Deseable"} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${d.must ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-200" : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"}`}>
                          <CheckCircle2 className="h-3 w-3 shrink-0" />{d.label}{d.candidateLevel && <span className="opacity-60">L{d.candidateLevel}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Le falta ({missingRequired.length + missingNice.length})</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {missingRequired.length === 0 && missingNice.length === 0 ? <p className="text-xs text-zinc-400">Cubre todas las skills</p> : (
                        <>
                          {missingRequired.map((d) => (
                            <span key={d.termId} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
                              <XCircle className="h-3 w-3 shrink-0" />{d.label}<span className="text-[9px] font-semibold uppercase opacity-70">Req</span>
                            </span>
                          ))}
                          {missingNice.map((d) => (
                            <span key={d.termId} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                              <XCircle className="h-3 w-3 shrink-0 opacity-50" />{d.label}
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
      <CandidateSummaryCard candidateId={candidate.id} jobId={jobForMatch?.id ?? null} />
    </div>
  );

  const profileSlot = (
    <div className="space-y-5">
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
            { label: "Salario deseado", value: (candidate as any).desiredSalaryMin != null ? `${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format((candidate as any).desiredSalaryMin)} / mes MXN` : null },
          ].map(({ label, value }) => (
            <div key={label}><dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt><dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">{value ?? "—"}</dd></div>
          ))}
          <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">LinkedIn</dt><dd className="mt-0.5">{candidate.linkedin ? <a className="text-blue-600 hover:underline dark:text-blue-400 break-all" href={candidate.linkedin} target="_blank" rel="noreferrer">{candidate.linkedin}</a> : "—"}</dd></div>
          <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">GitHub</dt><dd className="mt-0.5">{candidate.github ? <a className="text-blue-600 hover:underline dark:text-blue-400 break-all" href={candidate.github} target="_blank" rel="noreferrer">{candidate.github}</a> : "—"}</dd></div>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card rounded-2xl border p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Skills</h2>
          {detailedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detailedSkills.map((s) => {
                const isJobRequired = matchResult?.details.find((d) => d.termId === s.termId && d.must && d.matched);
                const isJobNice = matchResult?.details.find((d) => d.termId === s.termId && !d.must && d.matched);
                const hasLevel = s.level != null;
                const chipClass = isJobRequired ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-200" : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300";
                const levelBadgeClass: Record<number, string> = { 1: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300", 2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", 3: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", 4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", 5: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" };
                const lvlClass = hasLevel ? (levelBadgeClass[s.level as number] ?? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300") : "";
                return (
                  <span key={s.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${chipClass}`}>
                    {s.label}
                    {isJobRequired && <span className="rounded-full bg-emerald-200 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-200">REQ</span>}
                    {isJobNice && !isJobRequired && <span className="rounded-full bg-sky-100 px-1 py-0.5 text-[9px] font-bold uppercase text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Nice</span>}
                    {hasLevel && <span className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${lvlClass}`}>L{s.level}</span>}
                  </span>
                );
              })}
            </div>
          ) : <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin skills capturados</p>}
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

      {(candidate as any).experiences?.length > 0 && (
        <div className="glass-card rounded-2xl border p-4 md:p-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Experiencia laboral</h2>
          <ul className="space-y-4">
            {(candidate as any).experiences.map((exp: any) => {
              const start = exp.startDate ? new Date(exp.startDate).toLocaleDateString("es-MX", { year: "numeric", month: "short" }) : null;
              const end = exp.isCurrent ? "Actual" : exp.endDate ? new Date(exp.endDate).toLocaleDateString("es-MX", { year: "numeric", month: "short" }) : null;
              return (
                <li key={exp.id} className="soft-panel px-4 py-3">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{exp.role}</p><p className="text-sm text-zinc-600 dark:text-zinc-300">{exp.company}</p></div>
                    {(start || end) && <p className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">{[start, end].filter(Boolean).join(" – ")}</p>}
                  </div>
                  {exp.description && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3">{exp.description}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(candidate as any).education?.length > 0 && (
        <div className="glass-card rounded-2xl border p-4 md:p-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Educación</h2>
          <ul className="space-y-3">
            {(candidate as any).education.map((ed: any) => {
              const start = ed.startDate ? new Date(ed.startDate).toLocaleDateString("es-MX", { year: "numeric", month: "short" }) : null;
              const end = ed.status === "ONGOING" ? "En curso" : ed.endDate ? new Date(ed.endDate).toLocaleDateString("es-MX", { year: "numeric" }) : null;
              return (
                <li key={ed.id} className="soft-panel px-4 py-3">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{ed.program || EDUCATION_LEVEL_LABEL[ed.level] || "—"}</p><p className="text-sm text-zinc-600 dark:text-zinc-300">{ed.institution}</p></div>
                    <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                      {(start || end) && <p className="text-xs text-zinc-400 dark:text-zinc-500">{[start, end].filter(Boolean).join(" – ")}</p>}
                      {ed.level && <span className="inline-block rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">{EDUCATION_LEVEL_LABEL[ed.level] ?? ed.level}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

  const cvSlot = pdfSrc ? (
    <div className="glass-card rounded-2xl border p-4 md:p-6">
      <div className="overflow-hidden rounded-lg border bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative w-full" style={{ height: "75vh" }}>
          <iframe src={pdfSrc} title="Vista previa del CV" className="absolute inset-0 h-full w-full" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={candidate.resumeUrl!} target="_blank" rel="noreferrer" className={btnLink}>Abrir en nueva pestaña</a>
        <a href={candidate.resumeUrl!} target="_blank" rel="noreferrer" download className={btnLink}>Descargar</a>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Si el visor no carga, usa &quot;Abrir en nueva pestaña&quot;.</p>
    </div>
  ) : null;

  const assessmentsSlot = assessmentStates.length > 0 && activeAppId ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Evaluaciones técnicas</h2>
        <SendAssessmentButton applicationId={activeAppId} assessments={assessmentStates} />
      </div>
      {assessmentStates.map((a) => (
        <div key={a.templateId} className="glass-card rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{a.templateTitle}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {a.state === "NONE"      && "Sin enviar"}
                {a.state === "SENT"      && "Enviada — pendiente"}
                {a.state === "STARTED"   && "En progreso"}
                {a.state === "EXPIRED"   && "Expirada"}
                {a.state === "COMPLETED" && `Completada${a.score != null ? ` — ${a.score}%` : ""}`}
              </p>
            </div>
            {a.state === "COMPLETED" && a.attemptId && (
              <Link
                href={`/dashboard/assessments/attempts/${a.attemptId}/results`}
                className={btnLink + " text-xs"}
              >
                Ver resultados →
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay evaluaciones asignadas a esta vacante.</p>
    </div>
  );

  return (
    <CandidateReviewShell
      candidateId={candidate.id}
      candidateName={candidate.name}
      candidateSeniority={candidate.seniority ?? null}
      candidateLocation={candidate.location ?? null}
      resumeUrl={candidate.resumeUrl ?? null}
      waHref={waHref}
      fromJobId={fromJobId ?? null}
      jobTitle={jobTitle}
      matchScore={gatedScore}
      matchLocked={matchLocked}
      applicationId={activeAppId}
      currentApplication={appStateForShell}
      navList={navList}
      navIndex={navIndex}
      slots={{
        summary: summarySlot,
        profile: profileSlot,
        cv: cvSlot,
        assessments: assessmentsSlot,
      }}
    />
  );
}
