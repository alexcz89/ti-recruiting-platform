// app/assessments/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type UiState = "COMPLETED" | "IN_PROGRESS" | "EXPIRED" | "CANCELLED" | "PENDING";

function pickUiState(inv: any, attempt: any, now: Date): UiState {
  const invStatus = String(inv?.status ?? "").toUpperCase();
  const atStatus = String(attempt?.status ?? "").toUpperCase();

  // ✅ Si hay attempt y ya expiró, debe dominar (aunque diga IN_PROGRESS)
  if (attempt?.expiresAt && new Date(attempt.expiresAt) <= now) return "EXPIRED";

  // attempt manda (si existe)
  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(atStatus)) return "COMPLETED";
  if (atStatus === "IN_PROGRESS") return "IN_PROGRESS";

  if (atStatus === "NOT_STARTED") {
    // si invite ya está STARTED, muéstralo como en progreso
    if (invStatus === "STARTED") return "IN_PROGRESS";
    return "PENDING";
  }

  // sin attempt: usa invite
  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(invStatus)) return "COMPLETED";
  if (invStatus === "CANCELLED") return "CANCELLED";
  if (inv?.expiresAt && new Date(inv.expiresAt) <= now) return "EXPIRED";
  if (invStatus === "STARTED") return "IN_PROGRESS";

  return "PENDING";
}

function statusLabel(state: UiState) {
  if (state === "COMPLETED") return "Completada";
  if (state === "IN_PROGRESS") return "En progreso";
  if (state === "EXPIRED") return "Expirada";
  if (state === "CANCELLED") return "Cancelada";
  return "Pendiente";
}

function statusTone(state: UiState) {
  if (state === "COMPLETED")
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800/60";
  if (state === "IN_PROGRESS")
    return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800/60";
  if (state === "EXPIRED" || state === "CANCELLED")
    return "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-300 dark:border-zinc-800";
  return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:border-violet-800/60";
}

