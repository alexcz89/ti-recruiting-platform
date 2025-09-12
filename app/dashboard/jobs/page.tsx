// app/dashboard/jobs/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Vacantes | Panel" };

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, company: true, location: true,
      employmentType: true, seniority: true, remote: true,
      createdAt: true, updatedAt: true,
    },
  });

  return (
    <main>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Vacantes</h2>
        <Link href="/dashboard/jobs/new" className="border rounded-xl px-3 py-1 hover:bg-gray-50">
          Nueva vacante
        </Link>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay vacantes registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-600">
                <th className="py-2">Título</th>
                <th className="py-2">Empresa</th>
                <th className="py-2">Ubicación</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Seniority</th>
                <th className="py-2">Remoto</th>
                <th className="py-2">Actualizado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="border-t">
                  <td className="py-2">{j.title}</td>
                  <td className="py-2">{j.company}</td>
                  <td className="py-2">{j.location}</td>
                  <td className="py-2">{j.employmentType}</td>
                  <td className="py-2">{j.seniority}</td>
                  <td className="py-2">{j.remote ? "Sí" : "No"}</td>
                  <td className="py-2">{new Date(j.updatedAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    <Link href={`/dashboard/jobs/${j.id}/edit`} className="border rounded px-2 py-1 hover:bg-gray-50">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
