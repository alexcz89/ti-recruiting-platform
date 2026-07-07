// app/dashboard/candidates/page.tsx
import Link from "next/link";
import { prisma } from '@/lib/server/prisma';
import { badgeLevelLabel } from "@/lib/badges";
import { Award } from "lucide-react";

export const metadata = { title: "Candidatos | Panel" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: { page?: string; verified?: string };
}) {
  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const onlyVerified = searchParams.verified === "1";
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where = {
    role: "CANDIDATE" as const,
    ...(onlyVerified ? { candidateBadges: { some: {} } } : {}),
  };

  // Batch queries in parallel
  const [users, totalCandidates] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        candidateBadges: {
          orderBy: [{ level: "desc" }, { earnedAt: "desc" }],
          take: 4,
          select: {
            level: true,
            term: { select: { label: true } },
          },
        },
      },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCandidates / PAGE_SIZE);
  const baseQS = onlyVerified ? "&verified=1" : "";

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold mb-2">Candidatos</h2>
          <p className="text-xs text-zinc-500">
            Total: {totalCandidates} candidatos ({totalPages} páginas)
          </p>
        </div>
        <Link
          href={onlyVerified ? "/dashboard/candidates" : "/dashboard/candidates?verified=1"}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            onlyVerified
              ? "border-teal-600 bg-teal-600 text-white hover:bg-teal-700"
              : "border-zinc-300 text-zinc-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-teal-700 dark:hover:bg-teal-900/20 dark:hover:text-teal-300"
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          {onlyVerified ? "Mostrando solo verificados" : "Solo skills verificados"}
        </Link>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {onlyVerified
            ? "Ningún candidato tiene badges verificados todavía."
            : "Aún no hay candidatos."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600">
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Badges verificados</th>
                  <th className="py-2">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/dashboard/candidates/${u.id}`}
                        className="text-teal-600 hover:underline dark:text-teal-400"
                      >
                        {u.name || "—"}
                      </Link>
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">
                      {u.candidateBadges.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {u.candidateBadges.map((b, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-0.5 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                            >
                              ✓ {b.term.label} · {badgeLevelLabel(b.level)}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
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
                    href={`/dashboard/candidates?page=${currentPage - 1}${baseQS}`}
                    className="px-3 py-2 text-xs font-medium rounded border border-zinc-300 hover:bg-zinc-100 transition"
                  >
                    ← Anterior
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/dashboard/candidates?page=${currentPage + 1}${baseQS}`}
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
