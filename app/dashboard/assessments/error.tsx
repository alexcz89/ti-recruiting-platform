"use client";
export default function AssessmentsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="px-4 py-8 sm:px-6 lg:px-8">
    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No pudimos cargar las evaluaciones</h2>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Intenta de nuevo. Tus evaluaciones se conservan.</p>
    <button type="button" onClick={reset} className="btn btn-primary mt-4 min-h-11 bg-emerald-700 hover:bg-emerald-800">Reintentar</button>
  </div>;
}
