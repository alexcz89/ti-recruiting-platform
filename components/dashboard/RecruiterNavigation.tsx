"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { DASHBOARD_NAV, isActive, type NavItem } from "./navigation";

export default function RecruiterNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  function itemLink(item: NavItem) {
    const active = isActive(pathname, item);
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:focus-visible:outline-emerald-300 ${active
        ? "border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        : "border-transparent font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"}`}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{item.label}
    </Link>;
  }
  return <nav aria-label="Navegación del reclutador" className="space-y-6 p-3">
    <Link href="/dashboard/jobs/new" onClick={onNavigate}
      className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-800 dark:focus-visible:outline-emerald-300">
      <Plus aria-hidden="true" className="h-4 w-4" />Publicar vacante
    </Link>
    <div className="space-y-1">{DASHBOARD_NAV.filter(group => !group.children).map(itemLink)}</div>
    {DASHBOARD_NAV.filter(group => group.children).map(group => <div key={group.href} className="space-y-1">
      <p className="px-3 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{group.label}</p>
      {group.children?.map(itemLink)}
    </div>)}
  </nav>;
}
