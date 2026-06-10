// app/dashboard/candidates/page.tsx
import Link from "next/link";
import { prisma } from '@/lib/server/prisma';

export const metadata = { title: "Candidatos | Panel" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const skip = (currentPage - 1) * PAGE_SIZE;

  // Batch queries in parallel
  const [users, totalCandidates] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CANDIDATE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.user.count({
      where: { role: "CANDIDATE" },
    }),
  ]);

  const totalPages = Math.ceil(totalCandidates / PAGE_SIZE);

  return (
    <main>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Candidatos</h2>
        <p className="text-xs text-zinc-500">
          Total: {totalCandidates} candidatos ({totalPages} páginas)
        </p>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay candidatos.</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600">
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/dashboard/candidates/${u.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {u.name || "—"}
                      </Link>
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-zinc-600">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/dashboard/candidates?page=${currentPage - 1}`}
                    className="px-3 py-2 text-xs font-medium rounded border border-zinc-300 hover:bg-zinc-100 transition"
                  >
                    ← Anterior
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/dashboard/candidates?page=${currentPage + 1}`}
                    className="px-3 py-2 text-xs font-medium rounded border border-zinc-300 hover:bg-zinc-100 transition"
                  >
                    Siguiente →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
