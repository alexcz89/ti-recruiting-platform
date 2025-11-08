// components/jobs/JobsFeed.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { fromNow } from "@/lib/dates";
import { useJobs } from "@/lib/hooks/useJobs";
import { useRouter } from "next/navigation";

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

export default function JobsFeed({
  initial,
  selectedId,
  onSelect,
  onFirstLoad,
  className = "",
}: Props) {
  const router = useRouter();
  const { jobs, isLoading, isError, hasMore, setSize, isValidating } = useJobs({
    q: initial?.q,
    location: initial?.location,
    countryCode: initial?.countryCode,
    city: initial?.city,
    remote: initial?.remote,
    seniority: initial?.seniority,
    employmentType: initial?.employmentType,
    limit: initial?.limit ?? 10,
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

  // Chips con soporte claro/oscuro
  const chipBase =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
  const chipBlue =
    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50";
  const chipEmerald =
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50";

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

  const TypeChip = ({ j }: { j: any }) =>
    j.employmentType ? (
      <span className={`${chipBase} ${chipBlue}`}>{j.employmentType}</span>
    ) : null;

  const ModeChip = ({ j }: { j: any }) => (
    <span className={`${chipBase} ${chipEmerald}`}>
      {j.remote ? "Remoto" : "Presencial / Híbrido"}
    </span>
  );

  // ---------- States ----------
  if (isError)
    return (
      <div className={`md:max-w-[560px] mx-auto ${className}`}>
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-xl px-3 py-2">
          Error al cargar vacantes.
        </p>
      </div>
    );

  if (isLoading && visibleJobs.length === 0) {
    return (
      <div className={`md:max-w-[560px] mx-auto glass-card p-4 md:p-6 ${className}`}>
        <ul className="mt-1 space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="glass-card p-4">
              <div className="h-4 w-2/3 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50" />
              <div className="mt-2 h-3 w-4/5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50" />
              <div className="mt-2 h-3 w-3/5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (visibleJobs.length === 0)
    return (
      <div className={`md:max-w-[560px] mx-auto glass-card p-4 md:p-6 ${className}`}>
        <p className="text-sm text-muted">
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
          const onActivate = () => onSelect(j);
          const logo = companyLogo(j);
          const confidential = isConfidential(j);

          return (
            <li
              key={j.id}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              onClick={onActivate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onActivate();
                }
              }}
              onMouseEnter={() => router.prefetch?.(`/jobs/${j.id}`)}
              className={[
                "group relative cursor-pointer transition",
                isSelected
                  ? "ring-2 ring-blue-500/40 border-blue-400 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl p-4 border"
                  : "glass-card p-4",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Logo: solo si hay y NO es confidencial */}
                {logo && !confidential && (
                  <div className="shrink-0 mt-0.5">
                    <div className="h-9 w-9 rounded-lg border border-zinc-200/70 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/60 flex items-center justify-center">
                      <Image
                        src={logo}
                        alt={companyNameRaw(j)}
                        width={36}
                        height={36}
                        className="h-9 w-9 object-contain"
                      />
                    </div>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate text-default">
                    {j.title ?? "Sin título"}
                  </h3>
                  <p className="text-sm text-muted truncate">
                    {displayCompany(j)} — {j.location ?? "—"}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TypeChip j={j} />
                    <ModeChip j={j} />
                    <SalaryBadge j={j} />
                  </div>

                  {j.description ? (
                    <p className="text-xs text-muted mt-2 line-clamp-2">
                      {String(j.description).replace(/\s+/g, " ").trim()}
                    </p>
                  ) : null}
                </div>

                <time
                  className="text-[11px] text-muted shrink-0 whitespace-nowrap"
                  title={new Date(j.updatedAt ?? j.createdAt).toLocaleString()}
                >
                  {fromNow(new Date(j.updatedAt ?? j.createdAt))}
                </time>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sentinel para el scroll infinito */}
      <div
        ref={sentinelRef}
        className="h-10 flex items-center justify-center text-xs text-muted"
      >
        {isValidating ? "Cargando más vacantes…" : hasMore ? "" : "No hay más resultados."}
      </div>
    </div>
  );
}
