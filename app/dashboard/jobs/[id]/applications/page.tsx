// app/dashboard/jobs/[id]/applications/page.tsx

import Link from "next/link";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { notFound } from "next/navigation";
import { fromNow } from "@/lib/dates";
import InterestSelect from "./InterestSelect";
import ActionsMenu from "./ActionsMenu";
import { Phone, FileText as FileTextIcon, Search } from "lucide-react";
import JobActionsMenu from "@/components/dashboard/JobActionsMenu";

/** Normaliza a slug simple para comparar skills */
function slugSkill(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Convierte ["Req: Python","Nice: AWS","Req: React"] → mapa { python:{required:true}, aws:{required:false}, ... } */
function buildJobSkillMap(jobSkills: string[] | null | undefined) {
  const map = new Map<string, { required: boolean; name: string }>();
  for (const raw of jobSkills ?? []) {
    const s = String(raw || "").trim();
    if (!s) continue;
    let required = false;
    let name = s;

    const m = s.match(/^(req(uired)?|nice|deseable)\s*:\s*(.+)$/i);
    if (m) {
      const tag = m[1].toLowerCase();
      name = m[3].trim();
      required = tag.startsWith("req");
    }

    const key = slugSkill(name);
    if (!map.has(key) || required) map.set(key, { required, name });
  }
  return map;
}

/** Une y normaliza TODAS las listas de skills del candidato en un solo arreglo plano */
function gatherCandidateSkills(
  c:
    | {
        skills?: string[] | null;
        certifications?: string[] | null;
        candidateSkills?: { term: { label: string } }[] | null;
      }
    | null
    | undefined
) {
  const fromRelations = (c?.candidateSkills ?? []).map((cs) => cs.term.label);
  const flat = [...(c?.certifications ?? []), ...fromRelations]
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  // quitar duplicados por slug
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of flat) {
    const key = slugSkill(s);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** Devuelve SOLO skills coincidentes candidato↔vacante con etiqueta required/nice */
function intersectSkillsOnlyMatches(
  candidateSkills: string[] | null | undefined,
  jobSkills: string[] | null | undefined,
  limit = 8
) {
  const out: Array<{ name: string; required: boolean }> = [];
  const candList = (candidateSkills ?? []).map((s) => String(s || "").trim()).filter(Boolean);
  if (!candList.length) return out;

  const jobMap = buildJobSkillMap(jobSkills);
  for (const raw of candList) {
    const key = slugSkill(raw);
    if (jobMap.has(key)) {
      const meta = jobMap.get(key)!;
      out.push({ name: meta.name, required: meta.required });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Score simple */
function computeMatchScore(
  candidateSkills: string[] | null | undefined,
  jobSkills: string[] | null | undefined
) {
  const jobMap = buildJobSkillMap(jobSkills);
  if (jobMap.size === 0) return 0;

  const req = [...jobMap.values()].filter((v) => v.required);
  const universe = req.length > 0 ? req : [...jobMap.values()];
  const cand = new Set((candidateSkills ?? []).map(slugSkill));

  let hits = 0;
  for (const v of universe) if (cand.has(slugSkill(v.name))) hits++;
  return Math.round((hits / universe.length) * 100);
}

function matchLabel(score: number) {
  if (score >= 90) return "Muy alto";
  if (score >= 70) return "Alto";
  if (score >= 40) return "Medio";
  if (score > 0) return "Bajo";
  return "Sin datos";
}

/** Niveles de idioma (para mostrar en los chips de candidato) */
const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional",
  CONVERSATIONAL: "Conversacional",
  BASIC: "Básico",
};

/** Seguridad: si no está el campo en DB, caer en REVIEW por defecto */
type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";
const INTEREST_LABEL: Record<InterestKey, string> = {
  REVIEW: "En revisión",
  MAYBE: "En duda",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
};
function getAppInterest(a: any): InterestKey {
  const raw = (a?.recruiterInterest ?? "").toString().toUpperCase();
  if (raw === "MAYBE" || raw === "ACCEPTED" || raw === "REJECTED") return raw;
  return "REVIEW";
}

type SortKey = "match" | "recent" | "name";

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    interest?: InterestKey | "ALL";
    q?: string;
    sort?: SortKey | string;
  };
}) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-10">
          <div className="glass-card rounded-2xl border border-dashed p-4 md:p-6 text-center">
            <p className="mb-1 text-base font-medium text-zinc-800">
              No hay empresa asociada a tu sesión.
            </p>
            <p className="text-sm text-zinc-600">
              Pide al administrador que asigne tu usuario a una empresa.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Validar que la vacante pertenezca a mi empresa
  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: {
      id: true,
      title: true,
      status: true,
      company: { select: { name: true } },
      skills: true,
      requiredSkills: {
        select: {
          must: true,
          term: { select: { label: true } },
        },
      },
      // ✅ para saber si esta vacante usa assessment y cuál template
      assessments: {
        orderBy: { createdAt: "asc" },
        select: { templateId: true },
      },
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!job) notFound();

  const chosenTemplateId = job.assessments?.[0]?.templateId ?? null;
  const assessmentEnabled = Boolean(chosenTemplateId);

  // Unificar skills: array simple + catálogo (Req/Nice)
  const jobAllSkills: string[] = [
    ...(job.skills ?? []),
    ...job.requiredSkills.map((rs) => `${rs.must ? "Req: " : "Nice: "}${rs.term.label}`),
  ];

  // Traer todas las apps
  const allApps = await prisma.application.findMany({
    where: { jobId: job.id, job: { companyId } },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          resumeUrl: true,
          phone: true,
          location: true,
          certifications: true,
          candidateSkills: { select: { term: { select: { label: true } } } },
          candidateLanguages: {
            select: {
              level: true,
              term: { select: { label: true } },
            },
          },
        },
      },
    },
  });

  // ✅ mapa por app para mostrar chip/estado
  type AssessmentRowMeta = {
    enabled: boolean;
    templateId: string;
    state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
    token: string | null;
    attemptId: string | null;
    score: number | null;
  };

  const assessmentByAppId = new Map<string, AssessmentRowMeta>();

  if (assessmentEnabled && chosenTemplateId && allApps.length) {
    const applicationIds = allApps.map((a) => a.id);
    const now = new Date();

    const [invites, attempts] = await Promise.all([
      prisma.assessmentInvite.findMany({
        where: {
          applicationId: { in: applicationIds },
          templateId: chosenTemplateId,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          applicationId: true,
          token: true,
          status: true,
          expiresAt: true,
          updatedAt: true,
        },
      }),
      prisma.assessmentAttempt.findMany({
        where: {
          applicationId: { in: applicationIds },
          templateId: chosenTemplateId,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          applicationId: true,
          status: true,
          totalScore: true,
          updatedAt: true,
          expiresAt: true, // ✅ para poder marcar EXPIRED
        },
      }),
    ]);

    const statusRank = (s: any) => {
      const v = String(s || "").toUpperCase();
      if (v === "SUBMITTED" || v === "EVALUATED" || v === "COMPLETED") return 3; // final
      if (v === "IN_PROGRESS") return 2;
      if (v === "NOT_STARTED") return 1;
      return 0;
    };

    const isFinalInvite = (s: any) => {
      const v = String(s || "").toUpperCase();
      return v === "SUBMITTED" || v === "EVALUATED" || v === "COMPLETED";
    };

    const attemptMap = new Map<string, (typeof attempts)[number]>();

    for (const a of attempts) {
      if (!a.applicationId) continue;

      const prev = attemptMap.get(a.applicationId);
      if (!prev) {
        attemptMap.set(a.applicationId, a);
        continue;
      }

      const ra = statusRank(a.status);
      const rp = statusRank(prev.status);

      // gana el de mayor rango; si empatan, el más reciente (ya vienen desc)
      if (ra > rp) {
        attemptMap.set(a.applicationId, a);
        continue;
      }

      if (ra === rp) {
        attemptMap.set(a.applicationId, a);
      }
    }

    const inviteMap = new Map<string, (typeof invites)[number]>();
    for (const inv of invites) {
      if (!inv.applicationId) continue;
      if (!inviteMap.has(inv.applicationId)) inviteMap.set(inv.applicationId, inv);
    }

    for (const appId of applicationIds) {
      const at = attemptMap.get(appId);
      const iv = inviteMap.get(appId);

      // ✅ higiene: expirado por attempt solo por expiresAt (sin depender del status)
      const attemptExpired = !!at?.expiresAt && new Date(at.expiresAt) <= now;

      // ✅ expirado por invite
      const inviteExpired = !!iv?.expiresAt && new Date(iv.expiresAt) <= now;

      // COMPLETED si el attempt ya fue enviado/evaluado
      if (
        at &&
        (at.status === "SUBMITTED" || at.status === "EVALUATED" || at.status === "COMPLETED")
      ) {
        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: "COMPLETED",
          token: iv?.token ?? null,
          attemptId: at.id,
          score: at.totalScore ?? null,
        });
        continue;
      }

      // ✅ si expiró (por attempt o invite), debe ganar EXPIRED
      if (attemptExpired || inviteExpired) {
        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: "EXPIRED",
          token: iv?.token ?? null,
          attemptId: at?.id ?? null,
          score: null,
        });
        continue;
      }

      // STARTED si el attempt va en progreso
      if (at && at.status === "IN_PROGRESS") {
        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state: "STARTED",
          token: iv?.token ?? null,
          attemptId: at.id,
          score: null,
        });
        continue;
      }

      // INVITE existente (no expirado)
      if (iv) {
        const invStatus = String(iv.status || "").toUpperCase();

        // ✅ ajuste lógica: CANCELLED (y similares) -> EXPIRED/inactivo
        if (invStatus === "CANCELLED" || invStatus === "REVOKED") {
          assessmentByAppId.set(appId, {
            enabled: true,
            templateId: chosenTemplateId,
            state: "EXPIRED",
            token: iv.token ?? null,
            attemptId: at?.id ?? null,
            score: null,
          });
          continue;
        }

        // ✅ ajuste lógica: invite final aunque no haya attempt -> COMPLETED
        if (isFinalInvite(iv.status)) {
          assessmentByAppId.set(appId, {
            enabled: true,
            templateId: chosenTemplateId,
            state: "COMPLETED",
            token: iv.token ?? null,
            attemptId: at?.id ?? null,
            score: at?.totalScore ?? null,
          });
          continue;
        }

        const state = invStatus === "STARTED" ? "STARTED" : "SENT";

        assessmentByAppId.set(appId, {
          enabled: true,
          templateId: chosenTemplateId,
          state,
          token: iv.token ?? null,
          attemptId: null,
          score: null,
        });
        continue;
      }

      // NONE
      assessmentByAppId.set(appId, {
        enabled: true,
        templateId: chosenTemplateId,
        state: "NONE",
        token: null,
        attemptId: null,
        score: null,
      });
    }
  }

  // Contadores por interés derivado (no dependen de búsqueda)
  const counters: Record<InterestKey, number> = {
    REVIEW: 0,
    MAYBE: 0,
    ACCEPTED: 0,
    REJECTED: 0,
  };
  for (const a of allApps) counters[getAppInterest(a)]++;
  const total = allApps.length;

  // Parámetros de filtro/orden
  const interestParam = searchParams?.interest as string | undefined;
  const chosenInterest: InterestKey | undefined = !interestParam
    ? ("REVIEW" as InterestKey)
    : interestParam === "ALL"
    ? undefined
    : (interestParam as InterestKey);

  const qParam = (searchParams?.q ?? "").toString();
  const q = qParam.trim().toLowerCase();

  const sortParamRaw = (searchParams?.sort as string | undefined) ?? "match";
  const sortKey: SortKey = sortParamRaw === "recent" || sortParamRaw === "name" ? sortParamRaw : "match";

  // Enriquecer apps con meta: skills, score, nombre, última actividad
  let enriched = allApps.map((a) => {
    const candSkills = gatherCandidateSkills(a.candidate as any);
    const matched = intersectSkillsOnlyMatches(candSkills, jobAllSkills, 8);
    const score = computeMatchScore(candSkills, jobAllSkills);

    const fullName =
      a.candidate?.name ||
      [(a.candidate as any)?.firstName, (a.candidate as any)?.lastName].filter(Boolean).join(" ") ||
      "—";

    const lastActivity = a.createdAt;

    return {
      ...a,
      _candSkills: candSkills,
      _matched: matched,
      _score: score,
      _fullName: fullName,
      _lastActivity: lastActivity,
    };
  });

  // Filtro por interés
  if (chosenInterest) {
    enriched = enriched.filter((a) => getAppInterest(a) === chosenInterest);
  }

  // Filtro por búsqueda (nombre, email, ciudad, skills)
  if (q) {
    enriched = enriched.filter((a) => {
      const textParts = [a._fullName ?? "", a.candidate?.email ?? "", a.candidate?.location ?? "", (a._candSkills ?? []).join(" ")];
      const haystack = textParts.join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  // Orden
  const apps = [...enriched].sort((a, b) => {
    if (sortKey === "recent") {
      return new Date(b._lastActivity).getTime() - new Date(a._lastActivity).getTime();
    }
    if (sortKey === "name") {
      return (a._fullName || "").localeCompare(b._fullName || "", "es", { sensitivity: "base" });
    }
    return (b._score ?? 0) - (a._score ?? 0);
  });

  // Hrefs siempre absolutos, preservando q y sort
  const buildInterestHref = (i?: InterestKey | "ALL") => {
    const usp = new URLSearchParams();
    if (i) usp.set("interest", i);
    if (qParam) usp.set("q", qParam);
    if (sortKey) usp.set("sort", sortKey);
    return `/dashboard/jobs/${job.id}/applications${usp.toString() ? `?${usp.toString()}` : ""}`;
  };

  const buildSortHref = (sort: SortKey) => {
    const usp = new URLSearchParams();
    if (interestParam) usp.set("interest", interestParam);
    if (qParam) usp.set("q", qParam);
    usp.set("sort", sort);
    return `/dashboard/jobs/${job.id}/applications${usp.toString() ? `?${usp.toString()}` : ""}`;
  };

  const headerBtnClasses =
    "inline-flex items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white/80 px-5 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900";

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] space-y-8 px-6 py-8 lg:px-10">
        {/* Header vacante */}
        <header className="space-y-4">
          {/* Título y descripción */}
          <div>
            <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {job.company?.name ?? "—"}
              {job.location ? ` · ${job.location}` : ""} · Publicada {fromNow(job.createdAt)} · Actualizada {fromNow(job.updatedAt)}
            </p>
          </div>

          {/* Botones en una fila completa debajo */}
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Link href={`/dashboard/jobs/${job.id}`} className={headerBtnClasses}>
              Ver Pipeline
            </Link>
            <Link href={`/jobs/${job.id}`} target="_blank" className={headerBtnClasses}>
              Ver vacante
            </Link>
            <Link href="/dashboard/jobs" className={headerBtnClasses}>
              Volver a Vacantes
            </Link>
            {/* 🎯 Menú de acciones */}
            <JobActionsMenu jobId={job.id} currentStatus={job.status} />
          </div>
        </header>

        {/* Tabs por interés */}
        <section className="glass-card rounded-2xl border p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={interestParam === "ALL"} href={buildInterestHref("ALL")} label={`Todos (${total})`} />
            <FilterPill active={chosenInterest === "REVIEW"} href={buildInterestHref("REVIEW")} label={`En revisión (${counters.REVIEW})`} />
            <FilterPill active={chosenInterest === "MAYBE"} href={buildInterestHref("MAYBE")} label={`En duda (${counters.MAYBE})`} />
            <FilterPill active={chosenInterest === "ACCEPTED"} href={buildInterestHref("ACCEPTED")} label={`Aceptados (${counters.ACCEPTED})`} />
            <FilterPill active={chosenInterest === "REJECTED"} href={buildInterestHref("REJECTED")} label={`Rechazados (${counters.REJECTED})`} />
          </div>
        </section>

        {/* Tabla / Lista */}
        {apps.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-4 text-center md:p-6">
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
              {chosenInterest ? `Sin candidatos en ${INTEREST_LABEL[chosenInterest]}.` : "Aún no hay postulaciones para esta vacante."}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Usa el botón &ldquo;Ver vacante&rdquo; para compartirla y recibir postulaciones.
            </p>

          </div>
        ) : (
          <div
            className="
              rounded-2xl border border-zinc-100 bg-white/90
              p-4 shadow-sm backdrop-blur-sm
              dark:border-zinc-800 dark:bg-zinc-950/70
            "
          >
            {/* Barra de herramientas */}
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <form method="get" className="relative w-full max-w-xs text-sm">
                {interestParam && <input type="hidden" name="interest" value={interestParam} />}
                {sortKey && <input type="hidden" name="sort" value={sortKey} />}
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  name="q"
                  defaultValue={qParam}
                  className="w-full rounded-full border border-zinc-200 bg-white/70 py-1.5 pl-7 pr-3 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  placeholder="Buscar candidato, email, ciudad o skill…"
                />
              </form>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Ordenar por:</span>
                <div className="inline-flex rounded-full bg-zinc-100/60 p-0.5 text-xs dark:bg-zinc-900/70">
                  <SortPill href={buildSortHref("match")} active={sortKey === "match"}>
                    Match
                  </SortPill>
                  <SortPill href={buildSortHref("recent")} active={sortKey === "recent"}>
                    Actividad
                  </SortPill>
                  <SortPill href={buildSortHref("name")} active={sortKey === "name"}>
                    Nombre
                  </SortPill>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <tr>
                    <th className="py-2 px-3">Candidato</th>
                    <th className="py-2 px-3">Match</th>
                    <th className="py-2 px-3">Skills (coincidentes)</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Actividad</th>
                    <th className="py-2 px-3">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {apps.map((a: any) => {
                    const matched: Array<{ name: string; required: boolean }> = a._matched ?? [];
                    const shown = matched.slice(0, 4);
                    const hiddenCount = Math.max(0, matched.length - shown.length);
                    const score: number = a._score ?? 0;

                    const candidateHref = a.candidate?.id
                      ? `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`
                      : undefined;

                    const fullName: string = a._fullName ?? "—";
                    const lastActivity = a._lastActivity ?? a.createdAt;

                    const languages = a.candidate?.candidateLanguages ?? [];
                    const phone = a.candidate?.phone as string | undefined;
                    const resumeUrl = a.candidate?.resumeUrl as string | undefined;
                    const hasWhatsApp = phone?.trim().startsWith("+52");

                    const assessMeta = assessmentEnabled && chosenTemplateId ? assessmentByAppId.get(a.id) ?? null : null;

                    return (
                      <tr key={a.id} className="align-top border-t border-zinc-100 dark:border-zinc-800">
                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            {candidateHref ? (
                              <Link href={candidateHref} className="font-medium hover:underline" title="Ver detalle del candidato">
                                {fullName}
                              </Link>
                            ) : (
                              <span className="font-medium">{fullName}</span>
                            )}

                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{a.candidate?.location ?? "—"}</span>

                            {languages.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {languages.slice(0, 2).map((l: any) => (
                                  <span
                                    key={`${l.term.label}-${l.level}`}
                                    className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                                  >
                                    {l.term.label} {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
                                  </span>
                                ))}
                                {languages.length > 2 && (
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">+{languages.length - 2}</span>
                                )}
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {phone && (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-200"
                                  title={`Tel: ${phone}`}
                                >
                                  <Phone className="h-3 w-3" />
                                </span>
                              )}
                              {resumeUrl && (
                                <a
                                  href={resumeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                                  title="Ver CV"
                                >
                                  <FileTextIcon className="h-3 w-3" />
                                </a>
                              )}
                              {hasWhatsApp && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                  WhatsApp
                                </span>
                              )}
                            </div>

                            {/* ✅ Chip híbrido: solo si la vacante usa assessment y el candidato ya tiene algo (no NONE) */}
                            {assessMeta?.enabled && assessMeta.state !== "NONE" && (
                              <div className="mt-1">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
                                    assessMeta.state === "COMPLETED"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
                                      : assessMeta.state === "STARTED"
                                      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-900/20 dark:text-sky-200"
                                      : assessMeta.state === "EXPIRED"
                                      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
                                      : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-900/20 dark:text-violet-200",
                                  ].join(" ")}
                                  title="Estado del assessment"
                                >
                                  {assessMeta.state === "COMPLETED"
                                    ? `Assessment: ${typeof assessMeta.score === "number" ? `${assessMeta.score}%` : "OK"}`
                                    : assessMeta.state === "STARTED"
                                    ? "Assessment: iniciado"
                                    : assessMeta.state === "EXPIRED"
                                    ? "Assessment: expirado"
                                    : "Assessment: enviado"}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <div className="min-w-[110px]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{score}%</span>
                              <div className="h-1.5 w-20 rounded bg-zinc-200/60 dark:bg-zinc-700/50">
                                <div
                                  className="h-1.5 rounded bg-emerald-500"
                                  style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
                                  aria-label={`Match ${score}%`}
                                />
                              </div>
                            </div>
                            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{matchLabel(score)}</p>
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          {shown.length ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {shown.map((s, i) => {
                                const cls = s.required
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:border-emerald-600/60 dark:bg-emerald-900/20 dark:text-emerald-200"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200";
                                return (
                                  <span
                                    key={`${s.name}-${i}`}
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}
                                    title={s.required ? "Requerida en la vacante" : "Deseable en la vacante"}
                                  >
                                    {s.required && (
                                      <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide">Req</span>
                                    )}
                                    {s.name}
                                  </span>
                                );
                              })}
                              {hiddenCount > 0 && (
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">+{hiddenCount}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">—</span>
                          )}
                        </td>

                        <td className="py-2 px-3">
                          <div className="inline-flex min-w-[130px] max-w-[150px] text-sm">
                            <InterestSelect applicationId={a.id} initial={getAppInterest(a)} />
                          </div>
                        </td>

                        <td
                          className="py-2 px-3 text-sm text-zinc-600 dark:text-zinc-400"
                          title={new Date(lastActivity).toLocaleString()}
                        >
                          {fromNow(lastActivity)}
                        </td>

                        <td className="py-2 px-3 align-top">
                          <ActionsMenu
                            applicationId={a.id}
                            jobId={job.id}
                            candidateHref={candidateHref}
                            resumeUrl={resumeUrl ?? null}
                            candidateEmail={a.candidate?.email ?? ""}
                            candidatePhone={phone ?? null}
                            assessment={
                              assessmentEnabled && chosenTemplateId
                                ? ({
                                    enabled: true,
                                    templateId: chosenTemplateId,
                                    state: (assessMeta?.state ?? "NONE") as any,
                                    token: assessMeta?.token ?? null,
                                    attemptId: assessMeta?.attemptId ?? null,
                                  } as any)
                                : ({ enabled: false } as any)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* =================== UI subcomponentes (server-safe) =================== */

function FilterPill({
  active,
  href,
  label,
}: {
  active?: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-w-[130px] items-center justify-center rounded-full px-4 py-1.5 text-sm border transition
        ${
          active
            ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
            : "border-zinc-200 bg-transparent text-zinc-700 hover:bg-zinc-100/70 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-900/60"
        }`}
    >
      {label}
    </Link>
  );
}

function SortPill({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 text-xs rounded-full transition ${
        active
          ? "bg-white text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-200"
          : "text-zinc-600 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
      }`}
    >
      {children}
    </Link>
  );
}
