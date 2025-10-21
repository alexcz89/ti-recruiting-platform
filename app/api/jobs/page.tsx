// app/jobs/page.tsx
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  createdAt: string;
};

function etLabel(e: Job["employmentType"]) {
  switch (e) {
    case "FULL_TIME": return "Tiempo completo";
    case "PART_TIME": return "Medio tiempo";
    case "CONTRACT":  return "Por periodo";
    case "INTERNSHIP":return "Prácticas";
  }
}

export const dynamic = "force-dynamic";

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: { q?: string; location?: string; remote?: "true" | "false"; employmentType?: string };
}) {
  const qp = new URLSearchParams();
  qp.set("limit", "20");
  qp.set("sort", "recent");
  if (searchParams.q) qp.set("q", searchParams.q);
  if (searchParams.location) qp.set("location", searchParams.location);
  if (searchParams.remote) qp.set("remote", searchParams.remote);
  if (searchParams.employmentType) qp.set("employmentType", searchParams.employmentType);

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/jobs?` + qp.toString(), {
    next: { revalidate: 30 }, // cache suave
  });
  const data = await res.json();
  const items: Job[] = data.items ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vacantes</h1>
          <p className="text-sm text-zinc-600">Listado público de posiciones abiertas.</p>
        </div>
      </header>

      {/* Filtros simples (opcionales) */}
      <form className="grid grid-cols-1 md:grid-cols-4 gap-3" method="GET">
        <input
          name="q"
          defaultValue={searchParams.q || ""}
          placeholder="Buscar por título, descripción o skill"
          className="border rounded-lg p-2"
        />
        <input
          name="location"
          defaultValue={searchParams.location || ""}
          placeholder="Ubicación"
          className="border rounded-lg p-2"
        />
        <select name="remote" defaultValue={searchParams.remote || ""} className="border rounded-lg p-2">
          <option value="">Remoto / Presencial</option>
          <option value="true">Remoto</option>
          <option value="false">Presencial/Híbrido</option>
        </select>
        <select
          name="employmentType"
          defaultValue={searchParams.employmentType || ""}
          className="border rounded-lg p-2"
        >
          <option value="">Tipo de empleo</option>
          <option value="FULL_TIME">Tiempo completo</option>
          <option value="PART_TIME">Medio tiempo</option>
          <option value="CONTRACT">Por periodo</option>
          <option value="INTERNSHIP">Prácticas</option>
        </select>
        <div className="md:col-span-4">
          <button className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50">Aplicar filtros</button>
          <a href="/jobs" className="ml-3 text-sm text-zinc-600 hover:underline">Limpiar</a>
        </div>
      </form>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-base font-medium">No hay vacantes que coincidan.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-white/70">
          {items.map((j) => (
            <li key={j.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/jobs/${j.id}`} className="font-semibold hover:underline">
                      {j.title}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      · {j.company || "Confidencial"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {j.remote ? "Remoto" : j.location || "—"} · {etLabel(j.employmentType)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {j.salaryMin || j.salaryMax ? (
                    <span className="inline-flex items-center rounded-full border bg-gray-50 px-2 py-1 text-[11px]">
                      {j.currency || "MXN"} {j.salaryMin ?? "—"} - {j.salaryMax ?? "—"}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