function fmtDate(d: any) {
  try {
    return new Date(d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function buildKey(inv: any) {
  const templateId = String(inv?.template?.id ?? inv?.templateId ?? "");
  const applicationId = String(inv?.application?.id ?? inv?.applicationId ?? "");
  // 👇 fallback si no hay applicationId
  return applicationId && templateId ? `${applicationId}::${templateId}` : `invite::${String(inv?.id ?? "")}`;
}

export default async function CandidateAssessmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const userId = String((session.user as any).id || "");
  const role = String((session.user as any).role ?? "").toUpperCase();
  if (role !== "CANDIDATE") redirect("/");

  const now = new Date();

  // 1) Traer invites (por candidateId directo o vía application.candidateId)
  const invitesRaw = await prisma.assessmentInvite.findMany({
    where: {
      OR: [{ candidateId: userId as any }, { application: { candidateId: userId as any } }] as any,
    },
    select: {
      id: true,
      token: true,
      status: true,
      expiresAt: true,
      templateId: true,
      applicationId: true,
      updatedAt: true,
      createdAt: true,
      template: { select: { id: true, title: true, timeLimit: true } },
      application: {
        select: {
          id: true,
          job: { select: { title: true, company: { select: { name: true } } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" }, // ✅ importante para dedupe
    take: 200,
  });

  // 2) ✅ Dedupe por (applicationId + templateId) con fallback a invite.id
  const inviteByKey = new Map<string, any>();
  for (const inv of invitesRaw) {
    const key = buildKey(inv);
    if (!key) continue;
    if (!inviteByKey.has(key)) inviteByKey.set(key, inv); // vienen DESC
  }
  const invites = Array.from(inviteByKey.values());

  // 3) Traer attempts:
  //    A) primero por inviteId (si tu schema lo soporta)
  //    B) fallback por pares exactos (applicationId + templateId)
  const inviteIds = invites.map((i) => i.id).filter(Boolean);

  const pairs = invites
    .map((inv: any) => ({
      applicationId: String(inv?.application?.id ?? inv?.applicationId ?? ""),
      templateId: String(inv?.template?.id ?? inv?.templateId ?? ""),
    }))
    .filter((p) => p.applicationId && p.templateId);

  const [attemptsByInvite, attemptsByPair] = await Promise.all([
    inviteIds.length
      ? prisma.assessmentAttempt.findMany({
          where: { inviteId: { in: inviteIds } as any },
          select: {
            id: true,
            inviteId: true,
            status: true,
            totalScore: true,
            passed: true,
            submittedAt: true,
            startedAt: true,
            expiresAt: true, // ✅ NECESARIO para detectar expiración
            applicationId: true,
            templateId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : Promise.resolve([] as any[]),
    pairs.length
      ? prisma.assessmentAttempt.findMany({
          where: {
            candidateId: userId as any,
            OR: pairs.map((p) => ({
              applicationId: p.applicationId as any,
              templateId: p.templateId as any,
            })) as any,
          } as any,
          select: {
            id: true,
            inviteId: true,
            status: true,
            totalScore: true,
            passed: true,
            submittedAt: true,
            startedAt: true,
            expiresAt: true, // ✅ NECESARIO para detectar expiración
            applicationId: true,
            templateId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : Promise.resolve([] as any[]),
  ]);

  const attemptByInviteId = new Map<string, any>();
  for (const a of attemptsByInvite) {
    if (!a.inviteId) continue;
    if (!attemptByInviteId.has(String(a.inviteId))) attemptByInviteId.set(String(a.inviteId), a);
  }

  const attemptByKey = new Map<string, any>();
  for (const a of attemptsByPair) {
    const key = `${String(a.applicationId)}::${String(a.templateId)}`;
    if (!attemptByKey.has(key)) attemptByKey.set(key, a);
  }

  const rows = invites.map((inv: any) => {
    const templateId = String(inv?.template?.id ?? inv?.templateId ?? "");
    const applicationId = String(inv?.application?.id ?? inv?.applicationId ?? "");
    const token = String(inv?.token ?? "");

    const attempt =
      attemptByInviteId.get(String(inv.id)) ||
      (applicationId && templateId ? attemptByKey.get(`${applicationId}::${templateId}`) : null) ||
      null;

    const state = pickUiState(inv, attempt, now);

    const jobTitle = inv?.application?.job?.title ?? "Vacante";
    const companyName = inv?.application?.job?.company?.name ?? "—";
    const templateTitle = inv?.template?.title ?? "Assessment";
    const timeLimit = inv?.template?.timeLimit ?? null;

    const startUrl =
      templateId && token
        ? `/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}`
        : `/assessments/${encodeURIComponent(templateId)}`;

    const resumeUrl = attempt?.id
      ? `/assessments/${encodeURIComponent(templateId)}?attemptId=${encodeURIComponent(attempt.id)}`
      : startUrl;

    const resultsUrl = attempt?.id ? `/assessments/attempts/${encodeURIComponent(attempt.id)}/results` : null;

    // ✅ para mostrar expiración correcta (si expiró por attempt, usa attempt.expiresAt)
    const expiresAtDisplay = attempt?.expiresAt ?? inv?.expiresAt ?? null;

    return {
      inv,
      attempt,
      templateId,
      applicationId,
      token,
      state,
      jobTitle,
      companyName,
      templateTitle,
      timeLimit,
      startUrl,
      resumeUrl,
      resultsUrl,
      expiresAtDisplay,
    };
  });

  // ✅ ahora sí separados
  const pending = rows.filter((r) => r.state === "PENDING");
  const inProgress = rows.filter((r) => r.state === "IN_PROGRESS");
  const completed = rows.filter((r) => r.state === "COMPLETED");
  const inactive = rows.filter((r) => r.state === "EXPIRED" || r.state === "CANCELLED");

  const pendingCount = pending.length;
  const inProgressCount = inProgress.length;
  const badgeCount = pendingCount + inProgressCount;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Evaluaciones</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Aquí verás las evaluaciones que te han asignado los reclutadores (y también te llegan por correo).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/mis-evaluaciones"
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Ver historial
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Ver vacantes
            </Link>
          </div>
        </header>

        {/* ✅ Banner */}
        {badgeCount > 0 && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/30 dark:bg-violet-900/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {pendingCount > 0
                    ? `Tienes ${pendingCount} evaluación${pendingCount === 1 ? "" : "es"} pendiente${
                        pendingCount === 1 ? "" : "s"
                      }.`
                    : `Tienes ${inProgressCount} evaluación${inProgressCount === 1 ? "" : "es"} en progreso.`}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  Completa tus evaluaciones para avanzar en tus postulaciones.
                </p>
              </div>

              <a
                href={pendingCount > 0 ? "#pendientes" : "#en-progreso"}
                className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700"
              >
                {pendingCount > 0 ? "Ir a pendientes" : "Ir a en progreso"}
              </a>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-6 text-center">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
              No tienes evaluaciones asignadas por el momento.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Si te asignan una, aparecerá aquí y también te llegará por correo.
            </p>
            <div className="mt-4">
              <Link
                href="/jobs"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-5 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Ir a vacantes
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pendientes */}
            <Section
              id="pendientes"
              title="Pendientes"
              count={pending.length}
              emptyText="No tienes evaluaciones pendientes."
              rows={pending}
              renderAction={(r) => (
                <Link
                  href={r.startUrl}
                  className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                >
                  Iniciar
                </Link>
              )}
            />

            {/* En progreso */}
            <Section
              id="en-progreso"
              title="En progreso"
              count={inProgress.length}
              emptyText="No tienes evaluaciones en progreso."
              rows={inProgress}
              renderAction={(r) => (
                <Link
                  href={r.resumeUrl}
                  className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700"
                >
                  Continuar
                </Link>
              )}
            />

            {/* Completadas */}
            <Section
              title="Completadas"
              count={completed.length}
              emptyText="Aún no completas evaluaciones."
              rows={completed}
              renderExtra={(r) => {
                const score = r.attempt?.totalScore ?? null;
                return score != null ? (
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Score: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{score}%</span>
                  </span>
                ) : null;
              }}
              renderAction={(r) =>
                r.resultsUrl ? (
                  <Link
                    href={r.resultsUrl}
                    className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Ver resultados
                  </Link>
                ) : null
              }
            />

            {/* Inactivas */}
            {inactive.length > 0 && (
              <Section
                title="Expiradas / Canceladas"
                count={inactive.length}
                rows={inactive}
                muted
                renderAction={(r) =>
                  // ✅ si tiene token, puedes dejar que el candidato “reinicie” (tu /start con token creará un attempt nuevo si el previo expiró)
                  r.token ? (
                    <Link
                      href={r.startUrl}
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      Reiniciar
                    </Link>
                  ) : null
                }
                renderFooter={() => (
                  <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                    Si aún deseas completarla, pide al reclutador que te reenvíe el link.
                  </p>
                )}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  count,
  emptyText,
  rows,
  muted,
  renderAction,
  renderExtra,
  renderFooter,
}: {
  id?: string;
  title: string;
  count: number;
  emptyText?: string;
  rows: any[];
  muted?: boolean;
  renderAction?: (r: any) => ReactNode;
  renderExtra?: (r: any) => ReactNode;
  renderFooter?: () => ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">{title}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{count}</span>
      </div>

      {rows.length === 0 ? (
        emptyText ? (
          <div className="rounded-2xl border border-zinc-100 bg-white/70 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
            {emptyText}
          </div>
        ) : null
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const tone = statusTone(r.state);
            const label = statusLabel(r.state);

            // ✅ usa expiresAtDisplay (attempt.expiresAt si existe; si no, invite.expiresAt)
            const expiresTxt = r.expiresAtDisplay ? fmtDate(r.expiresAtDisplay) : null;

            return (
              <div
                key={r.inv.id}
                className={[
                  "rounded-2xl border border-zinc-100 p-4 shadow-sm dark:border-zinc-800",
                  muted ? "bg-white/60 dark:bg-zinc-950/40" : "bg-white/90 dark:bg-zinc-950/70",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.templateTitle}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {r.companyName} · {r.jobTitle}
                      {r.timeLimit ? ` · ${r.timeLimit} min` : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
                        {label}
                      </span>

                      {expiresTxt && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {r.state === "EXPIRED" ? "Expiró" : "Expira"}: {expiresTxt}
                        </span>
                      )}

                      {renderExtra ? renderExtra(r) : null}
                    </div>

                    {renderFooter ? renderFooter() : null}
                  </div>

                  {renderAction ? <div className="flex shrink-0 items-center gap-2">{renderAction(r)}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
