// app/profile/summary/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fromNow, formatDate } from "@/lib/dates";

export const metadata = { title: "Resumen de perfil | Bolsa TI" };

function formatMonthYear(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleDateString("es-MX", { month: "short", year: "numeric" })
    .replace(".", "");
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
      skills: true, // legacy
      certifications: true,
      highestEducationLevel: true,
    },
  });

  if (!me) redirect("/profile/edit");
  if (me.role !== "CANDIDATE") redirect("/dashboard");

  // Historial laboral
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
      job: {
        select: { id: true, title: true, company: { select: { name: true } }, updatedAt: true },
      },
    },
  });

  // KPI: años totales aproximados
  const totalYears = (() => {
    try {
      const sumYears = experiences.reduce((acc, e) => {
        const start = e.startDate ? new Date(e.startDate) : null;
        const end = e.isCurrent || !e.endDate ? new Date() : new Date(e.endDate!);
        if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return acc;
        const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return acc + Math.max(0, years);
      }, 0);
      return Math.round(sumYears * 10) / 10;
    } catch {
      return null;
    }
  })();

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="badge">{children}</span>
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
          <div className="border text-sm rounded-xl px-3 py-2 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Perfil actualizado correctamente.
          </div>
        )}
        {appliedMsg && (
          <div
            className={`border text-sm rounded-xl px-3 py-2 ${
              appliedMsg.tone === "emerald"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
            }`}
          >
            {appliedMsg.text}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <header className="glass-card p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                {me.name ?? "Candidato"}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 truncate">
                {me.location ?? "Ubicación no especificada"}
                {topStack.length ? ` · ${topStack.join(" · ")}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/profile/edit" className="btn-ghost" title="Editar mi perfil">
                Editar perfil
              </Link>

              {me.resumeUrl ? (
                <>
                  <a
                    href={me.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                    title="Ver/descargar CV"
                  >
                    Ver / descargar PDF
                  </a>
                  <Link
                    href="/cv/builder"
                    className="btn btn-primary"
                    title="Editar/crear tu CV con el constructor"
                  >
                    Editar en CV Builder
                  </Link>
                </>
              ) : (
                <Link href="/cv/builder" className="btn btn-primary" title="Crear tu CV con el constructor">
                  Crear CV en CV Builder
                </Link>
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
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Información</h2>
              <div className="mt-3 text-sm grid sm:grid-cols-2 gap-y-1.5 gap-x-6">
                <div><span className="text-muted">Nombre:</span> {me.name ?? "—"}</div>
                <div><span className="text-muted">Email:</span> {me.email}</div>
                <div><span className="text-muted">Teléfono:</span> {me.phone ?? "—"}</div>
                <div><span className="text-muted">Ubicación:</span> {me.location ?? "—"}</div>
                <div><span className="text-muted">Fecha de nacimiento:</span> {me.birthdate ? formatDate(me.birthdate) : "—"}</div>
                <div>
                  <span className="text-muted">LinkedIn:</span>{" "}
                  {me.linkedin ? (
                    <a className="text-blue-600 dark:text-blue-400 underline break-all" href={me.linkedin} target="_blank" rel="noreferrer">
                      {me.linkedin}
                    </a>
                  ) : "—"}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted">GitHub:</span>{" "}
                  {me.github ? (
                    <a className="text-blue-600 dark:text-blue-400 underline break-all" href={me.github} target="_blank" rel="noreferrer">
                      {me.github}
                    </a>
                  ) : "—"}
                </div>
              </div>
            </section>

            {/* Escolaridad */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100 mb-2">Escolaridad</h2>
              {education.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has agregado educación.</p>
                  <Link href="/profile/edit#education" className="btn-ghost text-xs">Agregar</Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {education.map((ed) => (
                    <li key={ed.id} className="soft-panel p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-default truncate">
                            {ed.institution}{ed.program ? ` — ${ed.program}` : ""}
                          </p>
                          <p className="text-xs text-muted">
                            {formatMonthYear(ed.startDate)} — {ed.status === "ONGOING" ? "actual" : formatMonthYear(ed.endDate)}
                            {ed.city ? ` · ${ed.city}` : ""}{ed.country ? `, ${ed.country}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="badge">
                            {ed.level
                              ? (EDUCATION_LEVEL_LABEL[ed.level] ?? ed.level)
                              : "Sin nivel"}
                          </span>
                          <span className="badge">
                            {EDUCATION_STATUS_LABEL[ed.status] ?? ed.status}
                          </span>
                        </div>
                      </div>
                      {ed.description && <p className="text-sm text-default whitespace-pre-wrap mt-2">{ed.description}</p>}
                      {ed.grade && <p className="text-xs text-muted mt-1">Promedio/Grado: {ed.grade}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Historial de trabajo (timeline) */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100 mb-2">Historial de trabajo</h2>
              {experiences.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has agregado experiencias.</p>
                  <Link href="/profile/edit#experience" className="btn-ghost text-xs">Agregar</Link>
                </div>
              ) : (
                <ul className="timeline space-y-3">
                  {experiences.map((e) => (
                    <li key={e.id} className="timeline-item">
                      <div className="soft-panel p-3">
                        <p className="text-sm font-medium text-default">{e.role} — {e.company}</p>
                        <p className="text-xs text-muted">
                          {formatMonthYear(e.startDate)} — {e.isCurrent ? "actual" : formatMonthYear(e.endDate)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ===== Derecha (4/12) ===== */}
          <aside className="lg:col-span-4 space-y-6">
            {/* KPI rápido */}
            <section className="stat">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="stat-label">Experiencia total</p>
                  <p className="stat-value">{typeof totalYears === "number" ? `${totalYears} años` : "—"}</p>
                </div>
                <div>
                  <p className="stat-label">Trabajos</p>
                  <p className="stat-value">{experiences.length}</p>
                </div>
                <div>
                  <p className="stat-label">Postulaciones</p>
                  <p className="stat-value">{myApps.length}</p>
                </div>
              </div>
            </section>

            {/* CV */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">CV</h2>
              <div className="mt-3 space-y-2">
                {me.resumeUrl ? (
                  <>
                    <a href={me.resumeUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full justify-center">
                      Ver / descargar PDF
                    </a>
                    <Link href="/cv/builder" className="btn btn-primary w-full justify-center">
                      Reemplazar en CV Builder
                    </Link>
                  </>
                ) : (
                  <Link href="/cv/builder" className="btn btn-primary w-full justify-center">
                    Crear CV en CV Builder
                  </Link>
                )}
              </div>
            </section>

            {/* Certificaciones */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Certificaciones</h2>
              {me.certifications?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {me.certifications.map((c) => <Pill key={c}>{c}</Pill>)}
                </div>
              ) : (
                <div className="soft-panel p-4 flex items-center justify-between mt-3">
                  <p className="text-sm text-muted">—</p>
                  <Link href="/profile/edit#certifications" className="btn-ghost text-xs">Agregar</Link>
                </div>
              )}
            </section>

            {/* Skills con barra de nivel */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Skills</h2>
              {candidateSkills.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {candidateSkills.map((s) => {
                    const levelValue = s.level ?? 0;
                    const pct = Math.max(0, Math.min(100, Math.round(levelValue * 20)));

                    const levelLabel =
                      s.level != null
                        ? SKILL_LEVEL_LABEL[s.level as number] ?? `Nivel ${s.level}`
                        : "Sin nivel";

                    return (
                      <li key={s.id} className="soft-panel px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.term.label}</span>
                          <span className="text-xs text-muted">{levelLabel}</span>
                        </div>
                        <div
                          className="mt-2 progress"
                          aria-label={`Nivel ${levelValue} de 5 en ${s.term.label}`}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={5}
                          aria-valuenow={levelValue}
                        >
                          <div className="progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : me.skills?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {me.skills.map((s) => <Pill key={s}>{s}</Pill>)}
                </div>
              ) : (
                <div className="soft-panel p-4 flex items-center justify-between mt-3">
                  <p className="text-sm text-muted">—</p>
                  <Link href="/profile/edit#skills" className="btn-ghost text-xs">Agregar</Link>
                </div>
              )}
            </section>

            {/* Idiomas */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Idiomas</h2>
              {languages.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between mt-3">
                  <p className="text-sm text-muted">—</p>
                  <Link href="/profile/edit#languages" className="btn-ghost text-xs">Agregar</Link>
                </div>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {languages.map((l) => (
                    <li key={l.id} className="flex items-center justify-between">
                      <span>{l.term.label}</span>
                      <span className="text-xs text-muted">{LEVEL_LABEL[l.level] ?? l.level}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Postulaciones */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Mis postulaciones</h2>
              {myApps.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between mt-3">
                  <p className="text-sm text-muted">Aún no has postulado a ninguna vacante.</p>
                  <Link href="/jobs" className="btn-ghost text-xs">Buscar vacantes</Link>
                </div>
              ) : (
                <ul className="space-y-2 mt-2">
                  {myApps.map((a) => (
                    <li key={a.id} className="soft-panel p-3">
                      <p className="text-sm font-medium">
                        {a.job?.title ?? "—"} — {a.job?.company?.name ?? "—"}
                      </p>
                      <p className="text-xs text-muted">
                        <time title={new Date(a.createdAt).toLocaleString()}>
                          {fromNow(a.createdAt)}
                        </time>
                      </p>
                      <div className="mt-2">
                        <a href={`/jobs/${a.job?.id}`} className="btn-ghost text-xs">Ver vacante</a>
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
          <a href="/jobs" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Buscar vacantes</a>
          <a href="/profile/edit" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Editar mi perfil</a>
        </div>
      </div>
    </main>
  );
}
