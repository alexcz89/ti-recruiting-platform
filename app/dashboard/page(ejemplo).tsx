import { prisma } from "@/lib/prisma";

export default async function DashboardHome() {
  const [jobsCount, appsCount, candidatesCount, publishedCodex] = await Promise.all([
    prisma.job.count(),
    prisma.application.count(),
    prisma.user.count({ where: { role: "CANDIDATE" } }),
    prisma.codexEntry.count({ where: { published: true } }),
  ]);

  return (
    <main className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Vacantes" value={jobsCount} />
        <Card title="Postulaciones" value={appsCount} />
        <Card title="Candidatos" value={candidatesCount} />
        <Card title="Artículos (Codex)" value={publishedCodex} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Últimas 5 postulaciones</h2>
        <RecentApplications />
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="border rounded-2xl p-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

async function RecentApplications() {
  const rows = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      job: { select: { title: true, company: true } },
      candidate: { select: { email: true, name: true } },
    },
  });

  if (rows.length === 0) return <p className="text-sm text-zinc-500">Aún no hay postulaciones.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-600">
            <th className="py-2">Candidato</th>
            <th className="py-2">Email</th>
            <th className="py-2">Vacante</th>
            <th className="py-2">Empresa</th>
            <th className="py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2">{a.candidate?.name || "—"}</td>
              <td className="py-2">{a.candidate?.email}</td>
              <td className="py-2">{a.job?.title}</td>
              <td className="py-2">{a.job?.company}</td>
              <td className="py-2">{new Date(a.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
