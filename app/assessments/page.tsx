// app/assessments/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { AssessmentInboxRefresh } from "./AssessmentInboxRefresh";
import { AssessmentDateTime } from "./AssessmentDateTime";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { assessmentState, type AssessmentState } from '@/lib/assessments/expiration';
import { assessmentInvitationPath } from '@/lib/assessments/navigation';
import { CandidateAssessmentAction } from './CandidateAssessmentAction';

type UiState = AssessmentState;

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
  return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-200 dark:border-teal-800/60";
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
      sentAt: true,
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

    const rawAttempt =
      attemptByInviteId.get(String(inv.id)) ||
      (applicationId && templateId ? attemptByKey.get(`${applicationId}::${templateId}`) : null) ||
      null;

    // Filtrar attempt obsoleto (de una ronda anterior al reenvío) antes de pasarlo a pickUiState
    const invStatusCheck = String(inv?.status ?? "").toUpperCase();
    const rawAtStatusCheck = String(rawAttempt?.status ?? "").toUpperCase();
    const isStaleHere =
      rawAttempt != null &&
      invStatusCheck === "SENT" &&
      ["SUBMITTED", "EVALUATED", "COMPLETED"].includes(rawAtStatusCheck) &&
      rawAttempt.createdAt != null &&
      inv.updatedAt != null &&
      new Date(rawAttempt.createdAt) < new Date(inv.updatedAt);

    const attempt = isStaleHere ? null : rawAttempt;

    const state = assessmentState(inv, attempt, now);

    const jobTitle = inv?.application?.job?.title ?? "Vacante";
    const companyName = inv?.application?.job?.company?.name ?? "—";
    const templateTitle = inv?.template?.title ?? "Assessment";
    const timeLimit = inv?.template?.timeLimit ?? null;

    const startUrl = assessmentInvitationPath({ templateId, token });

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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <AssessmentInboxRefresh />
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Tu proceso de selección</p>
          <h1 className="text-3xl font-bold tracking-tight">Mis evaluaciones</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">Consulta tus invitaciones, retoma una evaluación o revisa tus resultados.</p>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300" aria-live="polite"><strong className="text-2xl font-semibold text-zinc-950 dark:text-white">{badgeCount}</strong>{" "}{badgeCount === 1 ? "evaluación por completar" : "evaluaciones por completar"}</p>
      </header>
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <ClipboardList className="mx-auto mb-4 h-9 w-9 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Aún no tienes evaluaciones asignadas</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300">Cuando recibas una invitación, podrás consultarla aquí. También puedes revisar tus postulaciones.</p>
          <Link href="/profile/summary" className={secondaryAction + " mt-5"}>Ver mis postulaciones</Link>
        </section>
      ) : (
        <div className="space-y-8">
          <Section id="en-progreso" title="En progreso" rows={inProgress} emptyText="No tienes evaluaciones en progreso." now={now} />
          <Section id="pendientes" title="Pendientes" rows={pending} emptyText="Estás al día: no tienes evaluaciones pendientes." now={now} />
          <Section id="completadas" title="Completadas" rows={completed} emptyText="Tus resultados aparecerán aquí cuando finalices una evaluación." now={now} />
          {inactive.length > 0 && <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <summary className="min-h-11 cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">Invitaciones expiradas y canceladas ({inactive.length})</summary>
            <div className="mt-4"><Section title="No disponibles" rows={inactive} now={now} /></div>
          </details>}
        </div>
      )}
      <footer className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
        <Link className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" href="/mis-evaluaciones">Historial de evaluaciones</Link>
        <Link className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" href="/certificaciones">Explorar certificaciones</Link>
      </footer>
    </main>
  );
}

const secondaryAction = "inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900";
type InboxRow = {
  inv: { id: string; sentAt?: Date | null; createdAt?: Date | null };
  attempt: { totalScore?: number | null; startedAt?: Date | null; submittedAt?: Date | null; expiresAt?: Date | null } | null;
  state: UiState; templateTitle: string; companyName: string; jobTitle: string;
  timeLimit: number | null; startUrl: string; resumeUrl: string; resultsUrl: string | null; expiresAtDisplay: Date | null;
};
function DateLabel({ label, value }: { label: string; value?: Date | null }) {
  return <div><dt className="text-xs text-zinc-600 dark:text-zinc-300">{label}</dt><dd className="mt-1 text-sm">
    <AssessmentDateTime value={value} />
  </dd></div>;
}
function Section({ id, title, rows, emptyText, now }: { id?: string; title: string; rows: InboxRow[]; emptyText?: string; now: Date }) {
  return (
    <section id={id} aria-labelledby={id ? id + "-heading" : undefined} className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 id={id ? id + "-heading" : undefined} className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" aria-label={rows.length + " " + title.toLowerCase()}>{rows.length}</span>
      </div>
      {rows.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-600 dark:text-zinc-300 dark:border-zinc-800">{emptyText}</p> :
        <ul className="space-y-3">{rows.map(row => (
          <li key={row.inv.id} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="break-words text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{row.companyName}</p>
                  <span className={"rounded-full border px-2 py-0.5 text-xs font-medium " + statusTone(row.state)}>{statusLabel(row.state)}</span>
                </div>
                <h3 className="break-words text-lg font-semibold leading-6">{row.templateTitle}</h3>
                <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-300">{row.jobTitle}</p>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {row.timeLimit != null && <div><dt className="text-xs text-zinc-600 dark:text-zinc-300">Duración</dt><dd className="mt-1 text-sm">{row.timeLimit} min</dd></div>}
                  {row.state === "PENDING" && <>
                    <DateLabel label={row.inv.sentAt ? "Enviada" : "Asignada"} value={row.inv.sentAt ?? row.inv.createdAt} />
                    <DateLabel label="Vencimiento de invitación" value={row.expiresAtDisplay} />
                  </>}
                  {row.state === "IN_PROGRESS" && <>
                    <DateLabel label="Inicio" value={row.attempt?.startedAt} />
                    {row.attempt?.expiresAt ? <div><dt className="text-xs text-zinc-600 dark:text-zinc-300">Tiempo restante al abrir</dt><dd className="mt-1 text-sm">{Math.max(0, Math.ceil((new Date(row.attempt.expiresAt).getTime() - now.getTime()) / 60000))} min</dd></div> : <div><dt className="text-xs text-zinc-600 dark:text-zinc-300">Límite del intento</dt><dd className="mt-1 text-sm">Sin vencimiento registrado</dd></div>}
                  </>}
                  {row.state === "COMPLETED" && <>
                    <DateLabel label="Finalización" value={row.attempt?.submittedAt} />
                    <div><dt className="text-xs text-zinc-600 dark:text-zinc-300">Calificación</dt><dd className="mt-1 text-lg font-semibold">{row.attempt?.totalScore != null ? row.attempt.totalScore + "%" : "No disponible"}</dd></div>
                  </>}
                  {row.state === "EXPIRED" && <DateLabel label="Vencimiento" value={row.expiresAtDisplay} />}
                </dl>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {row.state === "COMPLETED" ? row.resultsUrl && <Link href={row.resultsUrl} className={secondaryAction}>Ver resultados</Link> :
                  <CandidateAssessmentAction state={row.state} startUrl={row.startUrl} resumeUrl={row.resumeUrl} />}
                {(row.state === "EXPIRED" || row.state === "CANCELLED") && <p className="max-w-xs text-xs leading-5 text-zinc-600 dark:text-zinc-300">Solicita una nueva invitación al reclutador.</p>}
              </div>
            </div>
          </li>
        ))}</ul>}
    </section>
  );
}
