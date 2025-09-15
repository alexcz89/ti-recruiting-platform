// app/profile/summary/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Resumen de perfil | Bolsa TI" };

export default async function ProfileSummaryPage({
  searchParams,
}: {
  searchParams?: { updated?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile/summary");

  const meEmail = session.user?.email!;
  const me = await prisma.user.findUnique({
    where: { email: meEmail },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      frontend: true,
      backend: true,
      mobile: true,
      cloud: true,
      database: true,
      cybersecurity: true,
      testing: true,
      ai: true,
      certifications: true,
    },
  });

  if (!me) redirect("/profile"); // crea el perfil primero
  if (me.role !== "CANDIDATE") redirect("/dashboard");

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block text-xs bg-gray-100 rounded-full px-2 py-1 mr-2 mb-2">
      {children}
    </span>
  );

  const List = ({ items }: { items?: string[] | null }) =>
    items && items.length ? (
      <div className="mt-2">
        {items.map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
      </div>
    ) : (
      <p className="text-sm text-zinc-500">—</p>
    );

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Banner opcional si vienes de guardar con ?updated=1 */}
      {searchParams?.updated === "1" && (
        <div className="border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm rounded-xl px-3 py-2">
          Perfil actualizado correctamente.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumen de perfil</h1>
          <p className="text-sm text-zinc-600">
            {me.name ?? "Candidato"} · {me.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/profile"
            className="text-sm border rounded-xl px-3 py-2"
            title="Editar mi perfil"
          >
            Editar perfil
          </a>
          {me.resumeUrl ? (
            <a
              href={me.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm border rounded-xl px-3 py-2"
              title="Ver/descargar CV"
            >
              Ver CV
            </a>
          ) : (
            <span className="text-xs text-zinc-400">Sin CV</span>
          )}
        </div>
      </div>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold">Información</h2>
          <div className="mt-2 text-sm space-y-1">
            <div>Nombre: {me.name ?? "—"}</div>
            <div>Email: {me.email}</div>
            <div>Teléfono: {me.phone ?? "—"}</div>
            <div>Ubicación: {me.location ?? "—"}</div>
            <div>
              Fecha de nacimiento:{" "}
              {me.birthdate ? new Date(me.birthdate).toLocaleDateString() : "—"}
            </div>
            <div>
              LinkedIn:{" "}
              {me.linkedin ? (
                <a
                  className="text-blue-600 hover:underline"
                  href={me.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  {me.linkedin}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div>
              GitHub:{" "}
              {me.github ? (
                <a
                  className="text-blue-600 hover:underline"
                  href={me.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  {me.github}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold">Certificaciones</h2>
          <List items={me.certifications} />
        </div>
      </section>

      <section className="border rounded-xl p-4">
        <h2 className="font-semibold">Skills</h2>
        <div className="mt-3 grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium">Frontend</div>
            <List items={me.frontend} />
          </div>
          <div>
            <div className="text-sm font-medium">Backend</div>
            <List items={me.backend} />
          </div>
          <div>
            <div className="text-sm font-medium">Móviles</div>
            <List items={me.mobile} />
          </div>
          <div>
            <div className="text-sm font-medium">Cloud</div>
            <List items={me.cloud} />
          </div>
          <div>
            <div className="text-sm font-medium">Bases de datos</div>
            <List items={me.database} />
          </div>
          <div>
            <div className="text-sm font-medium">Ciberseguridad</div>
            <List items={me.cybersecurity} />
          </div>
          <div>
            <div className="text-sm font-medium">Testing / QA</div>
            <List items={me.testing} />
          </div>
          <div>
            <div className="text-sm font-medium">IA / ML</div>
            <List items={me.ai} />
          </div>
        </div>
      </section>

      <div>
        <a href="/jobs" className="text-sm text-blue-600 hover:underline">
          ← Buscar vacantes
        </a>
      </div>
    </main>
  );
}
