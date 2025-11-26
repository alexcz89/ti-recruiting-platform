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
          job: {
            select: {
              id: true,
              title: true,
              skills: true, // 👈 necesitamos los skills de la vacante para saber cuáles son "Req"
              company: { select: { name: true } },
            },
          },
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
  const Pill = ({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) => (
    <span
      className={
        highlight
          ? "inline-block text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5 mr-2 mb-2"
          : "inline-block text-[11px] bg-gray-50 text-zinc-700 border rounded-full px-2 py-0.5 mr-2 mb-2"
      }
    >
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

  // Helper simple para PDFs
  const pdfSrc = candidate.resumeUrl
    ? `${candidate.resumeUrl}${candidate.resumeUrl.includes("#") ? "" : "#toolbar=1&navpanes=0&scrollbar=1"}`
    : null

  // Helper: calcula snapshot de hasta 4 skills priorizando matches REQUERIDOS (Req: <skill>)
  function buildRequiredSnapshot(jobSkills: string[] | null | undefined, candSkills: string[] | null | undefined) {
    const reqNames = new Set(
      (jobSkills || [])
        .filter(s => s.toLowerCase().startsWith("req:"))
        .map(s => s.slice(4).trim().toLowerCase())
        .filter(Boolean)
    )
    const cand = (candSkills || [])

    // matches (requeridos ∩ candidato), preserva casing del candidato
    const matches: string[] = []
    const seen = new Set<string>()
    for (const s of cand) {
      const key = s.toLowerCase()
      if (!seen.has(key) && reqNames.has(key)) {
        matches.push(s)
        seen.add(key)
      }
    }

    // si faltan hasta 4, completa con otros skills del candidato (no requeridos)
    const others: string[] = []
    for (const s of cand) {
      const key = s.toLowerCase()
      if (!seen.has(key)) {
        others.push(s)
        seen.add(key)
      }
      if (matches.length + others.length >= 4) break
    }

    return { matches: matches.slice(0, 4), others: others.slice(0, Math.max(0, 4 - matches.length)) }
  }

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
                title="Abrir Pipeline"
              >
                Ver Pipeline
              </Link>

              {/* 👇 Nuevo botón: ver vacante como la ve el candidato */}
              <Link
                href={`/jobs/${fromJobId}`}
                target="_blank" 
                className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                title="Ver Vacante como candidato"
              >
                Ver Vacante
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

          {/* 🔎 Preview embebido del CV */}
          {candidate.resumeUrl && (
            <div className="border rounded-xl p-4">
              <h2 className="font-semibold">CV</h2>
              <div className="mt-3 overflow-hidden rounded-lg border bg-gray-50">
                <div className="relative w-full" style={{ height: "70vh" }}>
                  <iframe
                    src={pdfSrc!}
                    title="Vista previa del CV"
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={candidate.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Abrir en nueva pestaña
                </a>
                <a
                  href={candidate.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Descargar
                </a>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Si el visor no carga, el sitio del CV podría bloquear la inserción. Usa “Abrir en nueva pestaña”.
              </p>
            </div>
          )}

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
              {myApps.map((a) => {
                // Construir snapshot priorizando skills requeridos que el candidato sí tiene
                const { matches, others } = buildRequiredSnapshot(a.job?.skills, candidate.skills)
                const show = [...matches, ...others].slice(0, 4)

                return (
                  <li key={a.id} className="border rounded-lg p-3">
                    <div className="text-sm font-medium">
                      {a.job?.title} — {a.job?.company?.name ?? "—"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Estado: {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                    </div>

                    {/* 👇 Snapshot: requeridos (match) resaltados */}
                    {show.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {show.map((s) => (
                          <Pill key={s} highlight={matches.includes(s)}>
                            {s}
                          </Pill>
                        ))}
                      </div>
                    )}

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
                )
              })}
            </ul>
          )}
        </aside>
      </div>

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
