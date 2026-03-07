// app/dashboard/jobs/[id]/applications/page.tsx

import Link from "next/link";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { notFound } from "next/navigation";
import { fromNow } from "@/lib/dates";
import InterestSelect from "./InterestSelect";
import ActionsMenu from "./ActionsMenu";
import { Phone, FileText as FileTextIcon, Search, Lock } from "lucide-react";
import JobActionsMenu from "@/components/dashboard/JobActionsMenu";
import {
  computeMatchScore,
  applyPlanGate,
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  type BillingPlan,
  type JobSkillInput,
  type CandidateSkillInput,
} from "@/lib/ai/matchScore";

/** Niveles de idioma */
const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional",
  CONVERSATIONAL: "Conversacional",
  BASIC: "Básico",
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

const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: "Gratis",
  STARTER: "Starter",
  PRO: "Pro",
};

type SortKey = "match" | "recent" | "name";

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    interest?: InterestKey | "ALL";
    q?: string;
    sort?: SortKey | string;
  };
}) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-10">
          <div className="glass-card rounded-2xl border border-dashed p-4 md:p-6 text-center">
            <p className="mb-1 text-base font-medium text-zinc-800">
              No hay empresa asociada a tu sesión.
            </p>
            <p className="text-sm text-zinc-600">
              Pide al administrador que asigne tu usuario a una empresa.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ✅ NUEVO: plan de la empresa para gate de AI Match
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
      company: { select: { name: true } },
      skills: true,
      requiredSkills: {
        select: {
          must: true,
          weight: true,                               // ✅ NUEVO
          term: { select: { id: true, label: true } }, // ✅ id para engine
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

  // ✅ NUEVO: skills de la vacante para el engine
  const jobSkillsForEngine: JobSkillInput[] = job.requiredSkills.map((rs) => ({
    termId: rs.term.id,
    label: rs.term.label,
    must: rs.must,
    weight: rs.weight,
  }));
  const hasJobSkills = jobSkillsForEngine.length > 0;

  // Traer todas las apps — ahora con termId + level en candidateSkills
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
          candidateSkills: {
            select: {
              level: true,                              // ✅ NUEVO
              term: { select: { id: true, label: true } }, // ✅ id para engine
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

  // ── Assessment meta (sin cambios) ─────────────────────────────────────────
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
      if (inv.applicationId && !inviteMap.has(inv.applicationId))
        inviteMap.set(inv.applicationId, inv);
    }

    for (const appId of applicationIds) {
      const at = attemptMap.get(appId);
      const iv = inviteMap.get(appId);
      const attemptExpired = !!at?.expiresAt && new Date(at.expiresAt) <= now;
      const inviteExpired  = !!iv?.expiresAt && new Date(iv.expiresAt) <= now;

      if (at && (at.status === "SUBMITTED" || at.status === "EVALUATED" || at.status === "COMPLETED")) {
        assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: "COMPLETED", token: iv?.token ?? null, attemptId: at.id, score: at.totalScore ?? null });
        continue;
      }
      if (attemptExpired || inviteExpired) {
        assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: "EXPIRED", token: iv?.token ?? null, attemptId: at?.id ?? null, score: null });
        continue;
      }
      if (at && at.status === "IN_PROGRESS") {
        assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: "STARTED", token: iv?.token ?? null, attemptId: at.id, score: null });
        continue;
      }
      if (iv) {
        const invStatus = String(iv.status || "").toUpperCase();
        if (invStatus === "CANCELLED" || invStatus === "REVOKED") {
          assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: "EXPIRED", token: iv.token ?? null, attemptId: at?.id ?? null, score: null });
          continue;
        }
        if (isFinalInvite(iv.status)) {
          assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: "COMPLETED", token: iv.token ?? null, attemptId: at?.id ?? null, score: at?.totalScore ?? null });
          continue;
        }
        assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: invStatus === "STARTED" ? "STARTED" : "SENT", token: iv.token ?? null, attemptId: null, score: null });
        continue;
      }
      assessmentByAppId.set(appId, { enabled: true, templateId: chosenTemplateId, state: "NONE", token: null, attemptId: null, score: null });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const counters: Record<InterestKey, number> = { REVIEW: 0, MAYBE: 0, ACCEPTED: 0, REJECTED: 0 };
  for (const a of allApps) counters[getAppInterest(a)]++;
  const total = allApps.length;

  const interestParam = searchParams?.interest as string | undefined;
  const chosenInterest: InterestKey | undefined = !interestParam
    ? ("REVIEW" as InterestKey)
    : interestParam === "ALL"
    ? undefined
    : (interestParam as InterestKey);

  const qParam = (searchParams?.q ?? "").toString();
  const q = qParam.trim().toLowerCase();
  const sortParamRaw = (searchParams?.sort as string | undefined) ?? "match";
  const sortKey: SortKey = sortParamRaw === "recent" || sortParamRaw === "name" ? sortParamRaw : "match";

  // ✅ NUEVO: enriquecer con engine de match por termId
  let enriched = allApps.map((a) => {
    const candidateSkillsForEngine: CandidateSkillInput[] = (a.candidate?.candidateSkills ?? []).map((cs: any) => ({
      termId: cs.term.id,
      label: cs.term.label,
      level: cs.level,
    }));

    const matchResult = hasJobSkills
      ? computeMatchScore(jobSkillsForEngine, candidateSkillsForEngine)
      : null;

    const fullName =
      a.candidate?.name ||
      [(a.candidate as any)?.firstName, (a.candidate as any)?.lastName].filter(Boolean).join(" ") ||
      "—";

    return {
      ...a,
      _matchResult: matchResult,
      _score: matchResult?.score ?? 0,
      _fullName: fullName,
      _lastActivity: a.createdAt,
    };
  });

  if (chosenInterest) enriched = enriched.filter((a) => getAppInterest(a) === chosenInterest);

  if (q) {
    enriched = enriched.filter((a) => {
      const skills = (a.candidate?.candidateSkills ?? []).map((cs: any) => cs.term.label).join(" ");
      const haystack = [a._fullName, a.candidate?.email ?? "", a.candidate?.location ?? "", skills].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  const apps = [...enriched].sort((a, b) => {
    if (sortKey === "recent") return new Date(b._lastActivity).getTime() - new Date(a._lastActivity).getTime();
    if (sortKey === "name")   return (a._fullName || "").localeCompare(b._fullName || "", "es", { sensitivity: "base" });
    return (b._score ?? 0) - (a._score ?? 0);
  });

  // ✅ NUEVO: gate de plan (rank = posición 0-based en lista ordenada por score desc)
  const appsWithGate = apps.map((a, idx) => {
    const gatedScore = applyPlanGate(a._score, idx, plan);
    return { ...a, _gatedScore: gatedScore, _locked: gatedScore === null };
  });

  const lockedCount = appsWithGate.filter((a) => a._locked).length;

  const buildInterestHref = (i?: InterestKey | "ALL") => {
    const usp = new URLSearchParams();
    if (i) usp.set("interest", i);
    if (qParam) usp.set("q", qParam);
    if (sortKey) usp.set("sort", sortKey);
    return `/dashboard/jobs/${job.id}/applications${usp.toString() ? `?${usp.toString()}` : ""}`;
  };

  const buildSortHref = (sort: SortKey) => {
    const usp = new URLSearchParams();
    if (interestParam) usp.set("interest", interestParam);
    if (qParam) usp.set("q", qParam);
    usp.set("sort", sort);
    return `/dashboard/jobs/${job.id}/applications${usp.toString() ? `?${usp.toString()}` : ""}`;
  };

  const headerBtnClasses =
    "inline-flex items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white/80 px-5 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900";

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] space-y-8 px-6 py-8 lg:px-10">
        {/* Header */}
        <header className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {job.company?.name ?? "—"}
              {job.location ? ` · ${job.location}` : ""} · Publicada {fromNow(job.createdAt)} · Actualizada {fromNow(job.updatedAt)}
            </p>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Link href={`/dashboard/jobs/${job.id}`} className={headerBtnClasses}>Ver Pipeline</Link>
            <Link href={`/jobs/${job.id}`} target="_blank" className={headerBtnClasses}>Ver vacante</Link>
            <Link href="/dashboard/jobs" className={headerBtnClasses}>Volver a Vacantes</Link>
            <JobActionsMenu jobId={job.id} currentStatus={job.status} />
          </div>
        </header>

        {/* ✅ NUEVO: Banner de upgrade si hay candidatos bloqueados */}
        {lockedCount > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-700/40 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {lockedCount} candidato{lockedCount > 1 ? "s" : ""} con AI Match bloqueado
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Plan {PLAN_LABELS[plan]}:{" "}
                  {plan === "FREE"
                    ? "Actualiza a Starter para ver el AI Match de tus candidatos"
                    : "Actualiza a Pro para ver el AI Match de todos los candidatos"}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Mejorar plan →
            </Link>
          </div>
        )}

        {/* Tabs por interés */}
        <section className="glass-card rounded-2xl border p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={interestParam === "ALL"} href={buildInterestHref("ALL")} label={`Todos (${total})`} />
            <FilterPill active={chosenInterest === "REVIEW"} href={buildInterestHref("REVIEW")} label={`En revisión (${counters.REVIEW})`} />
            <FilterPill active={chosenInterest === "MAYBE"} href={buildInterestHref("MAYBE")} label={`En duda (${counters.MAYBE})`} />
            <FilterPill active={chosenInterest === "ACCEPTED"} href={buildInterestHref("ACCEPTED")} label={`Aceptados (${counters.ACCEPTED})`} />
            <FilterPill active={chosenInterest === "REJECTED"} href={buildInterestHref("REJECTED")} label={`Rechazados (${counters.REJECTED})`} />
          </div>
        </section>

        {/* Tabla */}
        {appsWithGate.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-4 text-center md:p-6">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
              {chosenInterest ? `Sin candidatos en ${INTEREST_LABEL[chosenInterest]}.` : "Aún no hay postulaciones para esta vacante."}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Usa el botón &ldquo;Ver vacante&rdquo; para compartirla y recibir postulaciones.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            {/* Barra herramientas */}
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <form method="get" className="relative w-full max-w-xs text-sm">
                {interestParam && <input type="hidden" name="interest" value={interestParam} />}
                {sortKey && <input type="hidden" name="sort" value={sortKey} />}
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  name="q"
                  defaultValue={qParam}
                  className="w-full rounded-full border border-zinc-200 bg-white/70 py-1.5 pl-7 pr-3 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  placeholder="Buscar candidato, email, ciudad o skill…"
                />
              </form>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Ordenar por:</span>
                <div className="inline-flex rounded-full bg-zinc-100/60 p-0.5 text-xs dark:bg-zinc-900/70">
                  <SortPill href={buildSortHref("match")} active={sortKey === "match"}>Match</SortPill>
                  <SortPill href={buildSortHref("recent")} active={sortKey === "recent"}>Actividad</SortPill>
                  <SortPill href={buildSortHref("name")} active={sortKey === "name"}>Nombre</SortPill>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <tr>
                    <th className="py-2 px-3">Candidato</th>
                    <th className="py-2 px-3">
                      <span className="flex items-center gap-1">
                        AI Match
                        {!hasJobSkills && (
                          <span className="text-[10px] font-normal text-zinc-400">(define skills en la vacante)</span>
                        )}
                      </span>
                    </th>
                    <th className="py-2 px-3">Skills coincidentes</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Actividad</th>
                    <th className="py-2 px-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {appsWithGate.map((a: any) => {
                    const matchResult = a._matchResult;
                    const gatedScore: number | null = a._gatedScore;
                    const locked: boolean = a._locked;

                    const matchedDetails = (matchResult?.details ?? []).filter((d: any) => d.matched).slice(0, 4);
                    const hiddenCount = Math.max(0, (matchResult?.matchedCount ?? 0) - matchedDetails.length);

                    const candidateHref = a.candidate?.id
                      ? `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`
                      : undefined;

                    const fullName: string = a._fullName ?? "—";
                    const languages = a.candidate?.candidateLanguages ?? [];
                    const phone = a.candidate?.phone as string | undefined;
                    const resumeUrl = a.candidate?.resumeUrl as string | undefined;
                    const hasWhatsApp = phone?.trim().startsWith("+52");
                    const assessMeta = assessmentEnabled && chosenTemplateId
                      ? assessmentByAppId.get(a.id) ?? null
                      : null;

                    return (
                      <tr key={a.id} className="align-top border-t border-zinc-100 dark:border-zinc-800">

                        {/* Candidato — igual que antes */}
                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            {candidateHref ? (
                              <Link href={candidateHref} className="font-medium hover:underline" title="Ver detalle del candidato">
                                {fullName}
                              </Link>
                            ) : (
                              <span className="font-medium">{fullName}</span>
                            )}
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{a.candidate?.location ?? "—"}</span>
                            {languages.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {languages.slice(0, 2).map((l: any) => (
                                  <span key={`${l.term.label}-${l.level}`} className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                                    {l.term.label} {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
                                  </span>
                                ))}
                                {languages.length > 2 && (
                                  <span className="text-[10px] text-zinc-500">+{languages.length - 2}</span>
                                )}
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {phone && (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-200" title={`Tel: ${phone}`}>
                                  <Phone className="h-3 w-3" />
                                </span>
                              )}
                              {resumeUrl && (
                                <a href={resumeUrl} target="_blank" rel="noreferrer"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                                  title="Ver CV">
                                  <FileTextIcon className="h-3 w-3" />
                                </a>
                              )}
                              {hasWhatsApp && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                  WhatsApp
                                </span>
                              )}
                            </div>
                            {assessMeta?.enabled && assessMeta.state !== "NONE" && (
                              <div className="mt-1">
                                <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
                                  assessMeta.state === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
                                  : assessMeta.state === "STARTED" ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-900/20 dark:text-sky-200"
                                  : assessMeta.state === "EXPIRED" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
                                  : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-900/20 dark:text-violet-200",
                                ].join(" ")}>
                                  {assessMeta.state === "COMPLETED"
                                    ? `Assessment: ${typeof assessMeta.score === "number" ? `${assessMeta.score}%` : "OK"}`
                                    : assessMeta.state === "STARTED" ? "Assessment: iniciado"
                                    : assessMeta.state === "EXPIRED" ? "Assessment: expirado"
                                    : "Assessment: enviado"}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* ✅ NUEVO: AI Match con gate de plan */}
                        <td className="py-2 px-3">
                          {!hasJobSkills ? (
                            <span className="text-xs text-zinc-400">—</span>
                          ) : locked ? (
                            <div className="group relative inline-flex cursor-pointer items-center gap-1.5">
                              <div className="flex h-8 w-20 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40">
                                <Lock className="h-3.5 w-3.5 text-zinc-400" />
                                <span className="text-xs font-medium text-zinc-400">
                                  {plan === "FREE" ? "Starter" : "Pro"}
                                </span>
                              </div>
                              {/* Tooltip hover */}
                              <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-52 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-xl group-hover:block dark:border-zinc-700 dark:bg-zinc-900">
                                <p className="font-semibold text-zinc-800 dark:text-zinc-100">AI Match bloqueado</p>
                                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                                  Mejora a {plan === "FREE" ? "Starter" : "Pro"} para ver el score de este candidato.
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
                            <div className="min-w-[110px]">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${scoreToTextColor(gatedScore!)}`}>
                                  {gatedScore}%
                                </span>
                                <div className="h-1.5 w-20 rounded bg-zinc-200/60 dark:bg-zinc-700/50">
                                  <div
                                    className={`h-1.5 rounded transition-all ${scoreToColor(gatedScore!)}`}
                                    style={{ width: `${Math.max(0, Math.min(gatedScore!, 100))}%` }}
                                    aria-label={`Match ${gatedScore}%`}
                                  />
                                </div>
                              </div>
                              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {scoreToLabel(gatedScore!)}
                                {matchResult && ` · ${matchResult.matchedCount}/${jobSkillsForEngine.length}`}
                              </p>
                            </div>
                          )}
                        </td>

                        {/* ✅ NUEVO: Skills coincidentes del engine */}
                        <td className="py-2 px-3">
                          {locked ? (
                            <span className="text-xs text-zinc-400">—</span>
                          ) : matchedDetails.length ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {matchedDetails.map((d: any, i: number) => (
                                <span
                                  key={`${d.termId}-${i}`}
                                  title={d.must ? "Skill requerida" : "Skill deseable"}
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                                    d.must
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:border-emerald-600/60 dark:bg-emerald-900/20 dark:text-emerald-200"
                                      : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
                                  }`}
                                >
                                  {d.must && <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide">Req</span>}
                                  {d.label}
                                  {d.candidateLevel && (
                                    <span className="ml-1 text-[9px] opacity-60">L{d.candidateLevel}</span>
                                  )}
                                </span>
                              ))}
                              {hiddenCount > 0 && (
                                <span className="text-[11px] text-zinc-500">+{hiddenCount}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">—</span>
                          )}
                        </td>

                        {/* Estado — sin cambios */}
                        <td className="py-2 px-3">
                          <div className="inline-flex min-w-[130px] max-w-[150px] text-sm">
                            <InterestSelect applicationId={a.id} initial={getAppInterest(a)} />
                          </div>
                        </td>

                        <td className="py-2 px-3 text-sm text-zinc-600 dark:text-zinc-400"
                          title={new Date(a._lastActivity).toLocaleString()}>
                          {fromNow(a._lastActivity)}
                        </td>

                        <td className="py-2 px-3 align-top">
                          <ActionsMenu
                            applicationId={a.id}
                            jobId={job.id}
                            candidateHref={candidateHref}
                            resumeUrl={resumeUrl ?? null}
                            candidateEmail={a.candidate?.email ?? ""}
                            candidatePhone={phone ?? null}
                            assessment={
                              assessmentEnabled && chosenTemplateId
                                ? ({ enabled: true, templateId: chosenTemplateId, state: (assessMeta?.state ?? "NONE") as any, token: assessMeta?.token ?? null, attemptId: assessMeta?.attemptId ?? null } as any)
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

/* ===== UI subcomponentes ===== */

function FilterPill({ active, href, label }: { active?: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-w-[130px] items-center justify-center rounded-full px-4 py-1.5 text-sm border transition
        ${active
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
          : "border-zinc-200 bg-transparent text-zinc-700 hover:bg-zinc-100/70 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-900/60"
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
      className={`px-3 py-1 text-xs rounded-full transition ${
        active
          ? "bg-white text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-200"
          : "text-zinc-600 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
      }`}
    >
      {children}
    </Link>
  );
}