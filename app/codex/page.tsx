// app/codex/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = { q?: string; tag?: string; tech?: string };

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
  });
}

export const metadata = {
  title: "Codex | Bolsa TI",
  description: "Base de conocimiento técnica para reclutamiento TI.",
};

export default async function CodexPage({ searchParams }: { searchParams: SearchParams }) {
  const q = searchParams?.q ?? "";
  const tag = searchParams?.tag ?? "";
  const tech = searchParams?.tech ?? "";

  const entries = await getEntries({ q, tag, tech });

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Codex</h1>
      <form className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          name="q"
          placeholder="Buscar por título o contenido…"
          defaultValue={q}
          className="border rounded-xl p-3"
        />
        <input
          name="tag"
          placeholder="Tag (p. ej. prisma, next-auth)"
          defaultValue={tag}
          className="border rounded-xl p-3"
        />
        <input
          name="tech"
          placeholder="Tech (p. ej. Next.js, PostgreSQL)"
          defaultValue={tech}
          className="border rounded-xl p-3"
        />
        <button className="md:col-span-3 border rounded-xl p-3">Filtrar</button>
      </form>

      {entries.length === 0 && (
        <p className="text-sm text-zinc-500">No encontramos artículos con esos filtros.</p>
      )}

      <ul className="space-y-4">
        {entries.map((e) => (
          <li key={e.slug} className="border rounded-2xl p-4 hover:shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={`/codex/${e.slug}`} className="text-xl font-semibold hover:underline">
                  {e.title}
                </Link>
                <p className="text-sm mt-1 text-zinc-600">{e.excerpt}</p>
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
              <time className="text-xs text-zinc-500 whitespace-nowrap">
                {new Date(e.createdAt).toLocaleDateString()}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
