export default function AssessmentsLoading() {
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Cargando evaluaciones">
    <p role="status" className="text-sm text-zinc-600 dark:text-zinc-300">Cargando tus evaluaciones…</p>
    {[0, 1, 2].map(key => <div key={key} className="h-32 rounded-2xl border border-zinc-200 bg-zinc-50 motion-safe:animate-pulse dark:border-zinc-800 dark:bg-zinc-900" />)}
  </main>;
}
