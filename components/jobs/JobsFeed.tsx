// components/jobs/JobsFeed.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";   // CAMBIO: nuevo ícono
import { fromNow } from "@/lib/dates";
import { useJobs } from "@/lib/client/hooks/useJobs";
import { useRouter } from "next/navigation";
import { JobsListSkeleton } from "@/components/ui/Skeleton";

type Props = {
  initial?: {
    q?: string;
    location?: string;
    countryCode?: string;
    city?: string;
    remote?: boolean;
    seniority?: string;
    employmentType?: string;
    sort?: "recent" | "relevance";
    limit?: number;
  };
  selectedId?: string | null;
  onSelect: (job: any) => void;
  onFirstLoad?: (job: any) => void;
  className?: string;
};

const PAGE_LIMIT = 50;

// ---------- Helpers avatar/logo ----------

function getInitials(name: string | null | undefined): string {
  if (!name) return "BT";
  const parts = name.trim().split(/\s+/);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
  return (letters || "BT").toUpperCase();
}

function FallbackAvatar({
  name,
  confidential,
}: {
  name: string | null | undefined;
  confidential: boolean;
}) {
  return (
    <div className="shrink-0 mt-0.5">
      <div className="h-9 w-9 rounded-full border border-emerald-300/70 dark:border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-900/40 flex items-center justify-center overflow-hidden">
        {confidential ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="17"
            height="17"
            className="text-emerald-800 dark:text-emerald-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9h18v11H3z" />
            <path d="M8 9V7a4 4 0 0 1 8 0v2" />
          </svg>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-100">
            {getInitials(name)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Helpers de UI ----------

// Traduce employmentType de enum a español
function labelEmploymentType(type: string | null | undefined): string | null {
  switch (type) {
    case "FULL_TIME":    return "Tiempo completo";
    case "PART_TIME":   return "Medio tiempo";
    case "CONTRACT":    return "Por contrato";
    case "INTERNSHIP":  return "Prácticas";
    case "TEMPORARY":   return "Temporal";
    case "FREELANCE":   return "Freelance";
    default:            return type ?? null;
  }
}



const chipBase =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
const chipBlue =
  "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50";
const chipEmerald =
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50";
const chipIndigo =
  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300/50";

function getSkillLabels(j: any): string[] {
  const sources: any[] = [];

  if (Array.isArray(j.skills)) sources.push(j.skills);
  if (Array.isArray(j.skillsRequired)) sources.push(j.skillsRequired);
  if (Array.isArray(j.requiredSkills)) sources.push(j.requiredSkills);
  if (Array.isArray(j.skillTags)) sources.push(j.skillTags);
  if (Array.isArray(j.skillsTerms)) sources.push(j.skillsTerms);

  const labels: string[] = [];

  const pushLabel = (raw: any) => {
    const label =
      typeof raw === "string"
        ? raw
        : raw?.label ?? raw?.name ?? raw?.term?.label ?? "";
    if (!label) return;
    if (!labels.includes(label)) labels.push(label);
  };

  for (const src of sources) {
    for (const item of src) pushLabel(item);
  }

  // Limpiar prefijos técnicos "Req:", "Nice:", "Dese:" para mostrar solo el skill
  const cleaned = labels.map((l) =>
    l.replace(/^(req|nice|dese|required|deseable)\s*:\s*/i, "").trim()
  ).filter(Boolean);

  // Deduplicar después de limpiar
  return [...new Set(cleaned)].slice(0, 5);
}

function isEnglishRequired(j: any): boolean {
  if (j.englishRequired || j.requiresEnglish) return true;
  if (typeof j.minEnglishLevel === "string" && j.minEnglishLevel.length > 0)
    return true;

  const langs = Array.isArray(j.languagesRequired)
    ? j.languagesRequired
    : Array.isArray(j.languages)
    ? j.languages
    : [];

  return langs.some((raw: any) => {
    const label =
      typeof raw === "string"
        ? raw
        : raw?.label ?? raw?.name ?? raw?.language ?? "";
    return /inglés|ingles|english/i.test(label || "");
  });
}

// CAMBIO: normaliza ubicación — "Remote" → "Remoto", vacío → null
function resolveLocation(j: any): string | null {
  if (j.remote) return "Remoto";
  const loc = j.location?.trim();
  if (!loc || loc === "—") return null;
  if (/^remote$/i.test(loc)) return "Remoto";
  return loc;
}

export default function JobsFeed({
  initial,
  selectedId,
  onSelect,
  onFirstLoad,
  className = "",
}: Props) {
  const router = useRouter();
  const {
    jobs,
    isLoading,
    isError,
    hasMore,
    setSize,
    isValidating,
  } = useJobs({
    q: initial?.q,
    location: initial?.location,
    countryCode: initial?.countryCode,
    city: initial?.city,
    remote: initial?.remote,
    seniority: initial?.seniority,
    employmentType: initial?.employmentType,
    sort: initial?.sort,
    limit: PAGE_LIMIT,
  });

  const visibleJobs = useMemo(
    () => (jobs || []).filter((j: any) => j && typeof j.id === "string"),
    [jobs]
  );

  useEffect(() => {
    if (visibleJobs.length > 0 && !selectedId && onFirstLoad) {
      onFirstLoad(visibleJobs[0]);
    }
  }, [visibleJobs, selectedId, onFirstLoad]);

  // ---------- Infinite scroll ----------
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) setSize((s) => s + 1);
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, setSize]);

  // ---------- UI helpers ----------

  const companyNameRaw = (j: any) => j.company?.name ?? j.company ?? "—";
  const companyLogo = (j: any) =>
    j.company?.logoUrl ?? j.companyLogoUrl ?? j.logoUrl ?? null;

  const isConfidential = (j: any) =>
    j.companyConfidential ??
    j.confidential ??
    j.isConfidential ??
    j.meta?.confidential ??
    false;

  const displayCompany = (j: any) =>
    isConfidential(j) ? "Empresa confidencial" : companyNameRaw(j);

  const SalaryBadge = ({ j }: { j: any }) => {
    const has = j.salaryMin != null || j.salaryMax != null;
    if (!has) return null;
    const currency = j.currency ?? "MXN";
    const min =
      j.salaryMin != null ? Number(j.salaryMin).toLocaleString("es-MX") : "—";
    const max =
      j.salaryMax != null ? Number(j.salaryMax).toLocaleString("es-MX") : "—";
    return (
      <span className={`${chipBase} ${chipEmerald}`}>
        {min} – {max} {currency}
      </span>
    );
  };

  const TypeChip = ({ j }: { j: any }) => {
    const label = labelEmploymentType(j.employmentType);
    return label ? (
      <span className={`${chipBase} ${chipBlue}`}>{label}</span>
    ) : null;
  };

  const ModeChip = ({ j }: { j: any }) => (
    <span className={`${chipBase} ${chipEmerald} whitespace-nowrap`}>
      {j.remote ? "Remoto" : "Híbrido"}
    </span>
  );

  // ---------- States ----------
  if (isError)
    return (
      <div className={`md:max-w-[560px] mx-auto ${className}`}>
        <div
          role="alert"
          aria-live="polite"
          className="text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2"
        >
          Error al cargar vacantes. Por favor, intenta de nuevo.
        </div>
      </div>
    );

  if (isLoading && visibleJobs.length === 0) {
    return (
      <div className={`md:max-w-[560px] mx-auto ${className}`}>
        <JobsListSkeleton count={6} />
      </div>
    );
  }

  if (visibleJobs.length === 0)
    return (
      <div
        className={`md:max-w-[560px] mx-auto glass-card p-4 md:p-6 ${className}`}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No hay vacantes que coincidan con los filtros.
        </p>
      </div>
    );

  // ---------- Main list ----------
  return (
    <div className={`md:max-w-[560px] mx-auto ${className}`}>
      <ul className="space-y-3">
        {visibleJobs.map((j: any) => {
          const isSelected = j.id === selectedId;

          const onActivate = () => {
            onSelect(j);

            if (typeof window === "undefined") return;
            if (
              window.matchMedia &&
              window.matchMedia("(min-width: 1024px)").matches
            ) {
              return;
            }

            const el = document.getElementById("job-detail-panel");
            if (el) {
              el.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          };

          const logo = companyLogo(j);
          const confidential = isConfidential(j);
          const companyName = companyNameRaw(j);
          const skillLabels = getSkillLabels(j);
          const english = isEnglishRequired(j);
          const location = resolveLocation(j); // CAMBIO

          return (
            <li
              key={j.id}
              role="option"
              aria-selected={isSelected}
              aria-label={`${j.title} en ${displayCompany(j)}${location ? ` - ${location}` : ""}`}
              tabIndex={0}
              onClick={onActivate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onActivate();
                }
              }}
              onMouseEnter={() => router.prefetch?.(`/jobs/${j.slug ?? j.id}`)}
              className={[
                "group relative cursor-pointer transition focus-ring",
                isSelected
                  ? "ring-2 ring-blue-500/40 border-blue-400 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl p-4 border"
                  : "glass-card p-4",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                {logo && !confidential ? (
                  <div className="shrink-0 mt-0.5">
                    <div className="h-9 w-9 rounded-lg border border-zinc-200/70 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/60 flex items-center justify-center">
                      <Image
                        src={logo}
                        alt={companyName}
                        width={36}
                        height={36}
                        className="h-9 w-9 object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <FallbackAvatar
                    name={confidential ? null : companyName}
                    confidential={confidential}
                  />
                )}

                <div className="min-w-0 flex-1">
                  {/*
                    CAMBIO: title
                    Antes: truncate (1 línea, corta en móvil)
                    Ahora: line-clamp-2 en móvil, line-clamp-1 en sm+
                  */}
                  <h3 className="font-semibold text-default leading-snug line-clamp-2 sm:line-clamp-1 hyphens-none">
                    {j.title ?? "Sin título"}
                  </h3>

                  {/*
                    CAMBIO: empresa y ubicación separadas
                    Antes: `{displayCompany(j)} — {j.location ?? "—"}`
                    Ahora: empresa en su propia línea, ubicación con ícono debajo
                  */}
                  <p className="text-sm text-muted truncate mt-0.5">
                    {displayCompany(j)}
                  </p>
                  {location && (
                    <p className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {location}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TypeChip j={j} />
                    <ModeChip j={j} />
                    <SalaryBadge j={j} />
                    {english && (
                      <span className={`${chipBase} ${chipIndigo}`}>
                        Inglés requerido
                      </span>
                    )}
                  </div>

                  {skillLabels.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {/* En móvil mostramos máx 3 skills para no apilar demasiado */}
                      {skillLabels.slice(0, typeof window !== "undefined" && window.innerWidth < 640 ? 3 : 5).map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full border border-zinc-200/70 dark:border-zinc-700/60 bg-zinc-100/80 dark:bg-zinc-800/70 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
                        >
                          {label}
                        </span>
                      ))}
                      {skillLabels.length > 3 && (
                        <span className="sm:hidden inline-flex items-center rounded-full border border-zinc-200/70 dark:border-zinc-700/60 bg-zinc-100/80 dark:bg-zinc-800/70 px-2 py-0.5 text-[10px] text-muted">
                          +{skillLabels.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Descripción removida — se ve completa en el panel de detalle */}
                </div>

                <time
                  className="text-[11px] text-zinc-600 dark:text-zinc-400 shrink-0 whitespace-nowrap"
                  title={new Date(
                    j.updatedAt ?? j.createdAt
                  ).toLocaleString()}
                >
                  {fromNow(new Date(j.updatedAt ?? j.createdAt))}
                </time>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        ref={sentinelRef}
        className="h-10 flex items-center justify-center text-xs text-muted"
      >
        {isValidating
          ? "Cargando más vacantes…"
          : hasMore
          ? ""
          : "No hay más resultados."}
      </div>
    </div>
  );
}