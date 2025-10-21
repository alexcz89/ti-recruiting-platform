// components/jobs/JobDetailPanel.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Share2,
  Briefcase,
  Clock3,
  Wallet,
  Gift,
  BadgeCheck,
  Wrench,
  Sparkles,
} from "lucide-react";
import { fromNow } from "@/lib/dates";

type DegreeLevel = "HIGHSCHOOL" | "TECH" | "BACHELOR" | "MASTER" | "PHD";
type EduItem = { name: string; required: boolean };

type Job = {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  skills?: string[] | null;

  // Compensación
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  showSalary?: boolean | null;

  // Otros detalles
  schedule?: string | null;
  benefitsJson?: Record<string, boolean | number | string> | null;
  showBenefits?: boolean | null;

  remote?: boolean | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;

  // Educación (puede no venir en lista y lo cargamos lazy)
  minDegree?: DegreeLevel | null;
  educationJson?: EduItem[] | null;
};

type Props = {
  job: Job | null;
  canApply?: boolean;
  editHref?: string;
};

/* ------------------------
   Utils: parseo de [Meta]
-------------------------*/
type MetaParsed = {
  showSalary?: boolean;
  currency?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string | null;
  schedule?: string | null;
  benefits?: Record<string, boolean | number | string> | null;
  certifications?: string[] | null;
};

function parseMeta(description: string | null | undefined): {
  meta: MetaParsed | null;
  mainDesc: string;
} {
  const raw = description ?? "";
  const match = raw.match(/---\s*\[Meta\]([\s\S]*)$/i);
  if (!match) return { meta: null, mainDesc: raw.trim() };

  const metaBlock = match[1].trim();
  const tokens = metaBlock
    .split(/\r?\n/)
    .flatMap((l) => l.split(";"))
    .map((t) => t.trim())
    .filter(Boolean);

  const parsed: MetaParsed = {};
  for (const tok of tokens) {
    const i = tok.indexOf("=");
    if (i < 0) continue;
    const key = tok.slice(0, i).trim();
    const valRaw = tok.slice(i + 1).trim();

    if (valRaw === "true" || valRaw === "false") {
      (parsed as any)[key] = valRaw === "true";
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(valRaw)) {
      (parsed as any)[key] = Number(valRaw);
      continue;
    }
    if (valRaw === "" || valRaw.toLowerCase() === "null") {
      (parsed as any)[key] = null;
      continue;
    }
    if (valRaw.startsWith("{") || valRaw.startsWith("[")) {
      try {
        (parsed as any)[key] = JSON.parse(valRaw);
        continue;
      } catch {}
    }
    (parsed as any)[key] = valRaw;
  }

  const mainDesc = raw.slice(0, match.index).trim();
  return { meta: parsed, mainDesc };
}

