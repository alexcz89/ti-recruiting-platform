// app/dashboard/jobs/[id]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import Kanbanboard from "./KanbanBoard";
import { ApplicationInterest, ApplicationStatus } from "@prisma/client";
import {
  computeMatchScore,
  applyPlanGate,
  scoreToTextColor,
  scoreToLabel,
  type BillingPlan,
  type JobSkillInput,
  type CandidateSkillInput,
  type SeniorityLevel,
} from "@/lib/ai/matchScore";

function toSeniorityLevel(s: string | null | undefined): SeniorityLevel | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "junior" || lower === "mid" || lower === "senior") return lower;
  return null;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: { id: string } };

const INTEREST_STATUSES: ApplicationInterest[] = [
  "REVIEW",
  "MAYBE",
  "ACCEPTED",
  "REJECTED",
];

const INTEREST_LABEL: Record<ApplicationInterest, string> = {
  REVIEW: "Por revisar",
  MAYBE: "Preselecto",
  ACCEPTED: "Entrevista",
  REJECTED: "Descartado",
};

export default async function JobPipelinePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/signin?callbackUrl=/dashboard/jobs/${params.id}`);
  }

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    redirect("/dashboard/overview");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true, name: true },
  });
  const plan = (company?.billingPlan ?? "FREE") as BillingPlan;

  // Verificar que la vacante pertenece a la empresa de la sesión
  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: {
      id: true,
      slug: true,
      title: true,
      location: true,
      seniority: true,
      minYearsExperience: true,
      company: { select: { name: true } },
      requiredSkills: {
        select: {
          must: true,
          weight: true,
          term: { select: { id: true, label: true } },
        },
      },
      assessments: {
        orderBy: { createdAt: "asc" },
        select: { templateId: true, template: { select: { title: true } } },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const allJobTemplateIds = (job.assessments ?? []).map((a) => a.templateId);
  const assessmentEnabled = allJobTemplateIds.length > 0;
  const templateTitles: Record<string, string> = Object.fromEntries(
    (job.assessments ?? []).map((a) => [a.templateId, (a as any).template?.title ?? a.templateId])
  );

  const jobSkills: JobSkillInput[] = job.requiredSkills.map((rs) => ({
    termId: rs.term.id,
    label: rs.term.label,
    must: rs.must,
    weight: rs.weight,
  }));
  const jobSeniority = toSeniorityLevel(job.seniority);
  const hasMatchSignals = jobSkills.length > 0 || jobSeniority !== null || job.minYearsExperience !== null;

  // Traer aplicaciones + candidato
  const applications = await prisma.application.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: "asc" },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          resumeUrl: true,
          phone: true,
          location: true,
          seniority: true,
          yearsExperience: true,
          candidateSkills: {
            select: {
              level: true,
              term: { select: { id: true, label: true } },
            },
            orderBy: [{ level: "desc" }],
          },
        },
      },
    },
  });

  // ── Assessment state per application ─────────────────────────────────────────
  type AssessmentMeta = {
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    score: number | null;
    passed: boolean | null;
    attemptId: string | null;
    templateTitle: string | null;
  };

  // Stores ALL assessment states per application (one per template)
  const assessmentByAppId = new Map<string, AssessmentMeta[]>();

  if (assessmentEnabled && applications.length > 0) {
    const applicationIds = applications.map((a) => a.id);
    const now = new Date();

    const [invites, attempts] = await Promise.all([
      prisma.assessmentInvite.findMany({
        where: { applicationId: { in: applicationIds }, templateId: { in: allJobTemplateIds } },
        orderBy: { updatedAt: "desc" },
        select: { applicationId: true, templateId: true, token: true, status: true, expiresAt: true },
      }),
      prisma.assessmentAttempt.findMany({
        where: { applicationId: { in: applicationIds }, templateId: { in: allJobTemplateIds } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, applicationId: true, templateId: true, status: true, totalScore: true, passed: true, expiresAt: true },
      }),
    ]);

    // Best attempt per (appId:templateId)
    const statusRank = (s: string) => {
      const v = s.toUpperCase();
      if (v === "SUBMITTED" || v === "EVALUATED" || v === "COMPLETED") return 3;
      if (v === "IN_PROGRESS") return 2;
      if (v === "NOT_STARTED") return 1;
      return 0;
    };

    const attemptByKey = new Map<string, typeof attempts[number]>();
    for (const at of attempts) {
      if (!at.applicationId || !at.templateId) continue;
      const key = `${at.applicationId}:${at.templateId}`;
      const prev = attemptByKey.get(key);
      if (!prev || statusRank(String(at.status)) >= statusRank(String(prev.status))) {
        attemptByKey.set(key, at);
      }
    }

    const inviteByKey = new Map<string, typeof invites[number]>();
    for (const inv of invites) {
      if (!inv.applicationId || !inv.templateId) continue;
      const key = `${inv.applicationId}:${inv.templateId}`;
      if (!inviteByKey.has(key)) inviteByKey.set(key, inv);
    }

    for (const appId of applicationIds) {
      const perTemplateStates: AssessmentMeta[] = [];

      for (const templateId of allJobTemplateIds) {
        const key = `${appId}:${templateId}`;
        const at = attemptByKey.get(key);
        const inv = inviteByKey.get(key);
        const title = templateTitles[templateId] ?? null;

        const atStatus = String(at?.status ?? "").toUpperCase();
        const invStatus = String(inv?.status ?? "").toUpperCase();
        const attemptExpired = !!at?.expiresAt && new Date(at.expiresAt) <= now;
        const inviteExpired = !!inv?.expiresAt && new Date(inv.expiresAt) <= now;

        // Un invite "activo" es uno que fue (re)enviado hoy o recientemente y no expiró.
        // Tiene prioridad sobre un attempt viejo expirado (que pudo haber quedado huérfano
        // cuando el reclutador re-envió el invite y rotó el token).
        const inviteIsActive =
          !!inv && !inviteExpired && (invStatus === "SENT" || invStatus === "STARTED");

        let state: AssessmentMeta;

        if (at && (atStatus === "SUBMITTED" || atStatus === "EVALUATED" || atStatus === "COMPLETED")) {
          // 1. Attempt completado → siempre gana
          state = { state: "COMPLETED", score: typeof at.totalScore === "number" ? at.totalScore : null, passed: typeof at.passed === "boolean" ? at.passed : null, attemptId: at.id, templateTitle: title };
        } else if (inviteIsActive) {
          // 2. Invite fresco activo → ignorar attempt viejo expirado (fue huérfano)
          const inProgress = at && atStatus === "IN_PROGRESS" && !attemptExpired;
          state = { state: inProgress ? "STARTED" : invStatus === "STARTED" ? "STARTED" : "SENT", score: null, passed: null, attemptId: inProgress ? at!.id : null, templateTitle: title };
        } else if (at && atStatus === "IN_PROGRESS" && !attemptExpired) {
          // 3. Attempt en progreso vigente
          state = { state: "STARTED", score: null, passed: null, attemptId: at.id, templateTitle: title };
        } else if (attemptExpired || inviteExpired) {
          // 4. Todo expirado
          state = { state: "EXPIRED", score: null, passed: null, attemptId: at?.id ?? null, templateTitle: title };
        } else if (inv) {
          // 5. Invite con otros estados
          if (invStatus === "CANCELLED" || invStatus === "REVOKED") {
            state = { state: "EXPIRED", score: null, passed: null, attemptId: null, templateTitle: title };
          } else if (invStatus === "SUBMITTED" || invStatus === "EVALUATED" || invStatus === "COMPLETED") {
            state = { state: "COMPLETED", score: typeof at?.totalScore === "number" ? at.totalScore : null, passed: typeof at?.passed === "boolean" ? at.passed : null, attemptId: at?.id ?? null, templateTitle: title };
          } else {
            state = { state: invStatus === "STARTED" ? "STARTED" : "SENT", score: null, passed: null, attemptId: null, templateTitle: title };
          }
        } else {
          // No invite sent yet — skip
          continue;
        }

        perTemplateStates.push(state);
      }

      assessmentByAppId.set(appId, perTemplateStates);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const appCards = applications.map((a, idx) => {
    const candidateSkills: CandidateSkillInput[] = (a.candidate.candidateSkills ?? []).map((cs: any) => ({
      termId: cs.term.id,
      label: cs.term.label,
      level: cs.level,
    }));
    const matchResult = computeMatchScore({
      jobSkills,
      candidateSkills,
      jobSeniority,
      candidateSeniority: toSeniorityLevel((a.candidate as any).seniority),
      jobMinYearsExperience: job.minYearsExperience ?? null,
      candidateYearsExperience: (a.candidate as any).yearsExperience ?? null,
    });
    const rawScore = matchResult?.score ?? 0;
    const gatedScore = applyPlanGate(rawScore, idx, plan);

    const assessMetas = assessmentEnabled ? (assessmentByAppId.get(a.id) ?? []) : [];

    return {
      id: a.id,
      status: (a.recruiterInterest ?? "REVIEW") as ApplicationInterest,
      createdAt: a.createdAt,
      updatedAt: (a as any).updatedAt ?? a.createdAt,
      _score: gatedScore,
      _locked: gatedScore === null,
      _assessments: assessMetas,
      candidate: {
        id: a.candidate.id,
        name: a.candidate.name ?? a.candidate.email,
        email: a.candidate.email,
        resumeUrl: a.candidate.resumeUrl,
        phone: (a.candidate as any).phone ?? null,
        location: (a.candidate as any).location ?? null,
        _skills: (a.candidate.candidateSkills ?? []).map((cs: any) => cs.term.label),
      },
    };
  });

  // -------- Server Action para mover tarjetas en el Kanban --------
  async function moveAction(
    fd: FormData
  ): Promise<{ ok: boolean; message?: string }> {
    "use server";

    const s = await getServerSession(authOptions);
    if (!s?.user) {
      return { ok: false, message: "No autenticado" };
    }

    const companyId2 = await getSessionCompanyId().catch(() => null);
    if (!companyId2) {
      return { ok: false, message: "Sin empresa asociada" };
    }

    const appId = String(fd.get("appId") || "");
    const newStatusStr = String(fd.get("newStatus") || "") as ApplicationInterest;

    if (!appId || !newStatusStr) {
      return { ok: false, message: "Faltan datos" };
    }

    if (!INTEREST_STATUSES.includes(newStatusStr)) {
      return { ok: false, message: "Estado inválido" };
    }

    // Verificar que la aplicación pertenece a una vacante de esta empresa
    const app = await prisma.application.findFirst({
      where: { id: appId, job: { companyId: companyId2 } },
      select: { id: true },
    });

    if (!app) {
      return { ok: false, message: "No tienes acceso a esta postulación" };
    }

    const isRejected = newStatusStr === "REJECTED";

    await prisma.application.update({
      where: { id: app.id },
      data: {
        recruiterInterest: newStatusStr,
        status: isRejected
          ? ApplicationStatus.REJECTED
          : ApplicationStatus.REVIEWING,
        rejectedAt: isRejected ? new Date() : null,
        rejectionEmailSent: false,
      },
    });

    return { ok: true };
  }

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-8 space-y-6">
        {/* Header vacante */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Pipeline de candidatos
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              {job.title}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {job.company?.name ?? "—"}
              {job.location ? ` · ${job.location}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/jobs/${job.id}/applications`}
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
            >
              Ver postulaciones (lista)
            </Link>

            {/* 👇 Nuevo botón: ver la vacante pública */}
            <Link
              href={`/jobs/${job.slug ?? job.id}`}
              target="_blank"
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
            >
              Ver vacante
            </Link>

            <Link
              href="/dashboard/jobs"
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
            >
              Volver a vacantes
            </Link>
          </div>
        </header>

        {/* Kanban / Pipeline */}
        <Kanbanboard
          jobId={job.id}
          statuses={INTEREST_STATUSES}
          statusLabels={INTEREST_LABEL}
          applications={appCards}
          hasMatchSignals={hasMatchSignals}
          moveAction={moveAction}
        />
      </div>
    </main>
  );
}
