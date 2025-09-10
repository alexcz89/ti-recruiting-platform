import Link from "next/link";

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Artículo no encontrado</h1>
      <p className="mt-2 text-zinc-600">No pudimos localizar este recurso del Codex.</p>
      <Link href="/codex" className="text-blue-600 hover:underline mt-4 inline-block">
        Volver al Codex
      </Link>
    </main>
  );
}
