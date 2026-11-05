export default function OverviewLoading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <span className="sr-only">Cargando panel</span>
      <div aria-hidden="true" className="space-y-8 motion-safe:animate-pulse">
        <div className="h-8 w-40 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        {[3, 5].map((rows, index) => <div key={index} className="rounded-xl border border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="mb-4 h-5 w-40 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          {Array.from({ length: rows }, (_, row) => <div key={row} className="flex justify-between gap-6 border-t border-zinc-200 py-5 dark:border-zinc-800">
            <div className="h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-16 shrink-0 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>)}
        </div>)}
      </div>
    </div>
  );
}
