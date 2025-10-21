// app/dashboard/jobs/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { fromNow } from "@/lib/dates";
import Kanbanboard from "./Kanbanboard";

export const dynamic = "force-dynamic";

const STATUSES = [
  "SUBMITTED",
  "REVIEW",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;
type AppStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<AppStatus, string> = {
  SUBMITTED: "Recibidas",
  REVIEW: "En revisión",
  INTERVIEW: "Entrevista",
  OFFER: "Oferta",
  HIRED: "Contratado",
  REJECTED: "Rechazado",
};

export default async function JobKanbanPage({ params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) notFound();

  // ❗️Fix: quitamos `select` para no pedir campos que quizá no existen (ej. seniority)
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
        },
      },
    },
  });

  async function moveApplicationAction(formData: FormData) {
    "use server";
    const companyIdAct = await getSessionCompanyId().catch(() => null);
    if (!companyIdAct) return { ok: false, message: "Empresa no válida" };

    const appId = String(formData.get("appId") || "");
    const newStatus = String(formData.get("newStatus") || "") as AppStatus;

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
      data: { status: newStatus },
    });

    return { ok: true };
  }

  const employmentType = (job as any)?.employmentType ?? "—";
  const seniority = (job as any)?.seniority ?? "—"; // si no existe en tu schema quedará "—"
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
            <p className="text-sm text-zinc-600">
              {employmentType} · {seniority} · {remote} ·{" "}
              <span className="text-zinc-500">Actualizada {fromNow(updatedAt)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/jobs/${job.id}/applications`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              title="Ver lista de postulaciones"
            >
              Ver postulaciones
            </Link>
            <Link
              href={`/dashboard/jobs/${job.id}/edit`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              title="Editar vacante"
            >
              Editar vacante
            </Link>
            <Link
              href="/dashboard/jobs"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Volver a vacantes
            </Link>
          </div>
        </header>

        {/* Resumen */}
        <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
          {STATUSES.map((st) => {
            const count = apps.filter((a) => a.status === st).length;
            return (
              <div
                key={st}
                className="rounded-xl border bg-white/90 p-3 text-center"
                title={st}
              >
                <p className="text-[11px] text-zinc-500">{STATUS_LABEL[st]}</p>
                <p className="text-2xl font-semibold">{count}</p>
              </div>
            );
          })}
          <div className="rounded-xl border bg-white/90 p-3 text-center">
            <p className="text-[11px] text-zinc-500">Total</p>
            <p className="text-2xl font-semibold">{apps.length}</p>
          </div>
        </section>

        {/* Kanban */}
        <Kanbanboard
          jobId={job.id}
          statuses={STATUSES as unknown as string[]}
          statusLabels={STATUS_LABEL as Record<string, string>}
          applications={apps.map((a) => ({
            id: a.id,
            status: a.status,
            createdAt: a.createdAt,
            candidate: {
              id: a.candidate?.id ?? "",
              name: a.candidate?.name ?? "—",
              email: a.candidate?.email ?? "—",
              resumeUrl: a.candidate?.resumeUrl ?? "",
              skills: a.candidate?.skills ?? [],
            },
          }))}
          moveAction={moveApplicationAction}
        />
      </div>
    </main>
  );
}
