// app/jobs/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Vacantes | Bolsa TI" };

export default async function PublicJobsPage() {
  const jobs = await prisma.job.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      employmentType: true,
      seniority: true,
      remote: true,
      updatedAt: true,
    },
  });

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Vacantes</h1>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay vacantes disponibles por ahora.</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <li key={j.id} className="border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/jobs/${j.id}`} className="text-lg font-semibold hover:underline">
                    {j.title}
                  </Link>
                  <p className="text-sm text-zinc-600 mt-1">
                    {j.company} — {j.location} · {j.employmentType} · {j.seniority} ·{" "}
                    {j.remote ? "Remoto" : "Presencial"}
                  </p>
                </div>
                <time className="text-xs text-zinc-500 whitespace-nowrap">
                  {new Date(j.updatedAt).toLocaleDateString()}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
