// components/jobs/JobDetailPanel.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import DOMPurify from "dompurify";
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
import ApplyButton, { ApplyResult } from "./ApplyButton";

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
  descriptionHtml?: string | null;
  skills?: string[] | null;

  companyLogoUrl?: string | null;
  logoUrl?: string | null;
  companyObj?: { name?: string | null; logoUrl?: string | null } | null;

  confidential?: boolean | null;
  isConfidential?: boolean | null;
  companyConfidential?: boolean | null;
  meta?: { confidential?: boolean | null };

  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  showSalary?: boolean | null;

  schedule?: string | null;
  benefitsJson?: Record<string, boolean | number | string> | null;
  showBenefits?: boolean | null;

  remote?: boolean | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;

  minDegree?: DegreeLevel | null;
  educationJson?: EduItem[] | null;
};

type Props = {
  job: Job | null;
  canApply?: boolean;
  editHref?: string;
};

/* ---------------- Meta parsing ---------------- */
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

function parseMeta(
  description: string | null | undefined
): {
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

/* ---------------- Chips & helpers ---------------- */
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
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium";

  const filled: Record<string, string> = {
    zinc: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-300/50",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50",
    emerald:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50",
    amber:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50",
    violet:
      "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-300/50",
  };

  const outlines: Record<string, string> = {
    zinc: "border-zinc-300 text-zinc-700 dark:text-zinc-300",
    blue: "border-blue-300 text-blue-700 dark:text-blue-300",
    emerald: "border-emerald-300 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-300 text-amber-700 dark:text-amber-300",
    violet: "border-violet-300 text-violet-700 dark:text-violet-300",
  };

  const toneClass = outline ? outlines[tone] : filled[tone];

  return <span className={`${base} ${toneClass} ${className}`}>{children}</span>;
}

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

/* ---------- Helpers para prestaciones ---------- */

const BENEFIT_LABELS: Record<string, string> = {
  auto: "Auto",
  sgmm: "SGMM",
  vida: "Seguro de vida",
  bonos: "Bonos",
  otros: "Otras prestaciones",
  vales: "Vales",
  celular: "Celular",
  comedor: "Comedor",
  primaVac: "Prima vacacional",
  aguinaldo: "Aguinaldo",
  utilidades: "Utilidades",
  vacaciones: "Vacaciones",
  combustible: "Combustible",
  fondoAhorro: "Fondo de ahorro",
  primaVacPct: "Prima vacacional",
  vacacionesDias: "Vacaciones",
  aguinaldoDias: "Aguinaldo",
};

function formatBenefitLabel(key: string, value: any): string | null {
  const k = key.toString();
  const lower = k.toLowerCase();

  if (lower === "showbenefits") return null;

  const base =
    BENEFIT_LABELS[k] ?? BENEFIT_LABELS[lower] ?? k.replace(/([A-Z])/g, " $1");

  if (typeof value === "boolean") return value ? base : null;

  if (typeof value === "number") {
    if (lower === "primavacpct") return `${base}: ${value}%`;
    if (lower === "vacacionesdias") return `${base}: ${value} días`;
    if (lower === "aguinaldodias") return `${base}: ${value} días`;
    return `${base}: ${value}`;
  }

  const vStr = String(value).trim();
  if (!vStr) return base;
  return `${base}: ${vStr}`;
}

