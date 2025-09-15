// app/dashboard/applications/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

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

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: { status?: string; jobId?: string };
}) {
  // Guard de sesión/rol
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/applications");

  const meEmail = session.user?.email!;
  const me = await prisma.user.findUnique({
    where: { email: meEmail },
    select: { id: true, role: true },
  });
  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) redirect("/");

  // Filtros GET
  const status = (searchParams?.status as string) || "";
  const jobId = (searchParams?.jobId as string) || "";

  // Jobs del recruiter para el select
  const myJobs = await prisma.job.findMany({
    where: { recruiterId: me.id },
    select: { id: true, title: true, company: true },
    orderBy: { createdAt: "desc" },
  });

  // Postulaciones filtradas (SIEMPRE limitadas a sus jobs)
  const apps = await prisma.application.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(jobId ? { jobId } : {}),
      job: { recruiterId: me.id },
    },
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, title: true, company: true } },
      candidate: {
        select: {
          id: true,
          email: true,
          name: true,
          resumeUrl: true,
          phone: true, // para WhatsApp
        },
      },
    },
    take: 200,
  });

  return (
    <main>
      <h2 className="text-lg font-semibold mb-4">Postulaciones</h2>

      {/* Filtros */}
      <form method="GET" className="mb-4 flex items-end gap-2">
        <div className="grid">
          <label className="text-xs text-zinc-500">Vacante</label>
          <select name="jobId" defaultValue={jobId} className="border rounded px-2 py-1">
            <option value="">Todas</option>
            {myJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} — {j.company}
              </option>
            ))}
          </select>
        </div>

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
        <a href="/dashboard/applications" className="text-sm text-zinc-500 hover:underline">
          Limpiar
        </a>
      </form>

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
              {apps.map((a) => {
                const waHref = a.candidate?.phone
                  ? `https://wa.me/${a.candidate.phone.replace(/^\+/, "")}?text=${encodeURIComponent(
                      `Hola ${a.candidate?.name ?? ""}, te contacto de ${a.job?.company} por la vacante "${a.job?.title}".`
                    )}`
                  : null;

                return (
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
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Actualizar estado */}
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

                        {/* WhatsApp */}
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="border rounded px-2 py-1"
                            title={`Enviar WhatsApp: ${a.candidate?.phone}`}
                          >
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-400">Sin teléfono</span>
                        )}

                        {/* Mensajes */}
                        <a
                          className="border rounded px-2 py-1"
                          href={`/dashboard/messages?applicationId=${a.id}`}
                          title="Abrir mensajes"
                        >
                          Mensajes
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
