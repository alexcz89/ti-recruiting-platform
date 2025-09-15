// app/dashboard/candidates/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Candidato | Panel" };

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { applicationId?: string };
}) {
  // 1) Guard sesión/rol
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/candidates");

  const me = await prisma.user.findUnique({
    where: { email: session.user?.email! },
    select: { id: true, role: true },
  });
  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) {
    redirect("/");
  }

  // 2) Candidato
  const candidate = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      role: true,
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
  if (!candidate) notFound();
  if (candidate.role !== "CANDIDATE") redirect("/dashboard/candidates");

  // 3) Postulaciones del candidato SOLO a vacantes del recruiter actual
  const myApps = await prisma.application.findMany({
    where: {
      candidateId: candidate.id,
      job: { recruiterId: me.id }, // ← FILTRO CLAVE: SOLO mis vacantes
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      job: { select: { id: true, title: true, company: true } },
    },
    take: 10,
  });

  // Si viene un applicationId en la URL, valida que sea tuyo (del recruiter)
  const activeAppId = searchParams?.applicationId || "";
  const activeApp = activeAppId
    ? await prisma.application.findFirst({
        where: { id: activeAppId, job: { recruiterId: me.id } },
        select: { id: true },
      })
    : null;

  // UI helpers
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

  const waHref = candidate.phone
    ? `https://wa.me/${candidate.phone.replace(/^\+/, "")}?text=${encodeURIComponent(
        `Hola ${candidate.name ?? ""}, te contacto por una oportunidad laboral.`
      )}`
    : null;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidato</h1>
          <p className="text-sm text-zinc-600">
            {candidate.name ?? "—"} · {candidate.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {candidate.resumeUrl ? (
            <a
              href={candidate.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="border rounded px-3 py-1 text-sm"
              title="Ver/descargar CV"
            >
              Descargar CV
            </a>
          ) : (
            <span className="text-xs text-zinc-400">Sin CV</span>
          )}
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="border rounded px-3 py-1 text-sm"
              title={`WhatsApp: ${candidate.phone}`}
            >
              WhatsApp
            </a>
          ) : (
            <span className="text-xs text-zinc-400">Sin teléfono</span>
          )}
          {/* Si venimos con una postulación válida, botón directo a mensajes */}
          {activeApp?.id ? (
            <a
              href={`/dashboard/messages?applicationId=${activeApp.id}`}
              className="border rounded px-3 py-1 text-sm"
              title="Abrir mensajes de esta postulación"
            >
              Abrir mensajes
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna principal (datos del candidato) */}
        <section className="lg:col-span-2 space-y-6">
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold">Información</h2>
            <div className="mt-2 text-sm space-y-1">
              <div>Nombre: {candidate.name ?? "—"}</div>
              <div>Email: {candidate.email}</div>
              <div>Teléfono: {candidate.phone ?? "—"}</div>
              <div>Ubicación: {candidate.location ?? "—"}</div>
              <div>
                Fecha de nacimiento:{" "}
                {candidate.birthdate
                  ? new Date(candidate.birthdate).toLocaleDateString()
                  : "—"}
              </div>
              <div>
                LinkedIn:{" "}
                {candidate.linkedin ? (
                  <a
                    className="text-blue-600 hover:underline"
                    href={candidate.linkedin}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {candidate.linkedin}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div>
                GitHub:{" "}
                {candidate.github ? (
                  <a
                    className="text-blue-600 hover:underline"
                    href={candidate.github}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {candidate.github}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-4">
            <h2 className="font-semibold">Certificaciones</h2>
            <List items={candidate.certifications} />
          </div>

          <div className="border rounded-xl p-4">
            <h2 className="font-semibold">Skills</h2>
            <div className="mt-3 grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium">Frontend</div>
                <List items={candidate.frontend} />
              </div>
              <div>
                <div className="text-sm font-medium">Backend</div>
                <List items={candidate.backend} />
              </div>
              <div>
                <div className="text-sm font-medium">Móviles</div>
                <List items={candidate.mobile} />
              </div>
              <div>
                <div className="text-sm font-medium">Cloud</div>
                <List items={candidate.cloud} />
              </div>
              <div>
                <div className="text-sm font-medium">Bases de datos</div>
                <List items={candidate.database} />
              </div>
              <div>
                <div className="text-sm font-medium">Ciberseguridad</div>
                <List items={candidate.cybersecurity} />
              </div>
              <div>
                <div className="text-sm font-medium">Testing / QA</div>
                <List items={candidate.testing} />
              </div>
              <div>
                <div className="text-sm font-medium">IA / ML</div>
                <List items={candidate.ai} />
              </div>
            </div>
          </div>
        </section>

        {/* Panel lateral: Solo postulaciones de MI empresa */}
        <aside className="border rounded-xl p-4 h-fit">
          <h3 className="font-semibold mb-3">Postulaciones recientes (mi empresa)</h3>
          {myApps.length === 0 ? (
            <p className="text-sm text-zinc-500">—</p>
          ) : (
            <ul className="space-y-3">
              {myApps.map((a) => (
                <li key={a.id} className="border rounded-lg p-3">
                  <div className="text-sm font-medium">
                    {a.job?.title} — {a.job?.company}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Estado: {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={`/dashboard/messages?applicationId=${a.id}`}
                      className="border rounded px-2 py-1 text-xs"
                      title="Abrir mensajes"
                    >
                      Mensajes
                    </a>
                    <a
                      href={`/dashboard/applications?jobId=${a.job?.id}`}
                      className="border rounded px-2 py-1 text-xs"
                      title="Ver postulaciones de esta vacante"
                    >
                      Ver postulación
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div>
        <a href="/dashboard/applications" className="text-sm text-blue-600 hover:underline">
          ← Volver a postulaciones
        </a>
      </div>
    </main>
  );
}
