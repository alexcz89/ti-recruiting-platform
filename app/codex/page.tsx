// app/codex/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type SearchParams = { q?: string; tag?: string; tech?: string };

const FiltersSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  tag: z.string().trim().max(100).optional().default(""),
  tech: z.string().trim().max(100).optional().default(""),
});

async function getEntries({ q, tag, tech }: SearchParams) {
  return prisma.codexEntry.findMany({
    where: {
      published: true,
      AND: [
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
                { excerpt: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        tag ? { tags: { has: tag } } : {},
        tech ? { tech: { equals: tech } } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      tags: true,
      tech: true,
      createdAt: true,
    },
    take: 100, // límite sano para no traer todo
  });
}

export const metadata = {
  title: "Codex | Bolsa TI",
  description: "Base de conocimiento técnica para reclutamiento TI.",
};

export default async function CodexPage({ searchParams }: { searchParams: SearchParams }) {
  // Sanitiza filtros
  const parsed = FiltersSchema.safeParse(searchParams ?? {});
  const { q, tag, tech } = parsed.success ? parsed.data : { q: "", tag: "", tech: "" };

  const entries = await getEntries({ q, tag, tech });
  const hasFilters = !!(q || tag || tech);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Codex</h1>
        <p className="text-sm text-zinc-600">
          Guías, glosarios y playbooks para evaluar talento TI.
        </p>
      </header>

      {/* Filtros GET simples */}
      <form className="grid grid-cols-1 md:grid-cols-3 gap-3" method="GET">
        <input
          name="q"
          placeholder="Buscar por título o contenido…"
          defaultValue={q}
          className="border rounded-xl p-3"
          aria-label="Buscar"
        />
        <input
          name="tag"
          placeholder="Tag (p. ej. prisma, next-auth)"
          defaultValue={tag}
          className="border rounded-xl p-3"
          aria-label="Tag"
        />
        <input
          name="tech"
          placeholder="Tech (p. ej. Next.js, PostgreSQL)"
          defaultValue={tech}
          className="border rounded-xl p-3"
          aria-label="Tecnología"
        />
        <div className="md:col-span-3 flex gap-2">
          <button className="border rounded-xl px-4 py-2">Filtrar</button>
          {hasFilters && (
            <a
              href="/codex"
              className="border rounded-xl px-4 py-2 text-sm hover:bg-gray-50"
              aria-label="Limpiar filtros"
            >
              Limpiar
            </a>
          )}
        </div>
      </form>

      {/* Chips de filtros activos */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">Filtros:</span>
          {q && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-gray-50">
              q: “{q}”
              <a
                className="hover:text-rose-600"
                href={`/codex?${new URLSearchParams({ tag, tech }).toString()}`}
                aria-label="Quitar q"
              >
                ×
              </a>
            </span>
          )}
          {tag && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-gray-50">
              tag: “{tag}”
              <a
                className="hover:text-rose-600"
                href={`/codex?${new URLSearchParams({ q, tech }).toString()}`}
                aria-label="Quitar tag"
              >
                ×
              </a>
            </span>
          )}
          {tech && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-gray-50">
              tech: “{tech}”
              <a
                className="hover:text-rose-600"
                href={`/codex?${new URLSearchParams({ q, tag }).toString()}`}
                aria-label="Quitar tech"
              >
                ×
              </a>
            </span>
          )}
        </div>
      )}

      {/* Resultados */}
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No encontramos artículos con esos filtros.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => (
            <li key={e.slug} className="border rounded-2xl p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/codex/${e.slug}`}
                    className="text-xl font-semibold hover:underline"
                  >
                    {e.title}
                  </Link>
                  {e.excerpt && (
                    <p className="text-sm mt-1 text-zinc-600">{e.excerpt}</p>
                  )}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {e.tech && (
                      <Link
                        href={`/codex?tech=${encodeURIComponent(e.tech)}`}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:underline"
                      >
                        {e.tech}
                      </Link>
                    )}
                    {e.tags?.map((t) => (
                      <Link
                        key={t}
                        href={`/codex?tag=${encodeURIComponent(t)}`}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:underline"
                      >
                        #{t}
                      </Link>
                    ))}
                  </div>
                </div>
                <time
                  className="text-xs text-zinc-500 whitespace-nowrap"
                  title={new Date(e.createdAt).toLocaleString()}
                >
                  {formatDistanceToNow(new Date(e.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
