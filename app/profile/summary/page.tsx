// app/profile/summary/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromNow, formatDate } from "@/lib/dates";

export const metadata = { title: "Resumen de perfil | Bolsa TI" };

// Helper: "mes corto y año" en español (ej. "ene 2024")
function formatMonthYear(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  // es-MX o es-ES según prefieras. Reemplazo para quitar el punto en abreviaturas.
  return date
    .toLocaleDateString("es-MX", { month: "short", year: "numeric" })
    .replace(".", "");
}

export default async function ProfileSummaryPage({
  searchParams,
}: {
  searchParams?: { updated?: string; applied?: string };
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
      skills: true,
      certifications: true,
    },
  });

  if (!me) redirect("/profile/edit");
  if (me.role !== "CANDIDATE") redirect("/dashboard");

  // Historial laboral (más reciente primero)
  const experiences = await prisma.workExperience.findMany({
    where: { userId: me.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      role: true,
      company: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
    },
  });

  // (Opcional) Mis postulaciones
  const myApps = await prisma.application.findMany({
    where: { candidateId: me.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: { select: { name: true } },
          updatedAt: true,
        },
      },
    },
  });

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block text-xs bg-gray-100 rounded-full px-2 py-1 mr-2 mb-2">
      {children}
    </span>
  );

  const appliedMsg =
    searchParams?.applied === "1"
      ? { text: "¡Postulación enviada! 🎉", tone: "emerald" as const }
      : searchParams?.applied === "existing"
      ? { text: "Ya habías postulado a esta vacante.", tone: "amber" as const }
      : null;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {searchParams?.updated === "1" && (
        <div className="border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm rounded-xl px-3 py-2">
          Perfil actualizado correctamente.
        </div>
      )}
      {appliedMsg && (
        <div
          className={`border text-sm rounded-xl px-3 py-2 ${
            appliedMsg.tone === "emerald"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {appliedMsg.text}
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
            href="/profile/edit"
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
              Fecha de nacimiento: {me.birthdate ? formatDate(me.birthdate) : "—"}
            </div>
            <div>
              LinkedIn:{" "}
              {me.linkedin ? (
                <a
                  className="text-blue-600 hover:underline break-all"
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
                  className="text-blue-600 hover:underline break-all"
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
          {me.certifications?.length ? (
            <div className="mt-2">
              {me.certifications.map((c) => (
                <Pill key={c}>{c}</Pill>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">—</p>
          )}
        </div>
      </section>

      <section className="border rounded-xl p-4">
        <h2 className="font-semibold">Skills</h2>
        {me.skills?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {me.skills.map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mt-2">—</p>
        )}
      </section>

      {/* Historial de trabajo */}
      <section className="border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Historial de trabajo</h2>
        {experiences.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no has agregado experiencias.</p>
        ) : (
          <ul className="space-y-3">
            {experiences.map((e) => (
              <li key={e.id} className="border rounded-lg p-3">
                <div className="text-sm font-medium">
                  {e.role} — {e.company}
                </div>
                <div className="text-xs text-zinc-600">
                  {formatMonthYear(e.startDate)} — {e.isCurrent ? "actual" : formatMonthYear(e.endDate)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Postulaciones */}
      <section className="border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Mis postulaciones</h2>
        {myApps.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no has postulado a ninguna vacante.</p>
        ) : (
          <ul className="space-y-2">
            {myApps.map((a) => (
              <li key={a.id} className="border rounded-lg p-3">
                <div className="text-sm font-medium">
                  {a.job?.title ?? "—"} — {a.job?.company?.name ?? "—"}
                </div>
                <div className="text-xs text-zinc-500">
                  <time title={new Date(a.createdAt).toLocaleString()}>{fromNow(a.createdAt)}</time>
                </div>
                <div className="mt-2">
                  <a
                    href={`/jobs/${a.job?.id}`}
                    className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
                  >
                    Ver vacante
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <a href="/jobs" className="text-sm text-blue-600 hover:underline">
          ← Buscar vacantes
        </a>
        <a href="/profile/edit" className="text-sm text-blue-600 hover:underline">
          Editar mi perfil
        </a>
      </div>
    </main>
  );
}
