"use client";

export default function AssessmentsError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-4 py-12">
    <div role="alert" className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h1 className="text-xl font-semibold">No pudimos cargar tus evaluaciones</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-300">Comprueba tu conexión y vuelve a intentarlo.</p>
      <button type="button" onClick={reset} className="btn btn-primary bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-800 mt-5 min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:focus-visible:outline-teal-300">Reintentar</button>
    </div>
  </main>;
}
