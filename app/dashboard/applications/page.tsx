// app/dashboard/applications/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Estados permitidos (coinciden con tu enum)
const STATUSES = ["SUBMITTED", "REVIEWING", "INTERVIEW", "OFFER", "REJECTED"] as const;

export const metadata = { title: "Postulaciones | Panel" };

// Server Action: actualizar estado desde el listado
async function updateStatusAction(formData: FormData) {
  "use server";
  const appId = String(formData.get("appId") || "");
  const status = String(formData.get("status") || "");
  if (!appId || !STATUSES.includes(status as any)) return;

  await prisma.application.update({
    where: { id: appId },
    data: { status: status as any },
  });

  revalidatePath("/dashboard/applications");
}

export default async function ApplicationsPage() {
  const apps = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { title: true, company: true } },
      candidate: {
        select: { id: true, email: true, name: true, resumeUrl: true }, // ⬅️ agregar resumeUrl
      },
    },
  });

  return (
    <main>
      <h2 className="text-lg font-semibold mb-4">Postulaciones</h2>

      {apps.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay postulaciones.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-600">
                <th className="py-2">Candidato</th>
                <th className="py-2">Email</th>
                <th className="py-2">Vacante</th>
                <th className="py-2">Empresa</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">CV</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2">
                    {a.candidate ? (
                      <Link
                        href={`/dashboard/candidates/${a.candidate.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {a.candidate.name || "—"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2">{a.candidate?.email}</td>
                  <td className="py-2">{a.job?.title}</td>
                  <td className="py-2">{a.job?.company}</td>
                  <td className="py-2">{a.status}</td>
                  <td className="py-2">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    {a.candidate?.resumeUrl ? (
                      <a
                        href={a.candidate.resumeUrl}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                        rel="noreferrer"
                      >
                        Descargar CV
                      </a>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <form action={updateStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="appId" value={a.id} />
                      <select name="status" defaultValue={a.status} className="border rounded px-2 py-1">
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button className="border rounded px-2 py-1">Actualizar</button>
                    </form>
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
