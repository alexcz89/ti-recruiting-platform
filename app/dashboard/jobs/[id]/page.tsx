// app/dashboard/jobs/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { fromNow } from "@/lib/dates";
import Kanbanboard from "./Kanbanboard";
import { ApplicationInterest } from "@prisma/client";

export const dynamic = "force-dynamic";

// Pipeline del reclutador (ApplicationInterest)
const STATUSES = ["REVIEW", "MAYBE", "ACCEPTED", "REJECTED"] as const;
type ColumnStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<ColumnStatus, string> = {
  REVIEW: "En revisión",
  MAYBE: "En duda",
  ACCEPTED: "Aceptados",
  REJECTED: "Rechazados",
};

export default async function JobKanbanPage({
  params,
}: {
  params: { id: string };
}) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) notFound();

  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
  });
  if (!job) notFound();

  const apps = await prisma.application.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          resumeUrl: true,
          skills: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Server Action: mover tarjeta entre columnas (usa recruiterInterest)
  async function moveApplicationAction(formData: FormData) {
    "use server";

    const companyIdAct = await getSessionCompanyId().catch(() => null);
    if (!companyIdAct) return { ok: false, message: "Empresa no válida" };

    const appId = String(formData.get("appId") || "");
    const newStatus = String(formData.get("newStatus") || "") as ColumnStatus;

    if (!STATUSES.includes(newStatus)) {
      return { ok: false, message: "Estado inválido" };
    }

    const app = await prisma.application.findFirst({
      where: { id: appId, job: { companyId: companyIdAct } },
      select: { id: true },
    });
    if (!app) return { ok: false, message: "Aplicación no encontrada" };

    await prisma.application.update({
      where: { id: appId },
      data: { recruiterInterest: newStatus as ApplicationInterest },
    });

    return { ok: true };
  }

  const employmentType = (job as any)?.employmentType ?? "—";
  const seniority = (job as any)?.seniority ?? "—";
  const remote = (job as any)?.remote ? "Remoto" : "Presencial/Híbrido";
  const updatedAt = (job as any)?.updatedAt ?? job.createdAt;

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-anywhere">
              Kanban — {job.title}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {employmentType} · {seniority} · {remote} ·{" "}
              <span className="text-zinc-500 dark:text-zinc-400">
                Actualizada {fromNow(updatedAt)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/jobs/${job.id}/applications`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-900 dark:border-zinc-700"
              title="Ver lista de postulaciones"
            >
              Ver postulaciones
            </Link>
            <Link
              href={`/dashboard/jobs/${job.id}/edit`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-900 dark:border-zinc-700"
              title="Editar vacante"
            >
              Editar vacante
            </Link>
            <Link
              href="/dashboard/jobs"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-900 dark:border-zinc-700"
            >
              Volver a vacantes
            </Link>
          </div>
        </header>

        {/* Resumen por columnas (usa recruiterInterest) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
          {STATUSES.map((st) => {
            const count = apps.filter(
              (a) => (a.recruiterInterest ?? "REVIEW") === st,
            ).length;
            return (
              <div
                key={st}
                className="rounded-xl border glass-card p-4 md:p-6"
                title={st}
              >
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {STATUS_LABEL[st]}
                </p>
                <p className="text-2xl font-semibold text-default">{count}</p>
              </div>
            );
          })}
          <div className="rounded-xl border glass-card p-4 md:p-6">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Total
            </p>
            <p className="text-2xl font-semibold text-default">
              {apps.length}
            </p>
          </div>
        </section>

        {/* Kanban */}
        <Kanbanboard
          jobId={job.id}
          statuses={STATUSES as unknown as string[]}
          statusLabels={STATUS_LABEL as Record<string, string>}
          applications={apps.map((a) => {
            const candidateName =
              a.candidate?.name ||
              [a.candidate?.firstName, a.candidate?.lastName]
                .filter(Boolean)
                .join(" ") ||
              "—";

            return {
              id: a.id,
              status: (a.recruiterInterest ?? "REVIEW") as string,
              createdAt: a.createdAt,
              candidate: {
                id: a.candidate?.id ?? "",
                name: candidateName,
                email: a.candidate?.email ?? "—",
                resumeUrl: a.candidate?.resumeUrl ?? "",
                skills: (a.candidate as any)?.skills ?? [],
              },
            };
          })}
          moveAction={moveApplicationAction}
        />
      </div>
    </main>
  );
}
