// app/dashboard/candidates/[id]/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const metadata = { title: "Perfil de candidato | Panel" };

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-xs bg-gray-100 px-2 py-1 rounded">{children}</span>;
}

// Estados permitidos (enum ApplicationStatus)
const STATUSES = ["SUBMITTED", "REVIEWING", "INTERVIEW", "OFFER", "REJECTED"] as const;

export default async function CandidateProfile({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard/candidates/${params.id}`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, phone: true, location: true, birthdate: true,
      linkedin: true, github: true, resumeUrl: true, // <-- necesario para “Descargar CV”
      frontend: true, backend: true, mobile: true, cloud: true, database: true,
      cybersecurity: true, testing: true, ai: true,
      certifications: true, createdAt: true,
    },
  });
  if (!user) notFound();

  const apps = await prisma.application.findMany({
    where: { candidateId: params.id },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { title: true, company: true } } },
  });

  // Server Action: actualizar estado de la postulación
  async function updateStatusAction(formData: FormData) {
    "use server";
    const appId = String(formData.get("appId") || "");
    const status = String(formData.get("status") || "");
    if (!appId || !STATUSES.includes(status as any)) return;

    await prisma.application.update({
      where: { id: appId },
      data: { status: status as any },
    });

    // refresca esta página
    revalidatePath(`/dashboard/candidates/${params.id}`);
  }

  function Section({ title, items }: { title: string; items: string[] }) {
    if (!items?.length) return null;
    return (
      <div>
        <h3 className="font-medium mb-2">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {items.map((s) => <Pill key={s}>{s}</Pill>)}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Perfil de candidato</h1>
        <Link href="/dashboard/candidates" className="text-sm text-zinc-600 hover:underline">← Volver</Link>
      </div>

      {/* Datos básicos */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p><span className="text-zinc-500 text-sm">Nombre:</span> {user.name || "—"}</p>
          <p><span className="text-zinc-500 text-sm">Email:</span> {user.email}</p>
          <p><span className="text-zinc-500 text-sm">Teléfono:</span> {user.phone || "—"}</p>
          <p><span className="text-zinc-500 text-sm">Ubicación:</span> {user.location || "—"}</p>
          <p><span className="text-zinc-500 text-sm">Nacimiento:</span> {user.birthdate ? new Date(user.birthdate).toLocaleDateString() : "—"}</p>
        </div>
        <div className="space-y-2">
          <p>
            <span className="text-zinc-500 text-sm">LinkedIn:</span>{" "}
            {user.linkedin ? <a href={user.linkedin} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">ver perfil</a> : "—"}
          </p>
          <p>
            <span className="text-zinc-500 text-sm">GitHub:</span>{" "}
            {user.github ? <a href={user.github} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">ver perfil</a> : "—"}
          </p>
          <p>
            <span className="text-zinc-500 text-sm">CV:</span>{" "}
            {user.resumeUrl ? (
              <a href={user.resumeUrl} target="_blank" className="text-blue-600 hover:underline" rel="noreferrer">
                Descargar CV
              </a>
            ) : (
              "—"
            )}
          </p>
          <p className="text-xs text-zinc-500">Miembro desde {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </section>

      {/* Skills por categoría */}
      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Skills</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Frontend" items={user.frontend} />
          <Section title="Backend" items={user.backend} />
          <Section title="Móviles" items={user.mobile} />
          <Section title="Cloud" items={user.cloud} />
          <Section title="Bases de datos" items={user.database} />
          <Section title="Ciberseguridad" items={user.cybersecurity} />
          <Section title="Testing / QA" items={user.testing} />
          <Section title="IA / ML" items={user.ai} />
        </div>
      </section>

      {/* Certificaciones */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Certificaciones</h2>
        {user.certifications?.length ? (
          <div className="flex flex-wrap gap-2">
            {user.certifications.map((c) => <Pill key={c}>{c}</Pill>)}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sin certificaciones registradas.</p>
        )}
      </section>

      {/* Postulaciones con cambio de estado inline */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Postulaciones</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no se ha postulado a ninguna vacante.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600">
                  <th className="py-2">Vacante</th>
                  <th className="py-2">Empresa</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2">{a.job?.title}</td>
                    <td className="py-2">{a.job?.company}</td>
                    <td className="py-2">{a.status}</td>
                    <td className="py-2">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <form action={updateStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="appId" value={a.id} />
                        <select name="status" defaultValue={a.status} className="border rounded px-2 py-1">
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
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
      </section>
    </main>
  );
}
