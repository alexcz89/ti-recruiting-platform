// app/dashboard/candidates/pending/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { ArrowRight, Users } from "lucide-react";

export const metadata = { title: "Candidatos por revisar | Panel" };

export default async function PendingCandidatesPage() {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No hay empresa asociada a tu sesión.</p>
        </div>
      </main>
    );
  }

  // Get pending applications (where recruiterInterest is not yet reviewed)
  const pendingApps = await prisma.application.findMany({
    where: {
      job: { companyId },
      recruiterInterest: { notIn: ["MAYBE", "ACCEPTED", "REJECTED"] },
    },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      job: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-10 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              Candidatos por revisar
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {pendingApps.length} {pendingApps.length === 1 ? "candidato" : "candidatos"} esperando tu revisión
            </p>
          </div>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            ← Volver a vacantes
          </Link>
        </div>

        {/* List or Empty State */}
        {pendingApps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 p-10 text-center">
            <Users className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-base font-bold text-zinc-800 dark:text-zinc-100">
              ¡Sin candidatos por revisar!
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Has revisado todos los candidatos. Excelente trabajo.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 w-[30%]">Candidato</th>
                    <th className="py-3 px-4 w-[35%]">Vacante</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pendingApps.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="py-3 px-4">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {app.candidate.name}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/jobs/${app.job.id}/applications`}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {app.job.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs break-all">
                          {app.candidate.email}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/jobs/${app.job.id}/applications`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition"
                        >
                          Revisar
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
