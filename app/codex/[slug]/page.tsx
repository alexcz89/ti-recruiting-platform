// app/codex/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const entry = await prisma.codexEntry.findUnique({
    where: { slug: params.slug },
    select: { title: true, excerpt: true },
  });

  if (!entry) {
    return { title: "Artículo no encontrado | Codex" };
  }

  return {
    title: `${entry.title} | Codex`,
    description: entry.excerpt || "Artículo del Codex de Bolsa TI.",
  };
}

export default async function CodexDetail({ params }: Props) {
  const entry = await prisma.codexEntry.findUnique({
    where: { slug: params.slug },
  });

  if (!entry || !entry.published) {
    notFound();
  }

  return (
    <article className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/codex" className="text-sm text-zinc-600 hover:underline">
          ← Volver al Codex
        </Link>
      </div>

      <h1 className="text-3xl font-bold">{entry.title}</h1>
      <p className="text-sm text-zinc-500 mt-1">
        Actualizado: {new Date(entry.updatedAt).toLocaleDateString()}
      </p>

      <div className="prose prose-zinc max-w-none mt-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {entry.content}
        </ReactMarkdown>
      </div>

      <hr className="my-8" />

      <div className="flex gap-2 flex-wrap">
        {entry.tech && (
          <Link
            href={`/codex?tech=${encodeURIComponent(entry.tech)}`}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:underline"
          >
            {entry.tech}
          </Link>
        )}
        {entry.tags?.map((t) => (
          <Link
            key={t}
            href={`/codex?tag=${encodeURIComponent(t)}`}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:underline"
          >
            #{t}
          </Link>
        ))}
      </div>
    </article>
  );
}
