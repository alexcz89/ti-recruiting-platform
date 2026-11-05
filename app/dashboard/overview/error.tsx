"use client";

import Link from "next/link";

export default function OverviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No pudimos cargar tu panel</h2>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Intenta de nuevo o consulta tus vacantes.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={reset} className="btn btn-primary min-h-11 bg-emerald-700 !text-white hover:bg-emerald-800">Reintentar</button>
      <Link href="/dashboard/jobs" className="btn btn-secondary min-h-11 !text-white">Ver vacantes</Link>
    </div>
  </div>;
}
