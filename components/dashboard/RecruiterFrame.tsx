import type { ReactNode } from "react";
import RecruiterNavigation from "./RecruiterNavigation";

export default function RecruiterFrame({ pending = false, children }: { pending?: boolean; children: ReactNode }) {
  return <div data-recruiter-shell className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 bg-white dark:bg-zinc-950">
    <aside aria-label={pending ? "Cargando navegación" : "Panel del reclutador"} aria-busy={pending || undefined}
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-950 xl:block">
      {pending ? <div aria-hidden="true" className="space-y-6 p-3 motion-safe:animate-pulse">
        <div className="h-11 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-3">{[0, 1, 2, 3, 4].map(item => <div key={item} className="h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900" />)}</div>
      </div> : <RecruiterNavigation />}
    </aside>
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
}
