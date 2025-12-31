// app/dashboard/candidates/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Candidato | Panel" };

// Etiquetas de nivel de idioma (igual que en profile/summary)
const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};

// Skills con nivel (igual que en profile/summary)
const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "B?sico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { applicationId?: string; jobId?: string };
}) {
  // 1) Guard sesión/rol
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/candidates");

  // Reclutador/Admin + obtener companyId del reclutador para multi-tenant
  const me = await prisma.user.findUnique({
    where: { email: session.user?.email! },
    select: { id: true, role: true, companyId: true },
  });
  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) {
    redirect("/");
  }
  const companyId = me.companyId ?? null;

  // 2) Candidato (solo campos vigentes)
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
      skills: true,
      certifications: true,
      candidateSkills: {
        select: {
          id: true,
          level: true,
          term: { select: { label: true } },
        },
        orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
      },
      candidateLanguages: {
        select: {
          level: true,
          term: { select: { label: true } },
        },
      },
    },
  });
  if (!candidate) notFound();
  if (candidate.role !== "CANDIDATE") redirect("/dashboard");

  // 3) Postulaciones del candidato SOLO a vacantes de MI EMPRESA
  const myApps = companyId
    ? await prisma.application.findMany({
        where: {
          candidateId: candidate.id,
          job: { companyId },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              skills: true,
              company: { select: { name: true } },
            },
          },
        },
        take: 10,
      })
    : [];

  // (Opcional) applicationId
  const activeAppId = searchParams?.applicationId || "";
  const activeApp = activeAppId
    ? await prisma.application.findFirst({
        where: { id: activeAppId, job: { companyId: companyId ?? "" } },
        select: { id: true },
      })
    : null;

  // Para botones de regreso desde job
  const fromJobId = searchParams?.jobId;

  // UI helpers
  const Pill = ({
    children,
    highlight = false,
  }: {
    children: React.ReactNode;
    highlight?: boolean;
  }) => (
    <span
      className={
        highlight
          ? "inline-block text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5 mr-2 mb-2 dark:bg-emerald-900/20 dark:text-emerald-100 dark:border-emerald-500/40"
          : "inline-block text-[11px] bg-gray-50 text-zinc-700 border border-zinc-200 rounded-full px-2 py-0.5 mr-2 mb-2 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700"
      }
    >
      {children}
    </span>
  );

  const List = ({
    items,
    emptyLabel = "—",
  }: {
    items?: string[] | null;
    emptyLabel?: string;
  }) =>
    items && items.length ? (
      <div className="mt-2">
        {items.map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
      </div>
    ) : (
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {emptyLabel}
      </p>
    );

  const waHref = candidate.phone
    ? `https://wa.me/${candidate.phone.replace(
        /^\+/,
        ""
      )}?text=${encodeURIComponent(
        `Hola ${candidate.name ?? ""}, te contacto por una oportunidad laboral.`
      )}`
    : null;

  // Helper simple para PDFs
  const pdfSrc = candidate.resumeUrl
    ? `${candidate.resumeUrl}${
        candidate.resumeUrl.includes("#")
          ? ""
          : "#toolbar=1&navpanes=0&scrollbar=1"
      }`
    : null;

  // Helper: snapshot de hasta 4 skills priorizando Req
  function buildRequiredSnapshot(
    jobSkills: string[] | null | undefined,
    candSkills: string[] | null | undefined
  ) {
    const reqNames = new Set(
      (jobSkills || [])
        .filter((s) => s.toLowerCase().startsWith("req:"))
        .map((s) => s.slice(4).trim().toLowerCase())
        .filter(Boolean)
    );
    const cand = candSkills || [];

    const matches: string[] = [];
    const seen = new Set<string>();
    for (const s of cand) {
      const key = s.toLowerCase();
      if (!seen.has(key) && reqNames.has(key)) {
        matches.push(s);
        seen.add(key);
      }
    }

    const others: string[] = [];
    for (const s of cand) {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        others.push(s);
        seen.add(key);
      }
      if (matches.length + others.length >= 4) break;
    }

    return {
      matches: matches.slice(0, 4),
      others: others.slice(0, Math.max(0, 4 - matches.length)),
    };
  }

  const headerBtnClasses =
    "inline-flex items-center justify-center gap-1 rounded-full border border-zinc-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900";

  const detailedSkills =
    (candidate.candidateSkills || [])
      .map((s) => ({
        id: s.id,
        label: s.term?.label || "",
        level: s.level ?? null,
      }))
      .filter((s) => s.label) || [];

  const candidateSkillNames = detailedSkills.length
    ? detailedSkills.map((s) => s.label)
    : candidate.skills;

  // Idiomas desde candidateLanguages
  const languageItems =
    (candidate.candidateLanguages || [])
      .map((cl) => {
        const label = cl.term?.label || "";
        const levelKey = cl.level || "";
        if (!label && !levelKey) return null;
        const levelLabel =
          LEVEL_LABEL[levelKey] ?? (levelKey ? levelKey : "");
        return levelLabel ? `${label} · ${levelLabel}` : label;
      })
      .filter(Boolean) as string[];

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-6 lg:py-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          {/* Avatar iniciales */}
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/90 text-sm font-semibold text-white shadow-sm">
            {candidate.name
              ?.split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("") || "C"}
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              {candidate.name || "Candidato"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900/40">
                {candidate.email}
              </span>
              {candidate.location && (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900/40">
                  {candidate.location}
                </span>
              )}
              {candidate.phone && (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900/40">
                  {candidate.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botones alineados */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2">
          {fromJobId && (
            <>
              <Link
                href={`/dashboard/jobs/${fromJobId}/applications`}
                className={headerBtnClasses}
              >
                ← Volver a la vacante
              </Link>
              <Link
                href={`/dashboard/jobs/${fromJobId}`}
                className={headerBtnClasses}
                title="Abrir Pipeline"
              >
                Ver Pipeline
              </Link>
            </>
          )}

          {candidate.resumeUrl ? (
            <a
              href={candidate.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className={headerBtnClasses}
              title="Ver/descargar CV"
            >
              Descargar CV
            </a>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              Sin CV
            </span>
          )}

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className={headerBtnClasses}
              title={`WhatsApp: ${candidate.phone}`}
            >
              WhatsApp
            </a>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              Sin teléfono
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <section className="space-y-6 lg:col-span-2">
          {/* Información */}
          <div className="glass-card border rounded-2xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Información
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  Nombre
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  Email
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  Teléfono
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.phone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  Ubicación
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.location ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  Fecha de nacimiento
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.birthdate
                    ? new Date(candidate.birthdate).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  LinkedIn
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.linkedin ? (
                    <a
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      href={candidate.linkedin}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {candidate.linkedin}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                  GitHub
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.github ? (
                    <a
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      href={candidate.github}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {candidate.github}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Skills / Certificaciones */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card border rounded-2xl p-4 md:p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Skills
              </h2>
              {detailedSkills.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {detailedSkills.map((s) => {
                    const levelValue = s.level ?? 0;
                    const pct = Math.max(
                      0,
                      Math.min(100, Math.round(levelValue * 20))
                    );

                    const levelLabel =
                      s.level != null
                        ? SKILL_LEVEL_LABEL[s.level as number] ??
                          `Nivel ${s.level}`
                        : "Sin nivel";

                    return (
                      <li key={s.id} className="soft-panel px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.label}</span>
                          <span className="text-xs text-muted">
                            {levelLabel}
                          </span>
                        </div>
                        <div
                          className="mt-2 progress"
                          aria-label={`Nivel ${levelValue} de 5 en ${s.label}`}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={5}
                          aria-valuenow={levelValue}
                        >
                          <div
                            className="progress-bar"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <List
                  items={candidate.skills}
                  emptyLabel="Sin skills capturados"
                />
              )}
            </div>

            <div className="glass-card border rounded-2xl p-4 md:p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Certificaciones
              </h2>
              <List
                items={candidate.certifications}
                emptyLabel="Sin certificaciones capturadas"
              />
            </div>
          </div>

          <div className="glass-card border rounded-2xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Idiomas
            </h2>
            <List
              items={languageItems}
              emptyLabel="Sin idiomas capturados"
            />
          </div>

          {/* CV */}
          {candidate.resumeUrl && (
            <div className="glass-card border rounded-2xl p-4 md:p-6">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                CV
              </h2>
              <div className="mt-3 overflow-hidden rounded-lg border bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative w-full" style={{ height: "70vh" }}>
                  <iframe
                    src={pdfSrc!}
                    title="Vista previa del CV"
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={candidate.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={headerBtnClasses}
                >
                  Abrir en nueva pestaña
                </a>
                <a
                  href={candidate.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className={headerBtnClasses}
                >
                  Descargar
                </a>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Si el visor no carga, el sitio del CV podría bloquear la
                inserción. Usa “Abrir en nueva pestaña”.
              </p>
            </div>
          )}
        </section>

        {/* Panel lateral: postulaciones de mi empresa */}
        <aside className="glass-card h-fit rounded-2xl border p-4 md:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Postulaciones recientes (mi empresa)
          </h3>
          {myApps.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">—</p>
          ) : (
            <ul className="space-y-3">
              {myApps.map((a) => {
                const { matches, others } = buildRequiredSnapshot(
                  a.job?.skills,
                  candidateSkillNames
                );
                const show = [...matches, ...others].slice(0, 4);

                return (
                  <li
                    key={a.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/70"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {a.job?.title} — {a.job?.company?.name ?? "—"}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Estado: {a.status} ·{" "}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </div>

                    {show.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {show.map((s) => (
                          <Pill key={s} highlight={matches.includes(s)}>
                            {s}
                          </Pill>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/dashboard/messages?applicationId=${a.id}`}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        title="Abrir mensajes"
                      >
                        Mensajes
                      </a>
                      <Link
                        href={`/dashboard/jobs/${a.job?.id}/applications`}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        title="Ver postulaciones de esta vacante"
                      >
                        Ver vacante
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {!fromJobId && (
        <div>
          <Link
            href="/dashboard/jobs"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Volver a vacantes
          </Link>
        </div>
      )}
    </main>
  );
}