export default function JobDetailPanel({ job, canApply = true, editHref }: Props) {
  // ✅ Hooks SIEMPRE arriba (sin returns antes)
  const jobId = job?.id ?? "";

  const rawDesc = job?.description ?? "";
  const { meta, mainDesc } = React.useMemo(() => parseMeta(rawDesc), [rawDesc]);

  const when = React.useMemo(() => {
    const d =
      (job?.updatedAt && new Date(job.updatedAt)) ||
      (job?.createdAt && new Date(job.createdAt)) ||
      null;
    if (!d) return null;
    return Number.isNaN(d.getTime()) ? null : d;
  }, [job?.updatedAt, job?.createdAt]);

  const fallbackText = React.useMemo(() => {
    const base = (mainDesc || rawDesc).replace(/\n/g, "<br/>");
    return base;
  }, [mainDesc, rawDesc]);

  const descHtml = React.useMemo(() => {
    const html = (job as any)?.descriptionHtml || fallbackText;
    return html || "";
  }, [job, fallbackText]);

  const companyNameRaw = React.useMemo(() => {
    return (job as any)?.company?.name ?? job?.company ?? "—";
  }, [job]);

  const companyLogoRaw = React.useMemo(() => {
    return (
      (job as any)?.company?.logoUrl ??
      job?.companyLogoUrl ??
      (job as any)?.logoUrl ??
      null
    );
  }, [job]);

  const confidential = React.useMemo(() => {
    return (
      (job as any)?.companyConfidential ??
      (job as any)?.confidential ??
      (job as any)?.isConfidential ??
      (job as any)?.meta?.confidential ??
      false
    );
  }, [job]);

  const showCompanyName = !confidential && companyNameRaw && companyNameRaw !== "—";
  const companyName = showCompanyName ? companyNameRaw : "";
  const companyLogo = !confidential ? companyLogoRaw : null;

  const [detail, setDetail] = React.useState<{
    showSalary?: boolean | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    currency?: string | null;
    schedule?: string | null;
    showBenefits?: boolean | null;
    benefitsJson?: Record<string, boolean | number | string> | null;
  }>(() => ({
    showSalary: job?.showSalary,
    salaryMin: job?.salaryMin,
    salaryMax: job?.salaryMax,
    currency: job?.currency,
    schedule: job?.schedule,
    showBenefits: job?.showBenefits,
    benefitsJson: job?.benefitsJson,
  }));

  // Si cambia jobId, re-hidrata estado base
  React.useEffect(() => {
    setDetail({
      showSalary: job?.showSalary,
      salaryMin: job?.salaryMin,
      salaryMax: job?.salaryMax,
      currency: job?.currency,
      schedule: job?.schedule,
      showBenefits: job?.showBenefits,
      benefitsJson: job?.benefitsJson,
    });
  }, [jobId, job]);

  React.useEffect(() => {
    let cancelled = false;
    if (!jobId) return;

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
        const res = await fetch(`/api/jobs?id=${jobId}`, { cache: "no-store" });
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
  }, [
    jobId,
    detail.showSalary,
    detail.salaryMin,
    detail.salaryMax,
    detail.currency,
    detail.schedule,
    detail.showBenefits,
    detail.benefitsJson,
  ]);

  const showSalaryExplicit =
    (detail.showSalary ?? meta?.showSalary) ??
    (detail.salaryMin != null || detail.salaryMax != null);

  const salaryMin = (detail.salaryMin ?? meta?.salaryMin) ?? null;
  const salaryMax = (detail.salaryMax ?? meta?.salaryMax) ?? null;
  const currency = (detail.currency ?? meta?.currency) ?? "MXN";
  const schedule = detail.schedule ?? meta?.schedule ?? null;

  const benefitsObj: Record<string, boolean | number | string> | null =
    ((detail.showBenefits &&
      detail.benefitsJson &&
      Object.keys(detail.benefitsJson).length > 0 &&
      detail.benefitsJson) as any) ||
    (meta?.benefits && Object.keys(meta.benefits).length > 0 ? meta.benefits : null);

  const benefitItems = React.useMemo(() => {
    if (!benefitsObj) return null;
    const items = Object.entries(benefitsObj)
      .map(([k, v]) => {
        const label = formatBenefitLabel(k, v);
        if (!label) return null;
        return { key: k, label };
      })
      .filter(Boolean) as { key: string; label: string }[];
    return items.length ? items : null;
  }, [benefitsObj]);

  const { req: reqSkills, nice: niceSkills } = React.useMemo(
    () => splitSkills(job?.skills),
    [job?.skills]
  );
  const haveAnySkills = reqSkills.length + niceSkills.length > 0;

  const [minDegree, setMinDegree] = React.useState<DegreeLevel | null>(() => job?.minDegree ?? null);
  const [educationJson, setEducationJson] = React.useState<EduItem[]>(() =>
    Array.isArray(job?.educationJson) ? (job!.educationJson as EduItem[]) : []
  );

  // Si cambia jobId, re-hidrata educación base
  React.useEffect(() => {
    setMinDegree(job?.minDegree ?? null);
    setEducationJson(Array.isArray(job?.educationJson) ? (job!.educationJson as EduItem[]) : []);
  }, [jobId, job]);

  React.useEffect(() => {
    let cancelled = false;
    if (!jobId) return;

    const needFetch = !minDegree && educationJson.length === 0;
    if (!needFetch) return;

    (async () => {
      try {
        const res = await fetch(`/api/jobs?id=${jobId}`, { cache: "no-store" });
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
  }, [jobId, minDegree, educationJson.length]);

  const hasEducation = Boolean(minDegree || educationJson.length);

  const [copied, setCopied] = React.useState(false);
  const handleShare = React.useCallback(async () => {
    if (!jobId) return;
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/jobs/${jobId}` : "";
    const shareData = {
      title: job?.title || "Vacante",
      text: `${job?.title || "Vacante"}${showCompanyName ? ` — ${companyName}` : ""}`,
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
  }, [jobId, job?.title, showCompanyName, companyName]);

  const applyAction = React.useCallback(async (): Promise<ApplyResult> => {
    if (!jobId) return { error: "UNKNOWN", message: "Vacante inválida" };

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (res.status === 401) {
        const callback =
          typeof window !== "undefined"
            ? encodeURIComponent(window.location.pathname + window.location.search)
            : encodeURIComponent(`/jobs/${jobId}`);
        return {
          error: "AUTH",
          signinUrl: `/auth/signin?callbackUrl=${callback}`,
        };
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        return {
          error: "ROLE",
          message: data?.error || "Solo candidatos pueden postular",
        };
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        return {
          error: "ALREADY_APPLIED",
          message: data?.error || "Ya postulaste a esta vacante",
        };
      }

      if (res.ok) {
        const redirect =
          typeof window !== "undefined"
            ? `${window.location.pathname}?applied=1`
            : `/jobs/${jobId}`;
        return { ok: true, redirect };
      }

      const data = await res.json().catch(() => null);
      return {
        error: "UNKNOWN",
        message: data?.error || "Error al postular",
      };
    } catch (e) {
      console.error("[JobDetailPanel] applyAction error", e);
      return {
        error: "UNKNOWN",
        message: "No se pudo conectar con el servidor",
      };
    }
  }, [jobId]);

  // ✅ Ahora sí: return temprano, pero DESPUÉS de hooks
  if (!job) {
    return (
      <div className="rounded-2xl border glass-card p-4 md:p-6">
        Selecciona una vacante de la lista para ver el detalle.
      </div>
    );
  }

  return (
    <article className="relative rounded-2xl border glass-card p-4 md:p-6">
      {/* Toolbar superior */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b glass-card p-4 md:p-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-default">{job.title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            title="Compartir"
            className="inline-flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm text-default hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Share2 className="h-4 w-4 text-muted" />
            <span className="hidden sm:inline">Compartir</span>
          </button>

          {copied && (
            <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-300/50 rounded px-2 py-1">
              Link copiado
            </span>
          )}

          {canApply ? (
            <ApplyButton applyAction={applyAction} jobKey={job.id} />
          ) : editHref ? (
            <Link
              href={editHref}
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm text-default hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Editar vacante
            </Link>
          ) : null}
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="overflow-y-auto px-6 py-5 space-y-6">
        {/* Encabezado con logo */}
        <header className="space-y-3">
          <div className="flex items-start gap-3">
            {companyLogo && (
              <div className="h-12 w-12 rounded-xl border bg-zinc-200/60 dark:bg-zinc-700/50">
                <Image
                  src={companyLogo}
                  alt={companyName || "Logo"}
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                />
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold leading-tight text-default">
                {job.title}
              </h1>
              <p className="text-sm text-muted">
                {showCompanyName ? `${companyName} — ` : ""}
                {job.location || "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(meta?.employmentType || job.employmentType) && (
              <Chip tone="blue">{meta?.employmentType || job.employmentType}</Chip>
            )}
            {job.seniority && <Chip tone="violet">{job.seniority}</Chip>}
            <Chip tone="emerald">{job.remote ? "Remoto" : "Presencial / Híbrido"}</Chip>
            {schedule && <Chip tone="amber">{schedule}</Chip>}
            {when && (
              <Chip outline tone="zinc" className="text-[11px]">
                Actualizada {fromNow(when)}
              </Chip>
            )}
          </div>
        </header>

        {/* Educación */}
        {hasEducation && (
          <section className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            <p className="text-sm font-medium text-default mb-1">Educación</p>
            {minDegree && (
              <p className="text-sm text-muted mb-1">
                <span className="font-medium text-default">Nivel mínimo:</span>{" "}
                {labelDegree(minDegree)}
              </p>
            )}
            {educationJson.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {educationJson.map((e) => (
                  <Chip
                    key={e.name}
                    tone={e.required ? "emerald" : "zinc"}
                    outline={!e.required}
                  >
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
          <section className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            {reqSkills.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <p className="text-sm font-medium text-default">Skills requeridos</p>
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
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                  <p className="text-sm font-medium text-default">Skills deseables</p>
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
        <section className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          <h3 className="text-sm font-semibold text-default mb-2">
            Detalles de la vacante
          </h3>

          <div className="grid sm:grid-cols-3 gap-3 rounded-xl border glass-card p-4 md:p-6">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="h-4 w-4 text-muted" />
              <div>
                <p className="text-[11px] text-muted">Tipo</p>
                <p className="font-medium text-default truncate">
                  {meta?.employmentType || job.employmentType || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="h-4 w-4 text-muted" />
              <div>
                <p className="text-[11px] text-muted">Sueldo</p>
                <p className="font-medium text-default truncate">
                  {showSalaryExplicit
                    ? `${salaryMin?.toLocaleString() ?? "—"} – ${
                        salaryMax?.toLocaleString() ?? "—"
                      } ${currency}`
                    : "Oculto"}
                </p>
              </div>
            </div>

            {schedule && (
              <div className="flex items-center gap-2 min-w-0">
                <Clock3 className="h-4 w-4 text-muted" />
                <div>
                  <p className="text-[11px] text-muted">Horario</p>
                  <p className="font-medium text-default truncate">{schedule}</p>
                </div>
              </div>
            )}
          </div>

          {/* Prestaciones */}
          {benefitItems && benefitItems.length > 0 && (
            <div className="mt-4 rounded-xl border glass-card p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-muted" />
                <p className="text-[12px] font-medium text-muted">Prestaciones</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {benefitItems.map((b) => (
                  <Chip key={b.key} outline tone="emerald">
                    {b.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Certificaciones desde meta */}
          {Array.isArray(meta?.certifications) && meta.certifications.length > 0 && (
            <div className="mt-3 rounded-xl border glass-card p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <BadgeCheck className="h-4 w-4 text-muted" />
                <p className="text-[12px] font-medium text-muted">Certificaciones</p>
              </div>
              <p className="text-sm text-default">{meta.certifications.join(", ")}</p>
            </div>
          )}
        </section>

        {/* Descripción */}
        {descHtml && (
          <section className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            <h3 className="text-sm font-semibold text-default mb-1.5">Descripción</h3>
            <div
              className="job-html prose prose-sm max-w-none text-sm leading-relaxed text-default/90 dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(descHtml, {
                  ALLOWED_TAGS: ["b", "strong", "i", "em", "p", "br", "ul", "ol", "li"],
                  ALLOWED_ATTR: [],
                }),
              }}
            />
          </section>
        )}
      </div>
    </article>
  );
}
