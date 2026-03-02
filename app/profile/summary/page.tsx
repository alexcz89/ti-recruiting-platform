// app/profile/summary/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from '@/lib/server/prisma';
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

const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};

const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

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
  searchParams?: { updated?: string; applied?: string; cvImported?: string };
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
      certifications: true,
      highestEducationLevel: true,
    },
  });

  if (!me) redirect("/profile/edit");
  if (me.role !== "CANDIDATE") redirect("/dashboard");

  const experiences = await prisma.workExperience.findMany({
    where: { userId: me.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, role: true, company: true,
      startDate: true, endDate: true, isCurrent: true,
    },
  });

  const education = await prisma.education.findMany({
    where: { userId: me.id },
    orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, level: true, status: true, institution: true, program: true,
      country: true, city: true, startDate: true, endDate: true,
      grade: true, description: true, sortIndex: true,
    },
  });

  const languages = await prisma.candidateLanguage.findMany({
    where: { userId: me.id },
    include: { term: { select: { label: true } } },
    orderBy: { term: { label: "asc" } },
  });

  const candidateSkills = await prisma.candidateSkill.findMany({
    where: { userId: me.id },
    include: { term: { select: { label: true } } },
    orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
  });

  const topStack = candidateSkills.slice(0, 3).map((s) => s.term.label);

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
    } catch { return null; }
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

  const cvImported = searchParams?.cvImported === "1";

  return (
    <main className="w-full pb-8">
      {/* ── Toasts / banners ── */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-4 space-y-3">
        {searchParams?.updated === "1" && (
          <div className="border text-sm rounded-xl px-3 py-2 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Perfil actualizado correctamente.
          </div>
        )}
        {cvImported && (
          <div className="border text-sm rounded-xl px-3 py-2 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Hemos importado el CV que creaste en el constructor. Ya está guardado en tu perfil.
          </div>
        )}
        {appliedMsg && (
          <div className={`border text-sm rounded-xl px-3 py-2 ${
            appliedMsg.tone === "emerald"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
          }`}>
            {appliedMsg.text}
          </div>
        )}
      </div>

      {/* ── Header ── */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 mt-4">
        <header className="glass-card p-4 md:p-6">
          {/* Nombre + ubicación */}
          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-zinc-900 dark:text-zinc-100 break-words">
              {me.name ?? "Candidato"}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5 line-clamp-2">
              {me.location ?? "Ubicación no especificada"}
              {topStack.length ? ` · ${topStack.join(" · ")}` : ""}
            </p>
          </div>

          {/* Botones — columna en mobile, fila en sm+ */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/profile/edit" className="btn-ghost text-center" title="Editar mi perfil">
              Editar perfil
            </Link>
            {me.resumeUrl ? (
              <>
                <a
                  href={me.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-center"
                >
                  Ver / descargar PDF
                </a>
                <Link href="/cv/builder" className="btn btn-primary text-center">
                  Editar en CV Builder
                </Link>
              </>
            ) : (
              <Link href="/cv/builder" className="btn btn-primary text-center">
                Crear CV en CV Builder
              </Link>
            )}
          </div>
        </header>
      </div>

      {/* ── Stats — siempre visible, fila de 3 en mobile ── */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 mt-4">
        <section className="stat">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center sm:text-left">
              <p className="stat-label text-xs sm:text-sm">Experiencia</p>
              <p className="stat-value text-lg sm:text-2xl">
                {typeof totalYears === "number" ? `${totalYears} años` : "—"}
              </p>
            </div>
            <div className="text-center sm:text-left">
              <p className="stat-label text-xs sm:text-sm">Trabajos</p>
              <p className="stat-value text-lg sm:text-2xl">{experiences.length}</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="stat-label text-xs sm:text-sm">Postulaciones</p>
              <p className="stat-value text-lg sm:text-2xl">{myApps.length}</p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Grid principal ── */}
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

          {/* ── Columna principal ── */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">

            {/* Información personal */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-base sm:text-lg text-zinc-800 dark:text-zinc-100">Información</h2>
              <div className="mt-3 text-sm grid sm:grid-cols-2 gap-y-2 gap-x-6">
                <div><span className="text-muted">Nombre:</span> {me.name ?? "—"}</div>
                <div><span className="text-muted">Email:</span> <span className="break-all">{me.email}</span></div>
                <div><span className="text-muted">Teléfono:</span> {me.phone ?? "—"}</div>
                <div><span className="text-muted">Ubicación:</span> {me.location ?? "—"}</div>
                <div><span className="text-muted">Nacimiento:</span> {me.birthdate ? formatDate(me.birthdate) : "—"}</div>
                <div className="break-all">
                  <span className="text-muted">LinkedIn:</span>{" "}
                  {me.linkedin ? (
                    <a className="text-blue-600 dark:text-blue-400 underline" href={me.linkedin} target="_blank" rel="noreferrer">
                      {me.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  ) : "—"}
                </div>
                <div className="sm:col-span-2 break-all">
                  <span className="text-muted">GitHub:</span>{" "}
                  {me.github ? (
                    <a className="text-blue-600 dark:text-blue-400 underline" href={me.github} target="_blank" rel="noreferrer">
                      {me.github.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  ) : "—"}
                </div>
              </div>
            </section>

            {/* CV — en mobile aparece aquí (dentro del flujo principal), en lg va al sidebar */}
            <section className="glass-card p-4 md:p-6 lg:hidden">
              <h2 className="font-semibold text-base text-zinc-800 dark:text-zinc-100 mb-3">CV</h2>
              {me.resumeUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 flex-1">CV disponible</p>
                      <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">✓</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a href={me.resumeUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100 transition-colors">
                      Abrir PDF
                    </a>
                    <Link href="/cv/builder" className="btn btn-primary w-full justify-center">
                      Editar en CV Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <Link href="/cv/builder" className="btn btn-primary w-full justify-center">
                  Crear CV en CV Builder
                </Link>
              )}
            </section>

            {/* Escolaridad */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-base sm:text-lg text-zinc-800 dark:text-zinc-100 mb-3">Escolaridad</h2>
              {education.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has agregado educación.</p>
                  <Link href="/profile/edit#education" className="btn-ghost text-xs whitespace-nowrap shrink-0">Agregar</Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {education.map((ed) => (
                    <li key={ed.id} className="soft-panel p-3">
                      {/* En mobile: stack vertical; en sm+: fila */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-default">
                            {ed.institution}{ed.program ? ` — ${ed.program}` : ""}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {formatMonthYear(ed.startDate)} — {ed.status === "ONGOING" ? "actual" : formatMonthYear(ed.endDate)}
                            {ed.city ? ` · ${ed.city}` : ""}{ed.country ? `, ${ed.country}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <span className="badge">{ed.level ? (EDUCATION_LEVEL_LABEL[ed.level] ?? ed.level) : "Sin nivel"}</span>
                          <span className="badge">{EDUCATION_STATUS_LABEL[ed.status] ?? ed.status}</span>
                        </div>
                      </div>
                      {ed.description && <p className="text-sm text-default whitespace-pre-wrap mt-2">{ed.description}</p>}
                      {ed.grade && <p className="text-xs text-muted mt-1">Promedio: {ed.grade}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Experiencia */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-base sm:text-lg text-zinc-800 dark:text-zinc-100 mb-3">Historial de trabajo</h2>
              {experiences.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has agregado experiencias.</p>
                  <Link href="/profile/edit#experience" className="btn-ghost text-xs whitespace-nowrap shrink-0">Agregar</Link>
                </div>
              ) : (
                <ul className="timeline space-y-3">
                  {experiences.map((e) => (
                    <li key={e.id} className="timeline-item">
                      <div className="soft-panel p-3">
                        <p className="text-sm font-medium text-default">{e.role} — {e.company}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatMonthYear(e.startDate)} — {e.isCurrent ? "actual" : formatMonthYear(e.endDate)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Postulaciones — en mobile aquí, en lg en sidebar */}
            <section className="glass-card p-4 md:p-6 lg:hidden">
              <h2 className="font-semibold text-base text-zinc-800 dark:text-zinc-100 mb-2">Mis postulaciones</h2>
              {myApps.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has postulado.</p>
                  <Link href="/jobs" className="btn-ghost text-xs whitespace-nowrap shrink-0">Buscar vacantes</Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {myApps.map((a) => (
                    <li key={a.id} className="soft-panel p-3">
                      <p className="text-sm font-medium">{a.job?.title ?? "—"} — {a.job?.company?.name ?? "—"}</p>
                      <p className="text-xs text-muted">
                        <time title={new Date(a.createdAt).toLocaleString()}>{fromNow(a.createdAt)}</time>
                      </p>
                      <div className="mt-2">
                        <a href={`/jobs/${a.job?.id}`} className="btn-ghost text-xs whitespace-nowrap shrink-0">Ver vacante</a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ── Sidebar — solo lg+ ── */}
          <aside className="hidden lg:block lg:col-span-4 space-y-6">

            {/* CV con iframe */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">CV</h2>
              {me.resumeUrl ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 flex-1">CV disponible</p>
                      <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">✓</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
                    <iframe
                      src={`${me.resumeUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-[500px]"
                      title="Vista previa del CV"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <a href={me.resumeUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Abrir en nueva pestaña
                    </a>
                    <Link href="/cv/builder" className="btn btn-primary w-full justify-center">
                      Editar en CV Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Sin CV</h3>
                    <p className="mt-1 text-xs text-zinc-500">Crea tu currículum profesional</p>
                  </div>
                  <Link href="/cv/builder" className="btn btn-primary w-full justify-center">
                    Crear CV en CV Builder
                  </Link>
                </div>
              )}
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
                  <Link href="/profile/edit#certifications" className="btn-ghost text-xs whitespace-nowrap shrink-0">Agregar</Link>
                </div>
              )}
            </section>

            {/* Skills */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Skills</h2>
              {candidateSkills.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {candidateSkills.map((s) => {
                    const levelValue = s.level ?? 0;
                    const pct = Math.max(0, Math.min(100, Math.round(levelValue * 20)));
                    const levelLabel = s.level != null ? SKILL_LEVEL_LABEL[s.level as number] ?? `Nivel ${s.level}` : "Sin nivel";
                    return (
                      <li key={s.id} className="soft-panel px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.term.label}</span>
                          <span className="text-xs text-muted">{levelLabel}</span>
                        </div>
                        <div className="mt-2 progress" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={levelValue}>
                          <div className="progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="soft-panel p-4 flex items-center justify-between mt-3">
                  <p className="text-sm text-muted">—</p>
                  <Link href="/profile/edit#skills" className="btn-ghost text-xs whitespace-nowrap shrink-0">Agregar</Link>
                </div>
              )}
            </section>

            {/* Idiomas */}
            <section className="glass-card p-4 md:p-6">
              <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Idiomas</h2>
              {languages.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between mt-3">
                  <p className="text-sm text-muted">—</p>
                  <Link href="/profile/edit#languages" className="btn-ghost text-xs whitespace-nowrap shrink-0">Agregar</Link>
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
                  <p className="text-sm text-muted">Aún no has postulado.</p>
                  <Link href="/jobs" className="btn-ghost text-xs whitespace-nowrap shrink-0">Buscar vacantes</Link>
                </div>
              ) : (
                <ul className="space-y-2 mt-2">
                  {myApps.map((a) => (
                    <li key={a.id} className="soft-panel p-3">
                      <p className="text-sm font-medium">{a.job?.title ?? "—"} — {a.job?.company?.name ?? "—"}</p>
                      <p className="text-xs text-muted">
                        <time title={new Date(a.createdAt).toLocaleString()}>{fromNow(a.createdAt)}</time>
                      </p>
                      <div className="mt-2">
                        <a href={`/jobs/${a.job?.id}`} className="btn-ghost text-xs whitespace-nowrap shrink-0">Ver vacante</a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        {/* Footer links */}
        <div className="flex items-center gap-4 mt-6">
          <a href="/jobs" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Buscar vacantes</a>
          <a href="/profile/edit" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Editar mi perfil</a>
        </div>
      </div>
    </main>
  );
}