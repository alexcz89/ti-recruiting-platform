// app/profile/applications/page.tsx
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Mis postulaciones | Bolsa TI" }

const STATUSES = ["SUBMITTED", "REVIEWING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams?: { status?: string; applied?: string }
}) {
  // 1) Requiere sesión y rol CANDIDATE
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/signin?role=CANDIDATE&callbackUrl=/profile/applications")

  const me = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, role: true, name: true },
  })
  if (!me) redirect("/profile")
  if (me.role !== "CANDIDATE") redirect("/")

  // 2) Filtro opcional por estado
  const status = (searchParams?.status || "").toUpperCase()
  const whereStatus = STATUSES.includes(status as any) ? { status: status as any } : {}

  // 3) Trae mis aplicaciones más recientes
  const apps = await prisma.application.findMany({
    where: {
      candidateId: me.id,
      ...whereStatus,
    },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          location: true,
          employmentType: true,
          seniority: true,
          remote: true,
          company: { select: { name: true } },
        },
      },
    },
    take: 200,
  })

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Avisos de flujo de postulación */}
      {searchParams?.applied === "1" && (
        <div className="border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm rounded-xl px-3 py-2">
          ¡Tu postulación se envió correctamente!
        </div>
      )}
      {searchParams?.applied === "existing" && (
        <div className="border border-amber-300 bg-amber-50 text-amber-800 text-sm rounded-xl px-3 py-2">
          Ya te habías postulado a esta vacante.
        </div>
      )}

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis postulaciones</h1>
          <p className="text-sm text-zinc-600">Hola {me.name ?? "candidato/a"}.</p>
        </div>

        <div className="flex items-center gap-2">
          <a href="/jobs" className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50">
            ← Ver vacantes
          </a>
          <a href="/profile/summary" className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50">
            Ver mi perfil
          </a>
        </div>
      </header>

      {/* Filtro por estado */}
      <form method="GET" className="flex items-end gap-2">
        <div className="grid">
          <label className="text-xs text-zinc-500">Estado</label>
          <select name="status" defaultValue={status} className="border rounded px-2 py-1">
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button className="border rounded px-3 py-1">Filtrar</button>
        <a href="/profile/applications" className="text-sm text-zinc-500 hover:underline">
          Limpiar
        </a>
      </form>

      {/* Lista */}
      {apps.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no tienes postulaciones.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-600">
                <th className="py-2">Vacante</th>
                <th className="py-2">Empresa</th>
                <th className="py-2">Ubicación</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Seniority</th>
                <th className="py-2">Remoto</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2">
                    {a.job ? (
                      <Link href={`/jobs/${a.job.id}`} className="text-blue-600 hover:underline">
                        {a.job.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2">{a.job?.company?.name ?? "—"}</td>
                  <td className="py-2">{a.job?.location ?? "—"}</td>
                  <td className="py-2">{a.job?.employmentType ?? "—"}</td>
                  <td className="py-2">{a.job?.seniority ?? "—"}</td>
                  <td className="py-2">{a.job?.remote ? "Sí" : "No"}</td>
                  <td className="py-2">
                    <span className="inline-block text-[11px] px-2 py-1 rounded-full border bg-gray-50">
                      {a.status}
                    </span>
                  </td>
                  <td className="py-2">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    {a.job && (
                      <Link
                        href={`/jobs/${a.job.id}`}
                        className="border rounded px-2 py-1 hover:bg-gray-50"
                        title="Abrir vacante"
                      >
                        Ver vacante
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
