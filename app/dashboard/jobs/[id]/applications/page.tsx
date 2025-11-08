// app/dashboard/jobs/[id]/applications/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { notFound } from "next/navigation";
import { fromNow } from "@/lib/dates";
import InterestSelect from "./InterestSelect";        // cliente (dropdown estado)
import ActionsMenu from "./ActionsMenu";              // cliente (menú de 3 puntos)

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
function gatherCandidateSkills(c: {
  skills?: string[] | null;
  certifications?: string[] | null;
  candidateSkills?: { term: { label: string } }[] | null;
} | null | undefined) {
  const fromRelations = (c?.candidateSkills ?? []).map((cs) => cs.term.label);
  const flat = [
    ...(c?.skills ?? []),
    ...(c?.certifications ?? []),
    ...fromRelations,
  ]
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
function computeMatchScore(candidateSkills: string[] | null | undefined, jobSkills: string[] | null | undefined) {
  const jobMap = buildJobSkillMap(jobSkills);
  if (jobMap.size === 0) return 0;

  const req = [...jobMap.values()].filter((v) => v.required);
  const universe = req.length > 0 ? req : [...jobMap.values()];
  const cand = new Set((candidateSkills ?? []).map(slugSkill));

  let hits = 0;
  for (const v of universe) if (cand.has(slugSkill(v.name))) hits++;
  return Math.round((hits / universe.length) * 100);
}

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

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { interest?: InterestKey | "ALL" };
}) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-10">
          <div className="rounded-2xl border border-dashed p-8 text-center glass-card p-4 md:p-6">
            <p className="text-base font-medium text-zinc-800">No hay empresa asociada a tu sesión.</p>
            <p className="mt-1 text-sm text-zinc-600">Pide al administrador que asigne tu usuario a una empresa.</p>
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
      company: { select: { name: true } },
      skills: true, // array simple
      requiredSkills: {
        select: {
          must: true,
          term: { select: { label: true } },
        },
      },
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!job) notFound();

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
          skills: true,
          certifications: true,
          // 👇 relación de catálogo
          candidateSkills: { select: { term: { select: { label: true } } } },
        },
      },
    },
  });

  // Contadores por interés derivado
  const counters: Record<InterestKey, number> = { REVIEW: 0, MAYBE: 0, ACCEPTED: 0, REJECTED: 0 };
  for (const a of allApps) counters[getAppInterest(a)]++;
  const total = allApps.length;

  // Filtro por interés con centinela "ALL"
  const interestParam = searchParams?.interest as string | undefined;
  const chosenInterest: InterestKey | undefined =
    !interestParam            ? ("REVIEW" as InterestKey)
    : interestParam === "ALL" ? undefined
    : (interestParam as InterestKey);

  const apps = chosenInterest ? allApps.filter((a) => getAppInterest(a) === chosenInterest) : allApps;

  // Hrefs siempre absolutos. Para "Todos" usamos ?interest=ALL
  const buildInterestHref = (i?: InterestKey | "ALL") => {
    const usp = new URLSearchParams();
    if (i) usp.set("interest", i);
    return `/dashboard/jobs/${job.id}/applications${usp.toString() ? `?${usp.toString()}` : ""}`;
  };

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-8 space-y-8">

        {/* Header vacante */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
            <p className="text-sm text-zinc-600">
              {job.company?.name ?? "—"}
              {job.location ? ` · ${job.location}` : ""} · Publicada {fromNow(job.createdAt)} · Actualizada {fromNow(job.updatedAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
              <MetricBadge label="Recibidas" value={total} />
              <MetricBadge label="En revisión" value={counters.REVIEW} />
              <MetricBadge label="En duda" value={counters.MAYBE} />
              <MetricBadge label="Aceptados" value={counters.ACCEPTED} />
              <MetricBadge label="Rechazados" value={counters.REJECTED} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/jobs/${job.id}`}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Ver Kanban
            </Link>
            <Link href="/dashboard/jobs" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              Volver a Vacantes
            </Link>
          </div>
        </header>

        {/* Tabs por interés */}
        <section className="rounded-2xl border glass-card p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={interestParam === "ALL"} href={buildInterestHref("ALL")} label={`Todos (${total})`} />
            <FilterPill active={chosenInterest === "REVIEW"}   href={buildInterestHref("REVIEW")}   label={`En revisión (${counters.REVIEW})`} />
            <FilterPill active={chosenInterest === "MAYBE"}    href={buildInterestHref("MAYBE")}    label={`En duda (${counters.MAYBE})`} />
            <FilterPill active={chosenInterest === "ACCEPTED"} href={buildInterestHref("ACCEPTED")} label={`Aceptados (${counters.ACCEPTED})`} />
            <FilterPill active={chosenInterest === "REJECTED"} href={buildInterestHref("REJECTED")} label={`Rechazados (${counters.REJECTED})`} />
          </div>
        </section>

        {/* Tabla / Lista */}
        {apps.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center glass-card p-4 md:p-6">
            <p className="text-base font-medium text-zinc-800">
              {chosenInterest ? `Sin candidatos en “${INTEREST_LABEL[chosenInterest]}”.` : "Aún no hay postulaciones para esta vacante."}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Cuando lleguen postulaciones las verás aquí.</p>
          </div>
        ) : (
          <div className="rounded-2xl border glass-card p-4 md:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-zinc-600">
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
                  {apps.map((a) => {
                    // ✅ unimos skills del candidato (simples + catálogo + certificaciones)
                    const candSkills = gatherCandidateSkills(a.candidate as any);
                    // ✅ comparamos contra el set unificado de la vacante
                    const matched = intersectSkillsOnlyMatches(candSkills, jobAllSkills, 8);
                    const shown = matched.slice(0, 5);
                    const hiddenCount = Math.max(0, matched.length - shown.length);
                    const score = computeMatchScore(candSkills, jobAllSkills);

                    const candidateHref = a.candidate?.id
                      ? `/dashboard/candidates/${a.candidate.id}?jobId=${job.id}&applicationId=${a.id}`
                      : undefined;

                    return (
                      <tr key={a.id} className="border-t align-top">
                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            {candidateHref ? (
                              <Link href={candidateHref} className="font-medium hover:underline" title="Ver detalle del candidato">
                                {a.candidate?.name ?? "—"}
                              </Link>
                            ) : (
                              <span className="font-medium">{a.candidate?.name ?? "—"}</span>
                            )}
                            <span className="text-xs text-zinc-500">
                              {a.candidate?.location ?? "—"}
                            </span>
                            {a.status && (
                              <span className="mt-1 inline-flex w-max items-center rounded-full border bg-gray-50 px-2 py-0.5 text-[10px]" title="Estado del pipeline">
                                {a.status}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <div className="min-w-[88px]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{score}%</span>
                              <div className="h-1.5 w-20 rounded bg-zinc-200/60 dark:bg-zinc-700/50 rounded">
                                <div
                                  className="h-1.5 bg-emerald-500"
                                  style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
                                  aria-label={`Match ${score}%`}
                                />
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          {shown.length ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {shown.map((s, i) => {
                                const cls = s.required
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "glass-card p-4 md:p-6";
                                return (
                                  <span
                                    key={`${s.name}-${i}`}
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}
                                    title={s.required ? "Requerida en la vacante" : "Deseable en la vacante"}
                                  >
                                    {s.name}
                                  </span>
                                );
                              })}
                              {hiddenCount > 0 && <span className="text-[11px] text-zinc-500">+{hiddenCount}</span>}
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="py-2 px-3">
                          <InterestSelect applicationId={a.id} initial={getAppInterest(a)} />
                        </td>

                        <td className="py-2 px-3" title={new Date(a.updatedAt ?? a.createdAt).toLocaleString()}>
                          {fromNow(a.updatedAt ?? a.createdAt)}
                        </td>

                        <td className="py-2 px-3">
                          <ActionsMenu
                            applicationId={a.id}
                            candidateHref={candidateHref}
                            resumeUrl={a.candidate?.resumeUrl}
                            candidateEmail={a.candidate?.email ?? ""}
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
function FilterPill({ active, href, label }: { active?: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
          : "glass-card p-4 md:p-6"
      }`}
    >
      {label}
    </Link>
  );
}

function MetricBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 badge border border-zinc-200 ">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-xs font-semibold text-zinc-800">{value}</span>
    </span>
  );
}
