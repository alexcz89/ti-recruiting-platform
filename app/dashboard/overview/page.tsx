// app/dashboard/overview/page.tsx
import { prisma } from "@/lib/prisma"
import { getSessionCompanyId } from "@/lib/session"

export default async function OverviewPage() {
  const companyId = await getSessionCompanyId().catch(() => null)
  if (!companyId) {
    return (
      <main className="p-6">
        <h1 className="text-lg font-semibold mb-2">Overview</h1>
        <p className="text-sm text-zinc-500">No hay empresa asociada a tu sesión.</p>
      </main>
    )
  }

  // KPIs
  const [openJobs, appsTotal, apps7d, candidates] = await Promise.all([
    prisma.job.count({ where: { companyId } }),
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({
      where: { job: { companyId }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.user.count({ where: { role: "CANDIDATE" } }),
  ])

  // Últimas 5 postulaciones
  const recent = await prisma.application.findMany({
    where: { job: { companyId } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      job: { select: { title: true, company: { select: { name: true } } } },
      candidate: { select: { name: true, email: true } },
    },
  })

  return (
    <main className="space-y-8 p-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Vacantes abiertas" value={openJobs} />
        <Card title="Postulaciones totales" value={appsTotal} />
        <Card title="Postulaciones últimos 7 días" value={apps7d} />
        <Card title="Candidatos registrados" value={candidates} />
      </section>

      {/* Últimas postulaciones */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Últimas 5 postulaciones</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay postulaciones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr className="text-left text-zinc-600">
                  <th className="py-2 px-3">Candidato</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Vacante</th>
                  <th className="py-2 px-3">Empresa</th>
                  <th className="py-2 px-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 px-3">{r.candidate?.name ?? "—"}</td>
                    <td className="py-2 px-3">{r.candidate?.email ?? "—"}</td>
                    <td className="py-2 px-3">{r.job?.title ?? "—"}</td>
                    <td className="py-2 px-3">{r.job?.company?.name ?? "—"}</td>
                    <td className="py-2 px-3">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
