// app/profile/summary/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fromNow, formatDate } from "@/lib/dates";

export const metadata = { title: "Resumen de perfil | Bolsa TI" };

function formatMonthYear(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { month: "short", year: "numeric" }).replace(".", "");
}

// Idiomas
const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};

// Skills con nivel (1..5)
const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

// Escolaridad
const EDUCATION_LEVEL_LABEL: Record<string, string> = {
  NONE: "Sin estudios formales",
  PRIMARY: "Primaria",
  SECONDARY: "Secundaria",
  HIGH_SCHOOL: "Preparatoria / Bachillerato",
  TECHNICAL: "Técnico / TSU",
  BACHELOR: "Licenciatura / Ingeniería",
  MASTER: "Maestría",
  DOCTORATE: "Doctorado",
  OTHER: "Diplomado / Curso",
};

const EDUCATION_STATUS_LABEL: Record<string, string> = {
  ONGOING: "En curso",
  COMPLETED: "Concluido",
  INCOMPLETE: "Trunco",
};

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
      skills: true,            // legacy chips (texto plano)
      certifications: true,
      highestEducationLevel: true, // no se muestra en mini resumen
    },
  });

  if (!me) redirect("/profile/edit");
  if (me.role !== "CANDIDATE") redirect("/dashboard");

  // Historial laboral
  const experiences = await prisma.workExperience.findMany({
    where: { userId: me.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, role: true, company: true, startDate: true, endDate: true, isCurrent: true },
  });

  // Educación (lista)
  const education = await prisma.education.findMany({
    where: { userId: me.id },
    orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      level: true,
      status: true,
      institution: true,
      program: true,
      country: true,
      city: true,
      startDate: true,
      endDate: true,
      grade: true,
      description: true,
      sortIndex: true,
    },
  });

  // Idiomas
  const languages = await prisma.candidateLanguage.findMany({
    where: { userId: me.id },
    include: { term: { select: { label: true } } },
    orderBy: { term: { label: "asc" } },
  });

  // Skills con nivel
  const candidateSkills = await prisma.candidateSkill.findMany({
    where: { userId: me.id },
    include: { term: { select: { label: true } } },
    orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
  });

  // Top-3 stack para cabecera
  const topStack = candidateSkills.slice(0, 3).map((s) => s.term.label);

  // Postulaciones
  const myApps = await prisma.application.findMany({
    where: { candidateId: me.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      job: { select: { id: true, title: true, company: { select: { name: true } }, updatedAt: true } },
    },
  });

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block text-xs bg-gray-100 rounded-full px-2 py-1 mr-2 mb-2">{children}</span>
  );

  const appliedMsg =
    searchParams?.applied === "1"
      ? { text: "¡Postulación enviada! 🎉", tone: "emerald" as const }
      : searchParams?.applied === "existing"
      ? { text: "Ya habías postulado a esta vacante.", tone: "amber" as const }
      : null;

  return (
    <main className="max-w-none p-0">
      {/* Notifs */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-6 space-y-3">
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
      </div>

      {/* Header */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <header className="border rounded-2xl p-5 flex flex-col gap-2 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold leading-tight">{me.name ?? "Candidato"}</h1>
              <p className="text-sm text-zinc-600">
                {me.location ?? "Ubicación no especificada"}
                {topStack.length ? ` · ${topStack.join(" · ")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a href="/profile/edit" className="text-sm border rounded-xl px-3 py-2" title="Editar mi perfil">
                Editar perfil
              </a>
              {me.resumeUrl ? (
                <a href={me.resumeUrl} target="_blank" rel="noreferrer" className="text-sm border rounded-xl px-3 py-2" title="Ver/descargar CV">
                  Ver CV
                </a>
              ) : (
                <span className="text-xs text-zinc-400">Sin CV</span>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Grid 12 cols */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ===== Izquierda (8/12) ===== */}
          <div className="lg:col-span-8 space-y-6">
            {/* Información */}
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-semibold">Información</h2>
              <div className="mt-2 text-sm grid sm:grid-cols-2 gap-y-1 gap-x-6">
                <div><span className="text-zinc-500">Nombre:</span> {me.name ?? "—"}</div>
                <div><span className="text-zinc-500">Email:</span> {me.email}</div>
                <div><span className="text-zinc-500">Teléfono:</span> {me.phone ?? "—"}</div>
                <div><span className="text-zinc-500">Ubicación:</span> {me.location ?? "—"}</div>
                <div><span className="text-zinc-500">Fecha de nacimiento:</span> {me.birthdate ? formatDate(me.birthdate) : "—"}</div>
                <div>
                  <span className="text-zinc-500">LinkedIn:</span>{" "}
                  {me.linkedin ? (
                    <a className="text-blue-600 hover:underline break-all" href={me.linkedin} target="_blank" rel="noreferrer">
                      {me.linkedin}
                    </a>
                  ) : "—"}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-zinc-500">GitHub:</span>{" "}
                  {me.github ? (
                    <a className="text-blue-600 hover:underline break-all" href={me.github} target="_blank" rel="noreferrer">
                      {me.github}
                    </a>
                  ) : "—"}
                </div>
              </div>
            </section>

            {/* Escolaridad */}
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-semibold mb-2">Escolaridad</h2>
              {education.length === 0 ? (
                <p className="text-sm text-zinc-500">Aún no has agregado educación.</p>
              ) : (
                <ul className="space-y-3">
                  {education.map((ed) => (
                    <li key={ed.id} className="border rounded-lg p-3 bg-white/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            {ed.institution}{ed.program ? ` — ${ed.program}` : ""}
                          </div>
                          <div className="text-xs text-zinc-600">
                            {formatMonthYear(ed.startDate)} — {ed.status === "ONGOING" ? "actual" : formatMonthYear(ed.endDate)}
                            {ed.city ? ` · ${ed.city}` : ""}{ed.country ? `, ${ed.country}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                            {EDUCATION_LEVEL_LABEL[ed.level] ?? ed.level}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                            {EDUCATION_STATUS_LABEL[ed.status] ?? ed.status}
                          </span>
                        </div>
                      </div>

                      {ed.description && (
                        <p className="text-sm text-zinc-700 whitespace-pre-wrap break-anywhere mt-2">
                          {ed.description}
                        </p>
                      )}
                      {ed.grade && (
                        <p className="text-xs text-zinc-600 mt-1">Promedio/Grado: {ed.grade}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Historial de trabajo */}
            <section className="border rounded-xl p-4 bg-white">
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
          </div>

          {/* ===== Derecha (4/12) ===== */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Certificaciones */}
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-semibold">Certificaciones</h2>
              {me.certifications?.length ? (
                <div className="mt-3">
                  {me.certifications.map((c) => (
                    <Pill key={c}>{c}</Pill>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mt-2">—</p>
              )}
            </section>

            {/* Skills */}
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-semibold">Skills</h2>
              {candidateSkills.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {candidateSkills.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                      <span className="font-medium">{s.term.label}</span>
                      <span className="text-xs text-zinc-600">{SKILL_LEVEL_LABEL[s.level] ?? `Nivel ${s.level}`}</span>
                    </li>
                  ))}
                </ul>
              ) : me.skills?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {me.skills.map((s) => (
                    <Pill key={s}>{s}</Pill>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mt-2">—</p>
              )}
            </section>

            {/* Idiomas */}
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-semibold">Idiomas</h2>
              {languages.length === 0 ? (
                <p className="text-sm text-zinc-500 mt-2">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {languages.map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-sm">
                      <span>{l.term.label}</span>
                      <span className="text-xs text-zinc-600">{LEVEL_LABEL[l.level] ?? l.level}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Postulaciones */}
            <section className="border rounded-xl p-4 bg-white">
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
                        <a href={`/jobs/${a.job?.id}`} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                          Ver vacante
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        {/* Acciones inferiores */}
        <div className="flex items-center gap-3 mt-6">
          <a href="/jobs" className="text-sm text-blue-600 hover:underline">← Buscar vacantes</a>
          <a href="/profile/edit" className="text-sm text-blue-600 hover:underline">Editar mi perfil</a>
        </div>
      </div>
    </main>
  );
}
