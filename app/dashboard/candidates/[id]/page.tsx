// app/dashboard/candidates/[id]/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const metadata = { title: "Candidato | Panel" }

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { applicationId?: string; jobId?: string }
}) {
  // 1) Guard sesión/rol
  const session = await getServerSession(authOptions)
  if (!session) redirect("/signin?callbackUrl=/dashboard/candidates")

  // Reclutador/Admin + obtener companyId del reclutador para multi-tenant
  const me = await prisma.user.findUnique({
    where: { email: session.user?.email! },
    select: { id: true, role: true, companyId: true },
  })
  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) {
    redirect("/")
  }
  const companyId = me.companyId ?? null

  // 2) Candidato (solo campos vigentes)
  const candidate = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      role: true,
      skills: true,          // ← unificado
      certifications: true,
    },
  })
  if (!candidate) notFound()
  if (candidate.role !== "CANDIDATE") redirect("/dashboard")

  // 3) Postulaciones del candidato SOLO a vacantes de MI EMPRESA
  const myApps = companyId
    ? await prisma.application.findMany({
        where: {
          candidateId: candidate.id,
          job: { companyId }, // filtro multi-tenant por empresa
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          job: { select: { id: true, title: true, company: { select: { name: true } } } },
        },
        take: 10,
      })
    : []

  // (Opcional) Si viene un applicationId en la URL, valida que pertenece a MI EMPRESA
  const activeAppId = searchParams?.applicationId || ""
  const activeApp = activeAppId
    ? await prisma.application.findFirst({
        where: { id: activeAppId, job: { companyId: companyId ?? "" } },
        select: { id: true },
      })
    : null

  // Para botones de regreso desde job
  const fromJobId = searchParams?.jobId

  // UI helpers
  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block text-xs bg-gray-100 rounded-full px-2 py-1 mr-2 mb-2">
      {children}
    </span>
  )
  const List = ({ items }: { items?: string[] | null }) =>
    items && items.length ? (
      <div className="mt-2">
        {items.map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
      </div>
    ) : (
      <p className="text-sm text-zinc-500">—</p>
    )

  const waHref = candidate.phone
    ? `https://wa.me/${candidate.phone.replace(/^\+/, "")}?text=${encodeURIComponent(
        `Hola ${candidate.name ?? ""}, te contacto por una oportunidad laboral.`
      )}`
    : null

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidato</h1>
          <p className="text-sm text-zinc-600">
            {candidate.name ?? "—"} · {candidate.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fromJobId && (
            <>
              <Link
                href={`/dashboard/jobs/${fromJobId}/applications`}
                className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
              >
                ← Volver a la vacante
              </Link>
              <Link
                href={`/dashboard/jobs/${fromJobId}`}
                className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                title="Abrir Kanban"
              >
                Ver Kanban
              </Link>
            </>
          )}

          {candidate.resumeUrl ? (
            <a
              href={candidate.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="border rounded px-3 py-1 text-sm"
              title="Ver/descargar CV"
            >
              Descargar CV
            </a>
          ) : (
            <span className="text-xs text-zinc-400">Sin CV</span>
          )}

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="border rounded px-3 py-1 text-sm"
              title={`WhatsApp: ${candidate.phone}`}
            >
              WhatsApp
            </a>
          ) : (
            <span className="text-xs text-zinc-400">Sin teléfono</span>
          )}

          {activeApp?.id ? (
            <a
              href={`/dashboard/messages?applicationId=${activeApp.id}`}
              className="border rounded px-3 py-1 text-sm"
              title="Abrir mensajes de esta postulación"
            >
              Abrir mensajes
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna principal (datos del candidato) */}
        <section className="lg:col-span-2 space-y-6">
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold">Información</h2>
            <div className="mt-2 text-sm space-y-1">
              <div>Nombre: {candidate.name ?? "—"}</div>
              <div>Email: {candidate.email}</div>
              <div>Teléfono: {candidate.phone ?? "—"}</div>
              <div>Ubicación: {candidate.location ?? "—"}</div>
              <div>
                Fecha de nacimiento:{" "}
                {candidate.birthdate
                  ? new Date(candidate.birthdate).toLocaleDateString()
                  : "—"}
              </div>
              <div>
                LinkedIn:{" "}
                {candidate.linkedin ? (
                  <a
                    className="text-blue-600 hover:underline"
                    href={candidate.linkedin}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {candidate.linkedin}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div>
                GitHub:{" "}
                {candidate.github ? (
                  <a
                    className="text-blue-600 hover:underline"
                    href={candidate.github}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {candidate.github}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-4">
            <h2 className="font-semibold">Certificaciones</h2>
            <List items={candidate.certifications} />
          </div>

          <div className="border rounded-xl p-4">
            <h2 className="font-semibold">Skills</h2>
            <List items={candidate.skills} />
          </div>
        </section>

        {/* Panel lateral: Solo postulaciones de MI empresa */}
        <aside className="border rounded-xl p-4 h-fit">
          <h3 className="font-semibold mb-3">Postulaciones recientes (mi empresa)</h3>
          {myApps.length === 0 ? (
            <p className="text-sm text-zinc-500">—</p>
          ) : (
            <ul className="space-y-3">
              {myApps.map((a) => (
                <li key={a.id} className="border rounded-lg p-3">
                  <div className="text-sm font-medium">
                    {a.job?.title} — {a.job?.company?.name ?? "—"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Estado: {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={`/dashboard/messages?applicationId=${a.id}`}
                      className="border rounded px-2 py-1 text-xs"
                      title="Abrir mensajes"
                    >
                      Mensajes
                    </a>
                    <Link
                      href={`/dashboard/jobs/${a.job?.id}/applications`}
                      className="border rounded px-2 py-1 text-xs hover:bg-gray-50"
                      title="Ver postulaciones de esta vacante"
                    >
                      Ver vacante
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Fallback de regreso cuando no venimos desde job */}
      {!fromJobId && (
        <div>
          <Link href="/dashboard/jobs" className="text-sm text-blue-600 hover:underline">
            ← Volver a vacantes
          </Link>
        </div>
      )}
    </main>
  )
}
