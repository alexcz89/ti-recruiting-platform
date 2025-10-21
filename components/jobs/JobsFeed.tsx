// components/jobs/JobsFeed.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
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

  // Auto seleccionar primera vacante al cargar
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
      { rootMargin: "200px" } // pre‐carga anticipada
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, setSize]);

  // ---------- UI helpers ----------
  const companyLabel = (j: any) => j.company?.name ?? j.company ?? "—";

  const SalaryBadge = ({ j }: { j: any }) => {
    const has = j.salaryMin != null || j.salaryMax != null;
    if (!has) return null;
    const currency = j.currency ?? "MXN";
    const min = j.salaryMin != null ? Number(j.salaryMin).toLocaleString("es-MX") : "—";
    const max = j.salaryMax != null ? Number(j.salaryMax).toLocaleString("es-MX") : "—";
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium">
        {min} – {max} {currency}
      </span>
    );
  };

  const TypeChip = ({ j }: { j: any }) =>
    j.employmentType ? (
      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
        {j.employmentType}
      </span>
    ) : null;

  const ModeChip = ({ j }: { j: any }) => (
    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium">
      {j.remote ? "Remoto" : "Presencial / Híbrido"}
    </span>
  );

  const skillsPreview = (j: any): string[] => {
    if (!Array.isArray(j?.skills)) return [];
    const clean = j.skills
      .map((s: string) => s.replace(/^Req\s*:\s*/i, "").replace(/^Nice\s*:\s*/i, "").trim())
      .filter(Boolean);
    return clean.slice(0, 4);
  };

  const salaryLine = (j: any) => {
    const has = j.salaryMin != null || j.salaryMax != null;
    if (!has) return "Oculto";
    const currency = j.currency ?? "MXN";
    const min = j.salaryMin != null ? Number(j.salaryMin).toLocaleString("es-MX") : "—";
    const max = j.salaryMax != null ? Number(j.salaryMax).toLocaleString("es-MX") : "—";
    return `${min} – ${max} ${currency}`;
  };

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
      <div
        className={`md:max-w-[560px] mx-auto rounded-2xl border bg-white/70 backdrop-blur p-2 sm:p-3 h-[78vh] overflow-hidden ${className}`}
      >
        <ul className="mt-1 space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="border rounded-xl p-4">
              <div className="h-4 w-2/3 bg-zinc-200 rounded mb-2" />
              <div className="h-3 w-4/5 bg-zinc-200 rounded mb-1" />
              <div className="h-3 w-3/5 bg-zinc-200 rounded" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (visibleJobs.length === 0)
    return (
      <div
        className={`md:max-w-[560px] mx-auto rounded-2xl border bg-white/70 backdrop-blur p-6 ${className}`}
      >
        <p className="text-sm text-zinc-600">
          No hay vacantes que coincidan con los filtros.
        </p>
      </div>
    );

  // ---------- Main list ----------
  return (
    <div
      className={`md:max-w-[560px] mx-auto rounded-2xl border bg-white/70 backdrop-blur p-2 sm:p-3 h-[78vh] overflow-y-auto ${className}`}
    >
      <ul className="space-y-3">
        {visibleJobs.map((j: any) => {
          const isSelected = j.id === selectedId;
          const onActivate = () => onSelect(j);
          const skillList = skillsPreview(j);

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
                "group relative cursor-pointer border rounded-xl p-4 transition",
                "hover:shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
                isSelected
                  ? "ring-2 ring-blue-500/40 border-blue-400 bg-blue-50/70"
                  : "bg-white",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{j.title ?? "Sin título"}</h3>
                  <p className="text-sm text-zinc-600 truncate">
                    {companyLabel(j)} — {j.location ?? "—"}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TypeChip j={j} />
                    <ModeChip j={j} />
                    <SalaryBadge j={j} />
                  </div>

                  {j.description ? (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                      {String(j.description).replace(/\s+/g, " ").trim()}
                    </p>
                  ) : null}
                </div>

                <time
                  className="text-[11px] text-zinc-500 shrink-0 whitespace-nowrap"
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
      <div ref={sentinelRef} className="h-10 flex items-center justify-center text-xs text-zinc-400">
        {isValidating ? "Cargando más vacantes…" : hasMore ? "" : "No hay más resultados."}
      </div>
    </div>
  );
}
