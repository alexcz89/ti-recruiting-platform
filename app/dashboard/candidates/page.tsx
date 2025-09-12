// app/dashboard/candidates/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Candidatos | Panel" };

export default async function CandidatesPage() {
  const users = await prisma.user.findMany({
    where: { role: "CANDIDATE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <main>
      <h2 className="text-lg font-semibold mb-4">Candidatos</h2>
      {users.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay candidatos.</p>
      ) : (
        <div className="overflow-x-auto">
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
      )}
    </main>
  );
}
