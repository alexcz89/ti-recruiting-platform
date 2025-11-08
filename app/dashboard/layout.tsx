// app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner"; // ⬅️ nuevo

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview" },
  { href: "/dashboard/jobs", label: "Vacantes" },
  { href: "/dashboard/codex", label: "Codex" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <main className="max-w-[1720px] 2xl:max-w-[1840px] mx-auto px-4 lg:px-6 py-8 lg:py-10">
      {/* Toaster global */}
      <Toaster richColors position="top-center" closeButton />

      {/* Tabs móviles */}
      <nav className="lg:hidden mb-6 flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition
              ${
                isActive(item.href)
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "hover:bg-gray-50 dark:hover:glass-card p-4 md:p-6"
              }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-[72px] space-y-5">
            <div className="rounded-2xl border glass-card p-4 md:p-6">
              <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Panel</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Administra vacantes y postulaciones.
              </p>
            </div>

            <nav
              aria-label="Secciones del panel"
              className="rounded-2xl border glass-card p-4 md:p-6"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition
                    ${
                      isActive(item.href)
                        ? "bg-emerald-600 text-white"
                        : "hover:bg-gray-50 dark:hover:glass-card p-4 md:p-6"
                    }`}
                >
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <span className="ml-2 inline-block h-2 w-2 badge " />
                  )}
                </Link>
              ))}
            </nav>

            <div className="rounded-2xl border glass-card p-4 md:p-6">
              <Link
                href="/jobs/new"
                className="block w-full rounded-lg bg-emerald-600 text-white text-sm font-medium px-3 py-2 text-center hover:bg-emerald-700"
              >
                + Publicar vacante
              </Link>
              <Link
                href="/dashboard/jobs"
                className="block w-full rounded-lg border text-sm px-3 py-2 text-center hover:bg-gray-50 dark:hover:glass-card p-4 md:p-6"
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
