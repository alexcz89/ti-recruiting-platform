import Link from "next/link";

async function getJobs(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/jobs?` + params.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar las vacantes");
  return res.json();
}

export default async function JobsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const data = await getJobs(searchParams);

  return (
    <section className="py-6">
      <h2 className="text-2xl font-semibold mb-4">Vacantes</h2>

      {/* Filtros */}
      <form className="grid md:grid-cols-5 gap-3 mb-6" action="/jobs" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="Buscar (título/empresa/skill)" className="border rounded px-3 py-2" />
        <input name="location" defaultValue={searchParams.location} placeholder="Ubicación" className="border rounded px-3 py-2" />
        <select name="seniority" defaultValue={searchParams.seniority} className="border rounded px-3 py-2">
          <option value="">Seniority</option>
          <option>JUNIOR</option><option>MID</option><option>SENIOR</option><option>LEAD</option>
        </select>
        <select name="employmentType" defaultValue={searchParams.employmentType} className="border rounded px-3 py-2">
          <option value="">Tipo</option>
          <option>FULL_TIME</option><option>PART_TIME</option><option>CONTRACT</option><option>INTERNSHIP</option>
        </select>
        <select name="remote" defaultValue={searchParams.remote} className="border rounded px-3 py-2">
          <option value="">Remoto?</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        <button className="md:col-span-5 border rounded px-4 py-2 w-fit">Aplicar filtros</button>
      </form>

      {/* Listado */}
      <div className="grid md:grid-cols-2 gap-4">
        {data.jobs.map((j: any) => (
          <Link key={j.id} href={`/jobs/${j.id}`} className="border rounded-xl p-4 hover:shadow">
            <h3 className="font-semibold">{j.title}</h3>
            <p className="text-sm text-zinc-600">{j.company} • {j.location} {j.remote ? "• Remoto" : ""}</p>
            <p className="text-xs mt-1">{j.seniority} • {j.employmentType}</p>
            <p className="text-sm mt-2">{j.description.slice(0,120)}...</p>
            {Array.isArray(j.skills) && j.skills.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {j.skills.slice(0,5).map((s: string) => (
                  <span key={s} className="text-xs border rounded px-2 py-0.5">{s}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
        {data.jobs.length === 0 && (
          <p className="text-sm text-zinc-500">No hay vacantes con esos filtros.</p>
        )}
      </div>
    </section>
  );
}
