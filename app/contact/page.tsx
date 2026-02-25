export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Contacto
        </h1>

        <p className="mt-4 text-zinc-700 dark:text-zinc-300">
          ¿Dudas, comentarios o quieres publicar vacantes?
        </p>

        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Escríbeme a:</p>
          <a
            className="mt-2 inline-block text-lg font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            href="mailto:alejandro@taskio.com.mx"
          >
            alejandro@taskio.com.mx
          </a>
        </div>
      </div>
    </main>
  );
}