import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Resumen de mi perfil | Bolsa TI" };

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-xs bg-gray-100 px-2 py-1 rounded">{children}</span>;
}

export default async function ProfileSummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile/summary");

  const userEmail = session.user?.email!;
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });
  if (!user) notFound();

  const Section = ({ title, items }: { title: string; items?: string[] }) =>
    items && items.length > 0 ? (
      <div>
        <h3 className="font-medium mb-2">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <Pill key={it}>{it}</Pill>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Resumen de mi perfil</h1>

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
            {user.linkedin ? (
              <a href={user.linkedin} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                ver perfil
              </a>
            ) : (
              "—"
            )}
          </p>
          <p>
            <span className="text-zinc-500 text-sm">GitHub:</span>{" "}
            {user.github ? (
              <a href={user.github} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                ver perfil
              </a>
            ) : (
              "—"
            )}
          </p>
          <p>
            <span className="text-zinc-500 text-sm">CV:</span>{" "}
            {user.resumeUrl ? (
              <a href={user.resumeUrl} target="_blank" className="text-blue-600 hover:underline" rel="noreferrer">
                Ver / Descargar
              </a>
            ) : (
              "—"
            )}
          </p>
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
            {user.certifications.map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sin certificaciones registradas.</p>
        )}
      </section>

      <div className="pt-4">
        <a href="/profile" className="border rounded-xl px-4 py-2 inline-block">Editar mi perfil</a>
      </div>
    </main>
  );
}
