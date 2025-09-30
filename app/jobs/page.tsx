// app/jobs/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fromNow } from "@/lib/dates";
import { searchJobs } from "@/lib/search/jobs";

export const metadata = { title: "Vacantes | Bolsa TI" };

type SearchParams = {
  q?: string;
  location?: string;
  remote?: "true" | "false";
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  seniority?: "JUNIOR" | "MID" | "SENIOR" | "LEAD";
  minSalary?: string;
  maxSalary?: string;
  sort?: "relevance" | "recent";
  page?: string;
};

const EMP_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] as const;
const SENIORITIES = ["JUNIOR", "MID", "SENIOR", "LEAD"] as const;

const PAGE_SIZE = 12; // 👈 paginación en memoria (MVP)

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Sesión opcional
  const session = await getServerSession(authOptions);
  const isCandidate = !!session?.user && (session.user as any).role === "CANDIDATE";

  // ---- Filtros desde URL ----
  const q = (searchParams.q || "").trim();
  const location = (searchParams.location || "").trim();
  const remote = (searchParams.remote as "true" | "false" | undefined) || undefined;
  const employmentType = (searchParams.employmentType as any) || undefined;
  const seniority = (searchParams.seniority as any) || undefined;
  const minSalary =
    searchParams.minSalary && Number.isFinite(Number(searchParams.minSalary))
      ? Number(searchParams.minSalary)
      : undefined;
  const maxSalary =
    searchParams.maxSalary && Number.isFinite(Number(searchParams.maxSalary))
      ? Number(searchParams.maxSalary)
      : undefined;
  const sort = (searchParams.sort as "relevance" | "recent") || "recent";
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  // ---- Búsqueda con filtros (traemos hasta 400 y paginamos en memoria) ----
  const allJobs = await searchJobs({
    q,
    location,
    remote,
    employmentType,
    seniority,
    minSalary: minSalary ?? null,
    maxSalary: maxSalary ?? null,
    sort,
    take: 400,
  });

  const total = allJobs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const jobs = allJobs.slice(start, end);

  // ---- Utils para construir/remover query params ----
  const buildQS = (overrides: Record<string, string | undefined | null>) => {
    const params = new URLSearchParams();
    const current = {
      q, location, remote, employmentType, seniority,
      minSalary: minSalary?.toString(), maxSalary: maxSalary?.toString(), sort, page: page.toString(),
    } as Record<string, string | undefined>;

    for (const [k, v] of Object.entries({ ...current, ...overrides })) {
      if (v && v !== "" && v !== "undefined" && v !== "null") params.set(k, v);
    }
    // resetear página si cambian filtros
    if (overrides && Object.keys(overrides).length) params.set("page", "1");
    return `/jobs?${params.toString()}`;
  };

  const removeFilterLink = (key: keyof SearchParams) => {
    const copy: Record<string, string | null> = {};
    copy[key] = null;
    return buildQS(copy);
  };

  const hasAnyFilter = !!(
    q || location || remote || employmentType || seniority ||
    minSalary != null || maxSalary != null || sort !== "recent"
  );

  // ---- Chips activos ----
  const chips: Array<{ label: string; href: string }> = [];
  if (q) chips.push({ label: `Texto: ${q}`, href: removeFilterLink("q") });
  if (location) chips.push({ label: `Ubicación: ${location}`, href: removeFilterLink("location") });
  if (remote === "true") chips.push({ label: "Solo remoto", href: removeFilterLink("remote") });
  if (employmentType) chips.push({ label: `Tipo: ${employmentType}`, href: removeFilterLink("employmentType") });
  if (seniority) chips.push({ label: `Seniority: ${seniority}`, href: removeFilterLink("seniority") });
  if (typeof minSalary === "number") chips.push({ label: `Mín: $${minSalary.toLocaleString()}`, href: removeFilterLink("minSalary") });
  if (typeof maxSalary === "number") chips.push({ label: `Máx: $${maxSalary.toLocaleString()}`, href: removeFilterLink("maxSalary") });
  if (sort) chips.push({
    label: `Orden: ${sort === "recent" ? "recientes" : "relevancia"}`,
    href: buildQS({ sort: undefined }),
  });

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Vacantes</h1>
        <p className="text-sm text-zinc-600">
          Filtra por ubicación, tipo, seniority y salario. Ordena por relevancia o por fecha.
        </p>
      </header>

      {/* ---- Filtros (grid responsivo ordenado) ---- */}
      <form className="grid grid-cols-1 gap-3 md:grid-cols-12" method="GET">
        <div className="md:col-span-4">
          <label className="block text-xs text-zinc-500 mb-1">Búsqueda</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Ej: React, AWS, Node, Data Engineer…"
            className="w-full border rounded-xl p-3"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs text-zinc-500 mb-1">Ubicación</label>
          <input
            name="location"
            defaultValue={location}
            placeholder="Ej. CDMX, Monterrey…"
            className="w-full border rounded-xl p-3"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
          <select
            name="employmentType"
            defaultValue={employmentType || ""}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Todos</option>
            {EMP_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">Seniority</label>
          <select
            name="seniority"
            defaultValue={seniority || ""}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Todos</option>
            {SENIORITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-zinc-500 mb-1">Orden</label>
          <select
            name="sort"
            defaultValue={sort}
            className="w-full border rounded-xl p-3"
          >
            <option value="recent">Más recientes</option>
            <option value="relevance">Más relevantes</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs text-zinc-500 mb-1">Salario mínimo</label>
          <input
            type="number"
            name="minSalary"
            min={0}
            step={1000}
            defaultValue={typeof minSalary === "number" ? minSalary : ""}
            className="w-full border rounded-xl p-3"
            placeholder="Ej. 30000"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs text-zinc-500 mb-1">Salario máximo</label>
          <input
            type="number"
            name="maxSalary"
            min={0}
            step={1000}
            defaultValue={typeof maxSalary === "number" ? maxSalary : ""}
            className="w-full border rounded-xl p-3"
            placeholder="Ej. 60000"
          />
        </div>

        <div className="md:col-span-2 flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="remote" value="true" defaultChecked={remote === "true"} />
            Solo remoto
          </label>
        </div>

        <div className="md:col-span-4 flex items-end gap-3">
          <button className="border rounded-xl px-4 py-2 w-full md:w-auto">Filtrar</button>
          {hasAnyFilter && (
            <a href="/jobs" className="text-sm text-zinc-600 hover:underline">Limpiar</a>
          )}
        </div>
      </form>

      {/* Chips de filtros activos */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="text-xs px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              title="Quitar filtro"
            >
              {c.label} <span className="ml-1">×</span>
            </a>
          ))}
        </div>
      )}

      {/* Resultados */}
      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay vacantes que coincidan con los filtros.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {jobs.map((j) => (
              <li key={j.id} className="border rounded-2xl p-4 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Link href={`/jobs/${j.id}`} className="text-lg font-semibold hover:underline">
                      {j.title}
                    </Link>
                    <p className="text-sm text-zinc-600">
                      {j.company || "—"} — {j.location} · {j.employmentType} · {j.seniority} ·{" "}
                      {j.remote ? "Remoto" : "Presencial/Híbrido"}
                    </p>

                    {(j.salaryMin != null || j.salaryMax != null) && (
                      <p className="text-xs text-zinc-700">
                        Salario{" "}
                        {j.salaryMin != null ? j.salaryMin.toLocaleString() : "—"} –{" "}
                        {j.salaryMax != null ? j.salaryMax.toLocaleString() : "—"} {j.currency}
                      </p>
                    )}

                    {Array.isArray(j.skills) && j.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {j.skills.slice(0, 8).map((s) => (
                          <span key={s} className="text-[11px] px-2 py-1 rounded border bg-gray-50">
                            {s}
                          </span>
                        ))}
                        {j.skills.length > 8 && (
                          <span className="text-[11px] px-2 py-1 rounded border bg-gray-50">
                            +{j.skills.length - 8} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <time
                      className="text-xs text-zinc-500 whitespace-nowrap"
                      title={new Date(j.updatedAt).toLocaleString()}
                    >
                      {fromNow(j.updatedAt)}
                    </time>

                    {isCandidate ? (
                      <form method="POST" action="/api/applications">
                        <input type="hidden" name="jobId" value={j.id} />
                        <button className="border rounded px-3 py-1 text-sm hover:bg-gray-50">
                          Postularme
                        </button>
                      </form>
                    ) : (
                      <a
                        href={`/signin?role=CANDIDATE&callbackUrl=/jobs`}
                        className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Iniciar sesión para postular
                      </a>
                    )}
                  </div>
                </div>

                {j.description && (
                  <p className="text-sm text-zinc-700 mt-3 line-clamp-3">{j.description}</p>
                )}
              </li>
            ))}
          </ul>

          {/* Paginación */}
          <nav className="flex items-center justify-between mt-4">
            <div className="text-xs text-zinc-600">
              Página {page} de {totalPages} · {total} resultados
            </div>
            <div className="flex items-center gap-2">
              <a
                className={`border rounded-lg px-3 py-1 text-sm ${
                  page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
                }`}
                href={buildQS({ page: String(page - 1) })}
                aria-disabled={page <= 1}
              >
                ← Anterior
              </a>
              <a
                className={`border rounded-lg px-3 py-1 text-sm ${
                  page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
                }`}
                href={buildQS({ page: String(page + 1) })}
                aria-disabled={page >= totalPages}
              >
                Siguiente →
              </a>
            </div>
          </nav>
        </>
      )}
    </main>
  );
}
