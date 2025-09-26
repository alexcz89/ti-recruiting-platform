// app/dashboard/jobs/[id]/applications/page.tsx
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getSessionCompanyId } from "@/lib/session"
import { notFound } from "next/navigation"

/** Convierte ["Req: Python","Nice: AWS","Req: React"] → mapa { python:true, aws:false, react:true } */
function buildJobSkillMap(jobSkills: string[] | null | undefined) {
  const map = new Map<string, boolean>()
  for (const raw of jobSkills ?? []) {
    const s = String(raw || "").trim()
    if (!s) continue
    let required = false
    let name = s

    // Formatos soportados: "Req: X", "Nice: X", "Required: X", "Deseable: X" (por si acaso)
    const m = s.match(/^(req(uired)?|nice|deseable)\s*:\s*(.+)$/i)
    if (m) {
      const tag = m[1].toLowerCase()
      name = m[3].trim()
      required = tag.startsWith("req")
    }

    const key = name.toLowerCase()
    // Si la misma skill aparece 2 veces, prioriza "required"
    if (!map.has(key) || required) map.set(key, required)
  }
  return map
}

/** Intersección de skills del candidato con las de la vacante, etiquetando required/nice si aplica */
function intersectSkills(
  candidateSkills: string[] | null | undefined,
  jobSkills: string[] | null | undefined,
  limit = 4
) {
  const res: Array<{ name: string; required: boolean }> = []
  if (!candidateSkills?.length) return res

  const jobMap = buildJobSkillMap(jobSkills)
  for (const raw of candidateSkills) {
    const name = String(raw || "").trim()
    if (!name) continue
    const key = name.toLowerCase()
    // si la vacante no trae etiqueta para esa skill, cae como “deseable” (false)
    const required = jobMap.has(key) ? !!jobMap.get(key) : false
    res.push({ name, required })
    if (res.length >= limit) break
  }
  return res
}

export default async function JobApplicationsPage({ params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId().catch(() => null)
  if (!companyId) {
    return (
      <main className="p-6">
        <h2 className="text-lg font-semibold">Postulaciones</h2>
        <p className="mt-2 text-sm text-zinc-500">No hay empresa asociada a tu sesión.</p>
      </main>
    )
  }

  // Validar que la vacante pertenezca a mi empresa
  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: {
      id: true,
      title: true,
      company: { select: { name: true } },
      skills: true, // 👈 necesitamos las etiquetas Req/Nice de la vacante
    },
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
          skills: true, // 👈 lista unificada del candidato
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
                <th className="py-2">Skills (muestra)</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const overlap = intersectSkills(a.candidate?.skills, job.skills, 6) // tomamos hasta 6 y luego mostramos 4+“+n”
                const shown = overlap.slice(0, 4)
                const hiddenCount = Math.max(0, overlap.length - shown.length)

                // ¿Hay mezcla de requeridas y deseables? → activa badge condicional
                const hasReq = shown.some((s) => s.required)
                const hasNice = shown.some((s) => !s.required)
                const mixed = hasReq && hasNice

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
                      {shown.length ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {shown.map((s, i) => {
                            const base =
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                            const requiredCls =
                              "bg-emerald-100 text-emerald-800 border-emerald-300"
                            const niceCls = "bg-zinc-100 text-zinc-700 border-zinc-200"

                            return (
                              <span
                                key={`${s.name}-${i}`}
                                className={`${base} ${s.required ? requiredCls : niceCls}`}
                                title={s.required ? "Obligatoria" : "Deseable"}
                                aria-label={s.required ? "skill obligatoria" : "skill deseable"}
                              >
                                {/* Ícono accesible para requeridos */}
                                {s.required && <span aria-hidden="true">★</span>}
                                {s.name}
                                {/* Badge solo si hay mezcla en el conjunto mostrado */}
                                {mixed && (
                                  <span
                                    className={`ml-1 rounded px-1 text-[10px] ${
                                      s.required
                                        ? "bg-emerald-200 text-emerald-900"
                                        : "bg-zinc-200 text-zinc-800"
                                    }`}
                                  >
                                    {s.required ? "Req" : "Nice"}
                                  </span>
                                )}
                              </span>
                            )
                          })}
                          {hiddenCount > 0 && (
                            <span className="text-[11px] text-zinc-500">+{hiddenCount}</span>
                          )}
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
