// app/dashboard/candidates/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { redirect, notFound } from "next/navigation";
import { prisma } from '@/lib/server/prisma';
import Link from "next/link";
import {
  computeMatchScore,
  applyPlanGate,
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  type BillingPlan,
  type JobSkillInput,
  type CandidateSkillInput,
} from "@/lib/ai/matchScore";
import { Lock, CheckCircle2, XCircle } from "lucide-react";

export const metadata = { title: "Candidato | Panel" };

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

const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: "Gratis",
  STARTER: "Starter",
  PRO: "Pro",
};

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { applicationId?: string; jobId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/candidates");

  const me = await prisma.user.findUnique({
    where: { email: session.user?.email! },
    select: { id: true, role: true, companyId: true },
  });
  if (!me || (me.role !== "RECRUITER" && me.role !== "ADMIN")) redirect("/");
  const companyId = me.companyId ?? null;

  // ✅ Plan de la empresa para gate
  const company = companyId
    ? await prisma.company.findUnique({
        where: { id: companyId },
        select: { billingPlan: true },
      })
    : null;
  const plan = (company?.billingPlan ?? "FREE") as BillingPlan;

  // Candidato
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
      certifications: true,
      candidateSkills: {
        select: {
          id: true,
          level: true,
          term: { select: { id: true, label: true } }, // ✅ id para engine
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

  // ✅ Si viene jobId, traer skills de la vacante para el breakdown
  const fromJobId = searchParams?.jobId;
  let jobForMatch: {
    id: string;
    title: string;
    requiredSkills: JobSkillInput[];
  } | null = null;

  if (fromJobId && companyId) {
    const jobRaw = await prisma.job.findFirst({
      where: { id: fromJobId, companyId },
      select: {
        id: true,
        title: true,
        requiredSkills: {
          select: {
            must: true,
            weight: true,
            term: { select: { id: true, label: true } },
          },
        },
      },
    });
    if (jobRaw) {
      jobForMatch = {
        id: jobRaw.id,
        title: jobRaw.title,
        requiredSkills: jobRaw.requiredSkills.map((rs) => ({
          termId: rs.term.id,
          label: rs.term.label,
          must: rs.must,
          weight: rs.weight,
        })),
      };
    }
  }

  // ✅ Calcular match si tenemos vacante
  const candidateSkillsForEngine: CandidateSkillInput[] = candidate.candidateSkills.map((cs) => ({
    termId: cs.term.id,
    label: cs.term.label,
    level: cs.level,
  }));

  const matchResult =
    jobForMatch && jobForMatch.requiredSkills.length > 0
      ? computeMatchScore(jobForMatch.requiredSkills, candidateSkillsForEngine)
      : null;

  // Gate de plan: esta es la vista de 1 candidato específico, rank=0 siempre
  // (el reclutador está viendo un perfil directamente, no en lista)
  // Lógica: FREE = bloqueado, STARTER+ = visible
  const matchLocked = plan === "FREE";
  const gatedScore = matchResult && !matchLocked ? matchResult.score : null;

  // Postulaciones del candidato en mi empresa
  const myApps = companyId
    ? await prisma.application.findMany({
        where: { candidateId: candidate.id, job: { companyId } },
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

  const activeAppId = searchParams?.applicationId || "";
  const activeApp = activeAppId
    ? await prisma.application.findFirst({
        where: { id: activeAppId, job: { companyId: companyId ?? "" } },
        select: { id: true },
      })
    : null;

  // UI helpers
  const Pill = ({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) => (
    <span className={highlight
      ? "inline-block text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5 mr-2 mb-2 dark:bg-emerald-900/20 dark:text-emerald-100 dark:border-emerald-500/40"
      : "inline-block text-[11px] bg-gray-50 text-zinc-700 border border-zinc-200 rounded-full px-2 py-0.5 mr-2 mb-2 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700"
    }>
      {children}
    </span>
  );

  const List = ({ items, emptyLabel = "—" }: { items?: string[] | null; emptyLabel?: string }) =>
    items && items.length ? (
      <div className="mt-2">{items.map((s) => <Pill key={s}>{s}</Pill>)}</div>
    ) : (
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>
    );

  const waHref = candidate.phone
    ? `https://wa.me/${candidate.phone.replace(/^\+/, "")}?text=${encodeURIComponent(`Hola ${candidate.name ?? ""}, te contacto por una oportunidad laboral.`)}`
    : null;

  const pdfSrc = candidate.resumeUrl
    ? `${candidate.resumeUrl}${candidate.resumeUrl.includes("#") ? "" : "#toolbar=1&navpanes=0&scrollbar=1"}`
    : null;

  function buildRequiredSnapshot(jobSkills: string[] | null | undefined, candSkills: string[] | null | undefined) {
    const reqNames = new Set(
      (jobSkills || []).filter((s) => s.toLowerCase().startsWith("req:")).map((s) => s.slice(4).trim().toLowerCase()).filter(Boolean)
    );
    const cand = candSkills || [];
    const matches: string[] = [];
    const seen = new Set<string>();
    for (const s of cand) {
      const key = s.toLowerCase();
      if (!seen.has(key) && reqNames.has(key)) { matches.push(s); seen.add(key); }
    }
    const others: string[] = [];
    for (const s of cand) {
      const key = s.toLowerCase();
      if (!seen.has(key)) { others.push(s); seen.add(key); }
      if (matches.length + others.length >= 4) break;
    }
    return { matches: matches.slice(0, 4), others: others.slice(0, Math.max(0, 4 - matches.length)) };
  }

  const headerBtnClasses =
    "inline-flex items-center justify-center gap-1 rounded-full border border-zinc-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900";

  const detailedSkills = (candidate.candidateSkills || [])
    .map((s) => ({ id: s.id, label: s.term?.label || "", level: s.level ?? null, termId: s.term?.id || "" }))
    .filter((s) => s.label);

  const candidateSkillNames = detailedSkills.map((s) => s.label);

  const languageItems = (candidate.candidateLanguages || [])
    .map((cl) => {
      const label = cl.term?.label || "";
      const levelKey = cl.level || "";
      if (!label && !levelKey) return null;
      const levelLabel = LEVEL_LABEL[levelKey] ?? (levelKey ? levelKey : "");
      return levelLabel ? `${label} · ${levelLabel}` : label;
    })
    .filter(Boolean) as string[];

  // ✅ Separar skills para el breakdown: matched / missing
  const matchedDetails = matchResult?.details.filter((d) => d.matched) ?? [];
  const missingRequired = matchResult?.details.filter((d) => !d.matched && d.must) ?? [];
  const missingNice = matchResult?.details.filter((d) => !d.matched && !d.must) ?? [];

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-6 lg:py-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/90 text-sm font-semibold text-white shadow-sm">
            {candidate.name?.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "C"}
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              {candidate.name || "Candidato"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900/40">{candidate.email}</span>
              {candidate.location && <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900/40">{candidate.location}</span>}
              {candidate.phone && <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900/40">{candidate.phone}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2">
          {fromJobId && (
            <>
              <Link href={`/dashboard/jobs/${fromJobId}/applications`} className={headerBtnClasses}>← Volver a la vacante</Link>
              <Link href={`/dashboard/jobs/${fromJobId}`} className={headerBtnClasses}>Ver Pipeline</Link>
            </>
          )}
          {candidate.resumeUrl ? (
            <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className={headerBtnClasses}>Descargar CV</a>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-500">Sin CV</span>
          )}
          {waHref ? (
            <a href={waHref} target="_blank" rel="noreferrer" className={headerBtnClasses}>WhatsApp</a>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-500">Sin teléfono</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <section className="space-y-6 lg:col-span-2">

          {/* ✅ NUEVO: Tarjeta de AI Match (solo si viene de una vacante) */}
          {jobForMatch && (
            <div className="glass-card border rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  AI Match —{" "}
                  <Link
                    href={`/dashboard/jobs/${jobForMatch.id}/applications`}
                    className="text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {jobForMatch.title}
                  </Link>
                </h2>
                {matchLocked && (
                  <Link
                    href="/dashboard/billing"
                    className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                  >
                    Mejorar plan →
                  </Link>
                )}
              </div>

              {matchLocked ? (
                // FREE: bloqueado
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">AI Match bloqueado en plan Gratis</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Actualiza a Starter o Pro para ver el score detallado de este candidato vs. la vacante.
                    </p>
                  </div>
                </div>
              ) : !matchResult ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  La vacante no tiene skills definidas en el catálogo. Agrégalas en el editor de vacante para activar el AI Match.
                </p>
              ) : (
                <div className="mt-4 space-y-5">
                  {/* Score principal */}
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                      <span className={`text-4xl font-black ${scoreToTextColor(gatedScore!)}`}>
                        {gatedScore}%
                      </span>
                      <span className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {scoreToLabel(gatedScore!)}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2">
                      {/* Barra total */}
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                          <span>Score general</span>
                          <span>{gatedScore}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/50">
                          <div
                            className={`h-2 rounded-full transition-all ${scoreToColor(gatedScore!)}`}
                            style={{ width: `${gatedScore}%` }}
                          />
                        </div>
                      </div>
                      {/* Barra must */}
                      {matchResult.totalRequired > 0 && (
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                            <span>Skills requeridas ({matchResult.totalRequired})</span>
                            <span>{matchResult.mustScore}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/50">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${matchResult.mustScore}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Barra nice */}
                      {matchResult.totalNice > 0 && (
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                            <span>Skills deseables ({matchResult.totalNice})</span>
                            <span>{matchResult.niceScore}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/50">
                            <div
                              className="h-1.5 rounded-full bg-sky-400 transition-all"
                              style={{ width: `${matchResult.niceScore}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Resumen */}
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {matchResult.matchedCount} de {jobForMatch.requiredSkills.length} skills coinciden
                      </p>
                    </div>
                  </div>

                  {/* Breakdown: tiene / le falta */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Skills que tiene */}
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        ✅ Tiene ({matchedDetails.length})
                      </h3>
                      {matchedDetails.length === 0 ? (
                        <p className="text-xs text-zinc-400">Ninguna skill coincide</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {matchedDetails.map((d) => (
                            <span
                              key={d.termId}
                              title={d.must ? "Requerida" : "Deseable"}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                d.must
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-200"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
                              }`}
                            >
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              {d.label}
                              {d.candidateLevel && (
                                <span className="opacity-60">L{d.candidateLevel}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Skills que le faltan */}
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        ❌ Le falta ({missingRequired.length + missingNice.length})
                      </h3>
                      {missingRequired.length === 0 && missingNice.length === 0 ? (
                        <p className="text-xs text-zinc-400">Cubre todas las skills</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {missingRequired.map((d) => (
                            <span
                              key={d.termId}
                              title="Requerida — faltante"
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300"
                            >
                              <XCircle className="h-3 w-3 shrink-0" />
                              {d.label}
                              <span className="text-[9px] font-semibold uppercase opacity-70">Req</span>
                            </span>
                          ))}
                          {missingNice.map((d) => (
                            <span
                              key={d.termId}
                              title="Deseable — faltante"
                              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
                            >
                              <XCircle className="h-3 w-3 shrink-0 opacity-50" />
                              {d.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Información */}
          <div className="glass-card border rounded-2xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Información</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Nombre</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">{candidate.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Email</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">{candidate.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Teléfono</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">{candidate.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Ubicación</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">{candidate.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Fecha de nacimiento</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.birthdate ? new Date(candidate.birthdate).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">LinkedIn</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.linkedin ? (
                    <a className="text-blue-600 hover:underline dark:text-blue-400" href={candidate.linkedin} target="_blank" rel="noreferrer">{candidate.linkedin}</a>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">GitHub</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {candidate.github ? (
                    <a className="text-blue-600 hover:underline dark:text-blue-400" href={candidate.github} target="_blank" rel="noreferrer">{candidate.github}</a>
                  ) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Skills / Certificaciones */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card border rounded-2xl p-4 md:p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Skills</h2>
              {detailedSkills.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {detailedSkills.map((s) => {
                    const levelValue = s.level ?? 0;
                    const pct = Math.max(0, Math.min(100, Math.round(levelValue * 20)));
                    const levelLabel = s.level != null
                      ? SKILL_LEVEL_LABEL[s.level as number] ?? `Nivel ${s.level}`
                      : "Sin nivel";
                    // ✅ Highlight si es skill requerida de la vacante activa
                    const isJobRequired = matchResult?.details.find((d) => d.termId === s.termId && d.must && d.matched);
                    const isJobNice = matchResult?.details.find((d) => d.termId === s.termId && !d.must && d.matched);

                    return (
                      <li key={s.id} className={`soft-panel px-3 py-2 ${isJobRequired ? "ring-1 ring-emerald-400/50 dark:ring-emerald-500/30" : ""}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{s.label}</span>
                            {isJobRequired && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Req
                              </span>
                            )}
                            {isJobNice && !isJobRequired && (
                              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                                Nice
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted">{levelLabel}</span>
                        </div>
                        <div
                          className="mt-2 progress"
                          role="progressbar"
                          aria-label={`Nivel ${levelValue} de 5 en ${s.label}`}
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
              ) : (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Sin skills capturados</p>
              )}
            </div>

            <div className="glass-card border rounded-2xl p-4 md:p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Certificaciones</h2>
              <List items={candidate.certifications} emptyLabel="Sin certificaciones capturadas" />
            </div>
          </div>

          <div className="glass-card border rounded-2xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Idiomas</h2>
            <List items={languageItems} emptyLabel="Sin idiomas capturados" />
          </div>

          {/* CV */}
          {candidate.resumeUrl && (
            <div className="glass-card border rounded-2xl p-4 md:p-6">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">CV</h2>
              <div className="mt-3 overflow-hidden rounded-lg border bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative w-full" style={{ height: "70vh" }}>
                  <iframe src={pdfSrc!} title="Vista previa del CV" className="absolute inset-0 h-full w-full" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className={headerBtnClasses}>Abrir en nueva pestaña</a>
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" download className={headerBtnClasses}>Descargar</a>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Si el visor no carga, el sitio del CV podría bloquear la inserción. Usa "Abrir en nueva pestaña".
              </p>
            </div>
          )}
        </section>

        {/* Panel lateral */}
        <aside className="glass-card h-fit rounded-2xl border p-4 md:p-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Postulaciones recientes (mi empresa)
          </h3>
          {myApps.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">—</p>
          ) : (
            <ul className="space-y-3">
              {myApps.map((a) => {
                const { matches, others } = buildRequiredSnapshot(a.job?.skills, candidateSkillNames);
                const show = [...matches, ...others].slice(0, 4);
                const isActive = a.job?.id === fromJobId;

                return (
                  <li
                    key={a.id}
                    className={`rounded-lg border p-3 text-sm shadow-sm ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-600/40 dark:bg-emerald-950/30"
                        : "border-zinc-200 bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-950/70"
                    }`}
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {a.job?.title} — {a.job?.company?.name ?? "—"}
                      {isActive && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Activa
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Estado: {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                    {show.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {show.map((s) => <Pill key={s} highlight={matches.includes(s)}>{s}</Pill>)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/dashboard/messages?applicationId=${a.id}`}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Mensajes
                      </a>
                      <Link
                        href={`/dashboard/jobs/${a.job?.id}/applications`}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
          <Link href="/dashboard/jobs" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Volver a vacantes
          </Link>
        </div>
      )}
    </main>
  );
}