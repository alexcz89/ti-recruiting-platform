export default function AssessmentsLoading() {
  return <div role="status" aria-busy="true" className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <span className="sr-only">Cargando evaluaciones</span>
    <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-8 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-24 rounded bg-zinc-100 dark:bg-zinc-900" />
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex gap-6 border-t border-zinc-200 py-4 dark:border-zinc-800">
        <div className="h-5 w-1/3 rounded bg-zinc-100 dark:bg-zinc-900" /><div className="h-5 w-1/2 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>)}
    </div>
  </div>;
}