/* ------------------------
   Chips y helpers
-------------------------*/
function Chip({
  children,
  tone = "zinc",
  outline = false,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "blue" | "emerald" | "amber" | "violet";
  outline?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    zinc: outline ? "border-zinc-300 text-zinc-700" : "bg-zinc-100 text-zinc-800",
    blue: outline ? "border-blue-300 text-blue-700" : "bg-blue-50 text-blue-700",
    emerald: outline ? "border-emerald-300 text-emerald-700" : "bg-emerald-50 text-emerald-700",
    amber: outline ? "border-amber-300 text-amber-700" : "bg-amber-50 text-amber-700",
    violet: outline ? "border-violet-300 text-violet-700" : "bg-violet-50 text-violet-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${tones[tone]} ${
        outline ? "bg-white" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Agrupa skills Req/Nice */
function splitSkills(skills?: string[] | null) {
  const req: string[] = [];
  const nice: string[] = [];
  if (!Array.isArray(skills)) return { req, nice };

  for (const raw of skills) {
    const s = String(raw || "").trim();
    const mReq = s.match(/^req\s*:\s*(.+)$/i);
    const mNice = s.match(/^nice\s*:\s*(.+)$/i);
    if (mReq && mReq[1]) req.push(mReq[1].trim());
    else if (mNice && mNice[1]) nice.push(mNice[1].trim());
    else nice.push(s);
  }
  return { req, nice };
}

function labelDegree(d?: DegreeLevel | null) {
  switch (d) {
    case "HIGHSCHOOL":
      return "Bachillerato";
    case "TECH":
      return "Técnico";
    case "BACHELOR":
      return "Licenciatura / Ingeniería";
    case "MASTER":
      return "Maestría";
    case "PHD":
      return "Doctorado";
    default:
      return "—";
  }
}

export default function JobDetailPanel({ job, canApply = true, editHref }: Props) {
  if (!job) {
    return (
      <div className="rounded-2xl border bg-white/70 p-6 text-sm text-zinc-600">
        Selecciona una vacante de la lista para ver el detalle.
      </div>
    );
  }

  const when =
    (job.updatedAt && new Date(job.updatedAt)) ||
    (job.createdAt && new Date(job.createdAt));

  const { meta, mainDesc } = parseMeta(job.description);

  // ====== Detalle con lazy fetch para campos que suelen faltar al crear ======
  const [detail, setDetail] = React.useState<{
    showSalary?: boolean | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    currency?: string | null;
    schedule?: string | null;
    showBenefits?: boolean | null;
    benefitsJson?: Record<string, boolean | number | string> | null;
  }>({
    showSalary: job.showSalary,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    schedule: job.schedule,
    showBenefits: job.showBenefits,
    benefitsJson: job.benefitsJson,
  });

  React.useEffect(() => {
    let cancelled = false;

    // Si falta cualquiera, traemos el detalle
    const missing =
      detail.showSalary === undefined ||
      detail.salaryMin === undefined ||
      detail.salaryMax === undefined ||
      detail.currency === undefined ||
      detail.schedule === undefined ||
      detail.showBenefits === undefined ||
      detail.benefitsJson === undefined;

    if (!missing) return;

    (async () => {
      try {
        const res = await fetch(`/api/jobs?id=${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const j = data?.job;
        if (!j) return;

        setDetail({
          showSalary: j.showSalary,
          salaryMin: j.salaryMin,
          salaryMax: j.salaryMax,
          currency: j.currency,
          schedule: j.schedule,
          showBenefits: j.showBenefits,
          benefitsJson: j.benefitsJson,
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // === Priorizar campos del Job/estado; meta solo como fallback legacy ===
  const showSalaryExplicit =
    (detail.showSalary ?? meta?.showSalary) ??
    (detail.salaryMin != null || detail.salaryMax != null);

  const salaryMin = (detail.salaryMin ?? meta?.salaryMin) ?? null;
  const salaryMax = (detail.salaryMax ?? meta?.salaryMax) ?? null;
  const currency = (detail.currency ?? meta?.currency) ?? "MXN";

  const schedule = detail.schedule ?? meta?.schedule ?? null;

  // Beneficios: usar showBenefits + benefitsJson; fallback a meta.benefits
  const benefits =
    (detail.showBenefits &&
      detail.benefitsJson &&
      Object.keys(detail.benefitsJson).length > 0 &&
      detail.benefitsJson) ||
    (meta?.benefits && Object.keys(meta.benefits).length > 0 ? meta.benefits : null);

  // Skills
  const { req: reqSkills, nice: niceSkills } = splitSkills(job.skills);
  const haveAnySkills = reqSkills.length + niceSkills.length > 0;

  // ======== Educación (lazy load si faltaba) ========
  const [minDegree, setMinDegree] = React.useState<DegreeLevel | null>(job.minDegree ?? null);
  const [educationJson, setEducationJson] = React.useState<EduItem[]>(
    Array.isArray(job.educationJson) ? (job.educationJson as EduItem[]) : []
  );

  React.useEffect(() => {
    let cancelled = false;
    const needFetch = !minDegree && educationJson.length === 0;
    if (!needFetch) return;

    (async () => {
      try {
        const res = await fetch(`/api/jobs?id=${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const j = data?.job;
        if (!j || cancelled) return;

        if (!minDegree && j.minDegree) setMinDegree(j.minDegree as DegreeLevel);
        if (educationJson.length === 0 && Array.isArray(j.educationJson)) {
          setEducationJson(j.educationJson as EduItem[]);
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [job.id]); // se re-evalúa al cambiar de job

  const hasEducation = Boolean(minDegree || educationJson.length);

  const [copied, setCopied] = React.useState(false);
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/jobs/${job.id}` : "";
    const shareData = {
      title: job.title || "Vacante",
      text: `${job.title}${job.company ? ` — ${job.company}` : ""}`,
      url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };

  return (
    <article className="relative rounded-2xl border bg-white shadow-sm h-[78vh] xl:h-[82vh] grid grid-rows-[auto,1fr,auto] overflow-hidden">
      {/* Toolbar superior */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white/85 backdrop-blur px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-zinc-700">{job.title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            title="Compartir"
            className="inline-flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm text-zinc-700 hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Compartir</span>
          </button>

          {copied && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              Link copiado
            </span>
          )}

          {canApply ? (
            <form method="POST" action="/api/applications">
              <input type="hidden" name="jobId" value={job.id} />
              <button
                type="submit"
                className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow hover:bg-emerald-700"
              >
                Postularme
              </button>
            </form>
          ) : editHref ? (
            <Link
              href={editHref}
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm text-zinc-700 hover:bg-gray-50"
            >
              Editar vacante
            </Link>
          ) : null}
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="overflow-y-auto px-6 py-5 space-y-6">
        {/* Encabezado */}
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 leading-tight">{job.title}</h1>
          <p className="text-sm text-zinc-600">
            {job.company ? `${job.company} — ` : ""}
            {job.location || "—"}
          </p>

          <div className="flex flex-wrap gap-2">
            {(meta?.employmentType || job.employmentType) && (
              <Chip tone="blue">{meta?.employmentType || job.employmentType}</Chip>
            )}
            {job.seniority && <Chip tone="violet">{job.seniority}</Chip>}
            <Chip tone="emerald">{job.remote ? "Remoto" : "Presencial / Híbrido"}</Chip>
            {schedule && <Chip tone="amber">{schedule}</Chip>}
            {when && (
              <Chip outline className="text-[11px]">
                Actualizada {fromNow(when)}
              </Chip>
            )}
          </div>
        </header>

        {/* Educación */}
        {hasEducation && (
          <section className="space-y-3 pt-2 border-t border-zinc-100">
            <p className="text-sm font-medium text-zinc-700 mb-1">Educación</p>
            {minDegree && (
              <p className="text-sm text-zinc-600 mb-1">
                <span className="font-medium">Nivel mínimo:</span> {labelDegree(minDegree)}
              </p>
            )}
            {educationJson.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {educationJson.map((e) => (
                  <Chip key={e.name} tone={e.required ? "emerald" : "zinc"} outline={!e.required}>
                    {e.name}
                    <span className="ml-1 opacity-80">
                      ({e.required ? "Obligatoria" : "Deseable"})
                    </span>
                  </Chip>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Skills */}
        {haveAnySkills && (
          <section className="space-y-3 pt-2 border-t border-zinc-100">
            {reqSkills.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium text-zinc-700">Skills requeridos</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {reqSkills.map((s) => (
                    <Chip key={`req-${s}`} tone="emerald">
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {niceSkills.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-medium text-zinc-700">Skills deseables</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {niceSkills.map((s) => (
                    <Chip key={`nice-${s}`} tone="violet" outline>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Detalles */}
        <section className="pt-2 border-t border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-800 mb-2">Detalles de la vacante</h3>

          <div className="grid sm:grid-cols-3 gap-3 rounded-xl border bg-zinc-50/60 p-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="h-4 w-4 text-zinc-500" />
              <div>
                <p className="text-[11px] text-zinc-500">Tipo</p>
                <p className="font-medium text-zinc-700 truncate">
                  {meta?.employmentType || job.employmentType || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="h-4 w-4 text-zinc-500" />
              <div>
                <p className="text-[11px] text-zinc-500">Sueldo</p>
                <p className="font-medium text-zinc-700 truncate">
                  {showSalaryExplicit
                    ? `${salaryMin?.toLocaleString() ?? "—"} – ${salaryMax?.toLocaleString() ?? "—"} ${currency}`
                    : "Oculto"}
                </p>
              </div>
            </div>

            {schedule && (
              <div className="flex items-center gap-2 min-w-0">
                <Clock3 className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-[11px] text-zinc-500">Horario</p>
                  <p className="font-medium text-zinc-700 truncate">{schedule}</p>
                </div>
              </div>
            )}
          </div>

          {/* Prestaciones */}
          {benefits && (
            <div className="mt-4 rounded-xl border bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-zinc-500" />
                <p className="text-[12px] font-medium text-zinc-600">Prestaciones</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(benefits)
                  .filter(([_, v]) => (typeof v === "boolean" ? v : String(v).trim() !== ""))
                  .map(([k, v]) => (
                    <Chip key={k} outline tone="emerald">
                      {k}
                      {typeof v !== "boolean" && `: ${v}`}
                    </Chip>
                  ))}
              </div>
            </div>
          )}

          {/* Certificaciones desde meta (compatibilidad) */}
          {Array.isArray(meta?.certifications) && meta.certifications.length > 0 && (
            <div className="mt-3 rounded-xl border bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <BadgeCheck className="h-4 w-4 text-zinc-500" />
                <p className="text-[12px] font-medium text-zinc-600">Certificaciones</p>
              </div>
              <p className="text-sm text-zinc-700">{meta.certifications.join(", ")}</p>
            </div>
          )}
        </section>

        {/* Descripción */}
        {mainDesc && (
          <section className="pt-2 border-t border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-800 mb-1.5">Descripción</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-anywhere text-zinc-700">
              {mainDesc}
            </p>
          </section>
        )}
      </div>

      {/* Footer fijo */}
      <div className="sticky bottom-0 z-10 border-t bg-white/90 backdrop-blur px-6 py-3 flex items-center justify-end shadow-sm">
        {canApply ? (
          <form method="POST" action="/api/applications">
            <input type="hidden" name="jobId" value={job.id} />
            <button
              type="submit"
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow hover:bg-emerald-700"
            >
              Postularme
            </button>
          </form>
        ) : editHref ? (
          <Link
            href={editHref}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-gray-50"
          >
            Editar vacante
          </Link>
        ) : null}
      </div>
    </article>
  );
}
