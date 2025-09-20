// app/dashboard/jobs/[id]/applications/page.tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getSessionCompanyId } from "@/lib/session"
import { notFound } from "next/navigation"

export default async function JobApplicationsPage({ params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId().catch(() => null)
  if (!companyId) {
    return (
      <main className="p-6">
        <h2 className="text-lg font-semibold">Postulaciones</h2>
        <p className="text-sm text-zinc-500 mt-2">No hay empresa asociada a tu sesión.</p>
      </main>
    )
  }

  // Validar que la vacante pertenezca a mi empresa
  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: { id: true, title: true, company: { select: { name: true } } },
  })
  if (!job) notFound()

  const apps = await prisma.application.findMany({
    where: { jobId: job.id, job: { companyId } },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          resumeUrl: true,
          phone: true,
          // ✅ usar la lista unificada
          skills: true,
          // Si necesitas mostrar más info del candidato, agrégala aquí
          // location: true,
          // linkedin: true,
          // github: true,
        },
      },
    },
  })

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Candidatos — {job.title}</h1>
          <p className="text-sm text-zinc-500">{job.company?.name ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/jobs/${job.id}`} className="border rounded px-3 py-1 hover:bg-gray-50">
            Ver Kanban
          </Link>
          <Link href="/dashboard/jobs" className="border rounded px-3 py-1 hover:bg-gray-50">
            Volver a Vacantes
          </Link>
        </div>
      </div>

      {apps.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay postulaciones para esta vacante.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-600">
                <th className="py-2">Candidato</th>
                <th className="py-2">Email</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Skills</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const skillSample = (a.candidate.skills || []).slice(0, 4)
                const candidateHref = `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`

                return (
                  <tr key={a.id} className="border-t">
                    <td className="py-2">
                      <Link
                        href={candidateHref}
                        className="underline underline-offset-2 hover:opacity-80"
                        title="Ver detalle del candidato"
                      >
                        {a.candidate?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2">{a.candidate?.email ?? "—"}</td>
                    <td className="py-2">{a.status}</td>
                    <td className="py-2">
                      {skillSample.length ? (
                        <div className="flex flex-wrap gap-1">
                          {skillSample.map((s, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-gray-50 border">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="py-2 flex gap-2">
                      {a.candidate?.resumeUrl && (
                        <a
                          href={a.candidate.resumeUrl}
                          target="_blank"
                          className="border rounded px-2 py-1 hover:bg-gray-50"
                        >
                          Ver CV
                        </a>
                      )}
                      <Link href={candidateHref} className="border rounded px-2 py-1 hover:bg-gray-50">
                        Detalle
                      </Link>
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="border rounded px-2 py-1 hover:bg-gray-50"
                        title="Abrir en Kanban"
                      >
                        Kanban
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
