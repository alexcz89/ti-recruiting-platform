// app/dashboard/jobs/loading.tsx
export default function LoadingJobsDashboard() {
  return (
    <main className="mx-auto max-w-[1600px] px-6 lg:px-10 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          <div className="h-4 w-64 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
      </div>

      {/* Métricas rápidas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border glass-card p-4 md:p-6"
          >
            <div className="h-3 w-20 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
            <div className="h-6 w-16 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          </div>
        ))}
      </section>

      {/* Filtros */}
      <section className="rounded-2xl border glass-card p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 space-y-2">
            <div className="h-3 w-16 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
            <div className="h-10 w-full bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          </div>
          <div className="md:col-span-4 space-y-2">
            <div className="h-3 w-16 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
            <div className="h-10 w-full bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="h-3 w-16 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
            <div className="h-10 w-full bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="h-3 w-12 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
            <div className="h-10 w-full bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          </div>
        </div>
      </section>

      {/* Tabla (skeleton filas) */}
      <div className="rounded-2xl border glass-card p-4 md:p-6">
        <div className="border-b bg-gray-50 py-3 px-4">
          <div className="h-4 w-56 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
        </div>

        <ul className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="px-4 py-4 grid grid-cols-12 gap-3 animate-pulse">
              <div className="col-span-6 space-y-2">
                <div className="h-4 w-2/3 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
                <div className="h-3 w-1/2 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
              </div>
              <div className="col-span-2 flex items-center justify-center">
                <div className="h-6 w-10 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
              </div>
              <div className="col-span-2 flex items-center justify-center">
                <div className="h-6 w-10 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
              </div>
              <div className="col-span-1 flex items-center">
                <div className="h-4 w-16 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <div className="h-8 w-8 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between px-4 py-3 text-xs text-zinc-500 border-t glass-card p-4 md:p-6">
          <div className="h-3 w-40 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          <div className="h-3 w-24 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
        </div>
      </div>
    </main>
  );
}
