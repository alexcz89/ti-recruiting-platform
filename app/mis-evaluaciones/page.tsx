// app/mis-evaluaciones/page.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionOrThrow } from "@/lib/session";
import { fromNow } from "@/lib/dates";
import { Award, CheckCircle2, Play, AlertTriangle, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Mis Evaluaciones" };

type AttemptStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "EVALUATED" | "COMPLETED";

function isFinalAttemptStatus(s: any) {
  return s === "SUBMITTED" || s === "EVALUATED" || s === "COMPLETED";
}

function isInProgressAttemptStatus(s: any) {
  return s === "IN_PROGRESS" || s === "NOT_STARTED";
}

function keyJT(jobId: string, templateId: string) {
  return `${jobId}::${templateId}`;
}

export default async function MyAssessmentsPage() {
  const session = await getSessionOrThrow().catch(() => null);
  const userId = String((session?.user as any)?.id || "");

  if (!userId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-10">
          <p>Debes iniciar sesión para ver tus evaluaciones</p>
        </div>
      </main>
    );
  }

  const now = new Date();

  // 1) Attempts (para historial y “continuar”)
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { candidateId: userId },
    select: {
      id: true,
      status: true,
      templateId: true,
      applicationId: true,
      inviteId: true,
      totalScore: true,
      passed: true,
      createdAt: true,
      startedAt: true,
      submittedAt: true,
      expiresAt: true,
      template: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          totalQuestions: true,
          timeLimit: true,
          passingScore: true,
        },
      },
      application: {
        select: {
          id: true,
          jobId: true,
          job: {
            select: {
              id: true,
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 2) Invites activos (SENT/STARTED) para mostrar “Pendientes (obligatorias)” aunque todavía NO exista attempt
  const invites = await prisma.assessmentInvite.findMany({
    where: {
      candidateId: userId,
      status: { in: ["SENT", "STARTED"] as any },
    },
    select: {
      id: true,
      token: true,
      status: true,
      templateId: true,
      applicationId: true,
      jobId: true,
      expiresAt: true,
      sentAt: true,
      createdAt: true,
      updatedAt: true,
      template: {
        select: { id: true, title: true, difficulty: true, timeLimit: true, passingScore: true },
      },
      application: {
        select: {
          id: true,
          jobId: true,
          job: {
            select: {
              id: true,
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 3) JobAssessment meta (isRequired/minScore) para etiquetar “Obligatorio”
  const jobIds = new Set<string>();
  const templateIds = new Set<string>();

  for (const a of attempts) {
    const j = a.application?.jobId ?? a.application?.job?.id;
    if (j) jobIds.add(String(j));
    templateIds.add(String(a.templateId));
  }
  for (const iv of invites) {
    const j = iv.application?.jobId ?? iv.application?.job?.id ?? iv.jobId;
    if (j) jobIds.add(String(j));
    templateIds.add(String(iv.templateId));
  }

  const jobAssessments = jobIds.size
    ? await prisma.jobAssessment.findMany({
        where: {
          jobId: { in: Array.from(jobIds) },
          templateId: { in: Array.from(templateIds) },
        },
        select: {
          jobId: true,
          templateId: true,
          isRequired: true,
          minScore: true,
        },
      })
    : [];

  const jaMap = new Map<string, { isRequired: boolean; minScore: number | null }>();
  for (const ja of jobAssessments) {
    jaMap.set(keyJT(String(ja.jobId), String(ja.templateId)), {
      isRequired: Boolean(ja.isRequired),
      minScore: ja.minScore ?? null,
    });
  }

  // 4) Índices para “pegar” invite ⇄ attempt
  const attemptByInviteId = new Map<string, (typeof attempts)[number]>();
  const attemptByAppTemplate = new Map<string, (typeof attempts)[number]>();

  for (const a of attempts) {
    if (a.inviteId) {
      if (!attemptByInviteId.has(String(a.inviteId))) attemptByInviteId.set(String(a.inviteId), a);
    }
    if (a.applicationId) {
      const k = `${String(a.applicationId)}::${String(a.templateId)}`;
      if (!attemptByAppTemplate.has(k)) attemptByAppTemplate.set(k, a);
    }
  }

  // 5) Construir “pendientes” desde invites que no tengan attempt final/en progreso
  const pendingInvites = invites
    .map((iv) => {
      const byInvite = attemptByInviteId.get(String(iv.id));
      const byPair = attemptByAppTemplate.get(`${String(iv.applicationId)}::${String(iv.templateId)}`);
      const relatedAttempt = byInvite ?? byPair ?? null;

      // Si ya hay attempt final, ya aparecerá en completadas (no lo dupliques)
      if (relatedAttempt && isFinalAttemptStatus(relatedAttempt.status)) return null;

      // Si ya hay attempt en progreso, ya aparecerá en “En progreso”
      if (relatedAttempt && isInProgressAttemptStatus(relatedAttempt.status)) return null;

      const jobId = String(iv.application?.jobId ?? iv.application?.job?.id ?? iv.jobId ?? "");
      const meta = jobId ? jaMap.get(keyJT(jobId, String(iv.templateId))) : undefined;

      const expired = iv.expiresAt ? iv.expiresAt <= now : false;

      return {
        invite: iv,
        expired,
        isRequired: Boolean(meta?.isRequired),
        minScore: meta?.minScore ?? null,
      };
    })
    .filter(Boolean) as Array<{
    invite: (typeof invites)[number];
    expired: boolean;
    isRequired: boolean;
    minScore: number | null;
  }>;

  // 6) Secciones por attempts (como ya lo tenías)
  const completedAttempts = attempts.filter((a) => isFinalAttemptStatus(a.status));
  const inProgressAttempts = attempts.filter((a) => isInProgressAttemptStatus(a.status));

  // Stats útiles para el candidato
  const requiredPendingCount = pendingInvites.filter((x) => x.isRequired && !x.expired).length;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-default">Mis Evaluaciones</h1>
            <p className="text-sm text-muted mt-1">Tus evaluaciones pendientes, en progreso y resultados</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/assessments" className="btn btn-primary">
              Ver invitaciones
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Pendientes (obligatorias)"
            value={requiredPendingCount}
            icon={<ClipboardList className="h-5 w-5 text-violet-600" />}
            accent="violet"
          />
          <StatCard
            label="Total completadas"
            value={completedAttempts.length}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Aprobadas"
            value={completedAttempts.filter((a) => a.passed).length}
            icon={<Award className="h-5 w-5 text-emerald-600" />}
            accent="emerald"
          />
          <StatCard
            label="En progreso"
            value={inProgressAttempts.length}
            icon={<Play className="h-5 w-5 text-blue-600" />}
            accent="blue"
          />
        </div>

        {/* Pendientes (desde invites) */}
        {pendingInvites.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-default mb-4">🧩 Pendientes</h2>
            <div className="space-y-3">
              {pendingInvites.map(({ invite, expired, isRequired, minScore }) => {
                const jobTitle = invite.application?.job?.title;
                const companyName = invite.application?.job?.company?.name;

                const badge = isRequired ? "Obligatorio" : "Opcional";

                const badgeCls = isRequired
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-200"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-200";

                return (
                  <div
                    key={invite.id}
                    className={`
                      p-6 rounded-2xl border glass-card
                      ${expired ? "border-amber-200 dark:border-amber-500/30" : "border-violet-200 dark:border-violet-500/30"}
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg text-default">{invite.template.title}</h3>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
                            {badge}
                          </span>
                          {minScore != null && (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200">
                              Mínimo: {minScore}%
                            </span>
                          )}
                        </div>

                        {(jobTitle || companyName) && (
                          <p className="text-sm text-muted mt-1">
                            Para: {jobTitle || "—"}
                            {companyName ? ` • ${companyName}` : ""}
                          </p>
                        )}

                        <p className="text-sm text-muted mt-2">
                          {expired ? (
                            <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-200">
                              <AlertTriangle className="h-4 w-4" />
                              Invitación expirada
                            </span>
                          ) : (
                            <>Enviada {invite.sentAt ? fromNow(invite.sentAt) : fromNow(invite.createdAt)}</>
                          )}
                        </p>
                      </div>

                      {expired ? (
                        <button className="btn btn-secondary" disabled title="Expirada">
                          Expirada
                        </button>
                      ) : (
                        <Link
                          href={`/assessments/${invite.templateId}?token=${encodeURIComponent(invite.token)}`}
                          className="btn btn-primary"
                        >
                          Iniciar →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* En progreso (attempts) */}
        {inProgressAttempts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-default mb-4">⏳ En progreso</h2>
            <div className="space-y-3">
              {inProgressAttempts.map((attempt) => {
                const jobTitle = attempt.application?.job?.title;
                const companyName = attempt.application?.job?.company?.name;

                // badge “Obligatorio” si el jobAssessment lo marca
                const jobId = attempt.application?.jobId ?? attempt.application?.job?.id;
                const meta = jobId ? jaMap.get(keyJT(String(jobId), String(attempt.templateId))) : undefined;
                const required = Boolean(meta?.isRequired);

                return (
                  <div
                    key={attempt.id}
                    className="p-6 rounded-2xl border border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-900/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg text-default">{attempt.template.title}</h3>
                          {required && (
                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-200">
                              Obligatorio
                            </span>
                          )}
                        </div>

                        {(jobTitle || companyName) && (
                          <p className="text-sm text-muted mt-1">
                            Para: {jobTitle || "—"}
                            {companyName ? ` • ${companyName}` : ""}
                          </p>
                        )}

                        <p className="text-sm text-muted mt-2">
                          Iniciada {attempt.startedAt ? fromNow(attempt.startedAt) : "—"}
                        </p>
                      </div>

                      <Link
                        href={`/assessments/${attempt.templateId}?attemptId=${attempt.id}`}
                        className="btn btn-primary"
                      >
                        Continuar →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Completadas */}
        {completedAttempts.length > 0 ? (
          <section>
            <h2 className="text-xl font-semibold text-default mb-4">✅ Completadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedAttempts.map((attempt) => {
                const jobTitle = attempt.application?.job?.title;
                const companyName = attempt.application?.job?.company?.name;

                return (
                  <div
                    key={attempt.id}
                    className={`
                      p-6 rounded-2xl border glass-card
                      ${attempt.passed ? "border-emerald-200 dark:border-emerald-500/30" : ""}
                    `}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-default">{attempt.template.title}</h3>
                        <p className="text-xs text-muted mt-1 capitalize">{attempt.template.difficulty}</p>
                      </div>

                      {attempt.passed ? (
                        <span className="shrink-0 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-medium">
                          Aprobado
                        </span>
                      ) : (
                        <span className="shrink-0 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs font-medium">
                          No aprobado
                        </span>
                      )}
                    </div>

                    {(jobTitle || companyName) && (
                      <p className="text-sm text-muted mb-3">
                        {jobTitle || "—"}
                        {companyName ? ` • ${companyName}` : ""}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-emerald-600">{attempt.totalScore ?? 0}%</p>
                        <p className="text-xs text-muted">{attempt.submittedAt ? fromNow(attempt.submittedAt) : "—"}</p>
                      </div>

                      <Link
                        href={`/assessments/attempts/${attempt.id}/results`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver detalles →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="text-center py-10">
            <p className="text-lg font-medium text-default">Aún no tienes evaluaciones completadas</p>
            <p className="text-sm text-muted mt-1">
              Cuando termines una evaluación, aquí verás tu historial y resultados.
            </p>
            <div className="mt-4">
              <Link href="/assessments" className="btn btn-primary">
                Ver invitaciones
              </Link>
            </div>
          </div>
        )}

        {/* Empty state si no hay nada */}
        {pendingInvites.length === 0 && inProgressAttempts.length === 0 && completedAttempts.length === 0 && (
          <div className="glass-card rounded-2xl border border-dashed p-6 text-center">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">Aún no tienes evaluaciones</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Cuando una empresa te envíe una evaluación (o sea obligatoria al aplicar), aparecerá aquí.
            </p>
            <div className="mt-4">
              <Link href="/assessments" className="btn btn-primary">
                Ver invitaciones
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent?: "emerald" | "blue" | "violet";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "blue"
      ? "text-blue-600"
      : accent === "violet"
      ? "text-violet-600"
      : "text-default";

  return (
    <div className="p-6 rounded-2xl border glass-card">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
