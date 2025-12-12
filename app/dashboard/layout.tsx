// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/overview", label: "Panel" },
  { href: "/dashboard/jobs", label: "Vacantes" },
  { href: "/dashboard/billing", label: "Facturación y plan" },
  { href: "/dashboard/billing/taxdata", label: "Datos fiscales" },
  { href: "/dashboard/invoices", label: "Facturas" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <main className="max-w-[1720px] 2xl:max-w-[1840px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
      {/* Toaster global */}
      <Toaster richColors position="top-center" closeButton />

      {/* Tabs móviles */}
      <nav className="lg:hidden mb-6 flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm border transition
                ${
                  active
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-12 space-y-4">
            <div className="rounded-2xl border glass-card p-4 md:p-6">
              <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Panel</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Administra vacantes, facturación y postulaciones.
              </p>
            </div>

            <nav
              aria-label="Secciones del panel"
              className="rounded-2xl border glass-card p-2"
            >
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition
                      ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                      }`}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="ml-2 inline-block h-2 w-2 rounded-full bg-white/90"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-2xl border glass-card p-4 md:p-6">
              <Link
                href="/dashboard/jobs/new"
                className="block w-full rounded-lg bg-emerald-600 text-white text-sm font-medium px-3 py-2 text-center hover:bg-emerald-700"
              >
                + Publicar vacante
              </Link>
              <Link
                href="/dashboard/jobs"
                className="mt-2 block w-full rounded-lg border text-sm px-3 py-2 text-center
                           border-zinc-200/70 dark:border-zinc-800/70
                           text-zinc-700 dark:text-zinc-300
                           hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
              >
                Administrar vacantes
              </Link>
            </div>
          </div>
        </aside>

        <section className="space-y-8 min-w-0">{children}</section>
      </div>
    </main>
  );
}
